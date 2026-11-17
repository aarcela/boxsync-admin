import { DEFAULT_PALETTE_ID, isPaletteId, type PaletteId } from '@/lib/constants/appPalettes';
import { DEFAULT_GYM_TIMEZONE, isValidTimezone } from '@/lib/gym-timezone';
import { addDaysToDateStr, getGymDate } from '@/lib/utils/date';
import type { PlanLimitType } from '@/lib/types/gym';

export const DEMO_DEFAULT_DAYS = 14;
export const DEMO_MAX_DAYS = 30;
export const DEMO_DEFAULT_CAPACITY = 12;
export const DEMO_DEFAULT_MINUTES = 60;
export const INVENTED_PLAN_NAME = 'Plan mensual';
export const INVENTED_PLAN_PRICE = 40;

export type DemoMsg = { line?: number; code: string; text: string };

export type DemoPlanInput = {
  name: string;
  priceUsd: number;
  limitType: PlanLimitType;
  weeklyLimit: number | null;
  sessionLimit: number | null;
  validityDays: number | null;
};

export type DemoSession = {
  /** ISO weekdays: 1 = Monday … 7 = Sunday. */
  days: number[];
  time: string;
  className: string;
  minutes: number;
  capacity: number;
  coach?: string;
};

export type DemoInput = {
  name: string;
  source: string | null;
  paletteId: PaletteId;
  /** YYYY-MM-DD, gym-local; the demo ends at the end of that day. */
  expiresOn: string;
  tz: string;
  defaultCapacity: number;
  plans: DemoPlanInput[];
  /** True when no plans were given and a placeholder plan was invented. */
  plansInvented: boolean;
  sessions: DemoSession[];
};

export type DemoParseResult = {
  input?: DemoInput;
  errors: DemoMsg[];
  warnings: DemoMsg[];
};

const KEY_ALIASES: Record<string, string> = {
  estudio: 'name',
  gym: 'name',
  nombre: 'name',
  name: 'name',
  studio: 'name',
  fuente: 'source',
  source: 'source',
  paleta: 'palette',
  palette: 'palette',
  vence: 'expires',
  expira: 'expires',
  expires: 'expires',
  tz: 'tz',
  timezone: 'tz',
  zona: 'tz',
  capacidad: 'capacity',
  capacity: 'capacity',
  cap: 'capacity',
  planes: 'plans',
  plans: 'plans',
  horario: 'schedule',
  schedule: 'schedule',
  horarios: 'schedule',
};

const DAY_ALIASES: Record<string, number> = {
  lun: 1, lunes: 1, lu: 1, mon: 1, monday: 1, l: 1,
  mar: 2, martes: 2, ma: 2, tue: 2, tues: 2, tuesday: 2,
  mie: 3, miercoles: 3, mi: 3, mx: 3, wed: 3, wednesday: 3, x: 3,
  jue: 4, jueves: 4, ju: 4, thu: 4, thur: 4, thurs: 4, thursday: 4, j: 4,
  vie: 5, viernes: 5, vi: 5, fri: 5, friday: 5, v: 5,
  sab: 6, sabado: 6, sa: 6, sat: 6, saturday: 6, s: 6,
  dom: 7, domingo: 7, do: 7, sun: 7, sunday: 7, d: 7,
};

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function parseDays(token: string): number[] | null {
  const days = new Set<number>();
  for (const part of token.split(',')) {
    const piece = fold(part).replace(/\.$/, '');
    if (!piece) continue;
    const range = piece.split('-');
    if (range.length === 2) {
      const from = DAY_ALIASES[range[0]];
      const to = DAY_ALIASES[range[1]];
      if (!from || !to) return null;
      for (let d = from; ; d = (d % 7) + 1) {
        days.add(d);
        if (d === to) break;
      }
      continue;
    }
    const day = DAY_ALIASES[piece];
    if (!day) return null;
    days.add(day);
  }
  return days.size ? [...days].sort((a, b) => a - b) : null;
}

function parseTime(token: string): string | null {
  const match = token.trim().toLowerCase().match(/^(\d{1,2})(?:[:h.](\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  } else if (!match[2]) {
    return null;
  }
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parsePrice(token: string): number | null {
  const cleaned = token.replace(/(usd|us\$|\$|€|eur)/gi, '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parsePlanLimit(
  raw: string
): Pick<DemoPlanInput, 'limitType' | 'weeklyLimit' | 'sessionLimit' | 'validityDays'> | null {
  const text = fold(raw);
  if (!text || /^(ilimitado|ilimitada|unlimited|libre|none)$/.test(text)) {
    return { limitType: 'none', weeklyLimit: null, sessionLimit: null, validityDays: null };
  }
  const period = text.match(
    /^(\d+)\s*(clases?|sesiones?|classes?|sessions?)?\s*\/\s*(\d+)\s*(dias?|days?)$/
  );
  if (period) {
    return {
      limitType: 'period',
      weeklyLimit: null,
      sessionLimit: Number(period[1]),
      validityDays: Number(period[3]),
    };
  }
  const weekly = text.match(
    /^(\d+)\s*(clases?|sesiones?|classes?|sessions?)?\s*(por|x|\/|per|a la)\s*(semana|week|sem)$/
  );
  if (weekly) {
    return {
      limitType: 'weekly',
      weeklyLimit: Number(weekly[1]),
      sessionLimit: null,
      validityDays: null,
    };
  }
  return null;
}

function parseScheduleLine(
  text: string,
  defaultCapacity: number
): { session?: DemoSession; error?: { code: string; text: string } } {
  const match = text.match(/^(\S+)\s+(\S+(?:\s*(?:am|pm))?)\s+(.+)$/i);
  if (!match) {
    return { error: { code: 'schedule_format', text: 'Formato: "Dias HH:MM Nombre [minutos] [cap=N] [coach=Nombre]".' } };
  }
  const days = parseDays(match[1]);
  if (!days) return { error: { code: 'unknown_day', text: `Día desconocido en "${match[1]}". Usa Lun,Mar,Mie,Jue,Vie,Sab,Dom.` } };
  const time = parseTime(match[2]);
  if (!time) return { error: { code: 'bad_time', text: `Hora inválida "${match[2]}". Usa HH:MM (24 h).` } };

  let rest = match[3];
  let capacity = defaultCapacity;
  let coach: string | undefined;

  const coachMatch = rest.match(/\bcoach=(.+?)(?=\s+\w+=|$)/i);
  if (coachMatch) {
    coach = coachMatch[1].trim();
    rest = rest.replace(coachMatch[0], ' ');
  }
  const capMatch = rest.match(/\bcap=(\S+)/i);
  if (capMatch) {
    const cap = Number(capMatch[1]);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) {
      return { error: { code: 'bad_capacity', text: `Capacidad inválida "${capMatch[1]}".` } };
    }
    capacity = cap;
    rest = rest.replace(capMatch[0], ' ');
  }
  if (/\b\w+=/.test(rest)) {
    return { error: { code: 'unknown_option', text: 'Opción desconocida. Solo cap= y coach=.' } };
  }

  const words = rest.trim().split(/\s+/).filter(Boolean);
  let minutes = DEMO_DEFAULT_MINUTES;
  const last = words[words.length - 1]?.replace(/(min|m|')$/i, '');
  if (words.length > 1 && last && /^\d+$/.test(last)) {
    minutes = Number(last);
    words.pop();
    if (minutes < 10 || minutes > 300) {
      return { error: { code: 'bad_minutes', text: `Duración inválida "${minutes}" (10–300 min).` } };
    }
  }
  const className = words.join(' ').trim();
  if (!className) return { error: { code: 'missing_class', text: 'Falta el nombre de la clase.' } };
  if (className.length > 60) return { error: { code: 'class_too_long', text: 'Nombre de clase muy largo (máx. 60).' } };

  return { session: { days, time, className, minutes, capacity, ...(coach ? { coach } : {}) } };
}

/**
 * Parses the plain-text block pasted in HQ → Demos. Errors block creation; warnings don't.
 * `now` is injectable for tests.
 */
export function parseDemoInput(text: string, now: Date = new Date()): DemoParseResult {
  const errors: DemoMsg[] = [];
  const warnings: DemoMsg[] = [];
  const values: Record<string, { value: string; line: number }> = {};
  const planLines: { text: string; line: number }[] = [];
  const scheduleLines: { text: string; line: number }[] = [];
  let section: 'plans' | 'schedule' | null = null;

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    const trimmed = rawLine.replace(/#.*$/, '').trim();
    if (!trimmed) return;
    const keyMatch = trimmed.match(/^([\p{L}_]+)\s*:\s*(.*)$/u);
    const key = keyMatch ? KEY_ALIASES[fold(keyMatch[1])] : undefined;
    if (key) {
      const value = keyMatch![2].trim();
      if (key === 'plans' || key === 'schedule') {
        section = key;
        if (value) (key === 'plans' ? planLines : scheduleLines).push({ text: value, line });
        return;
      }
      section = null;
      values[key] = { value, line };
      return;
    }
    const item = trimmed.replace(/^[-*•]\s*/, '');
    if (section === 'plans') planLines.push({ text: item, line });
    else if (section === 'schedule') scheduleLines.push({ text: item, line });
    else errors.push({ line, code: 'unknown_line', text: `Línea no reconocida: "${trimmed}".` });
  });

  const name = values.name?.value ?? '';
  if (!name) errors.push({ code: 'missing_name', text: 'Falta "estudio: Nombre".' });
  else if (name.length > 80) errors.push({ line: values.name.line, code: 'name_too_long', text: 'Nombre muy largo (máx. 80).' });

  const source = values.source?.value || null;
  if (!source) {
    warnings.push({ code: 'missing_source', text: 'Sin "fuente": anota de dónde salió el horario (regla 9).' });
  }

  let paletteId: PaletteId = DEFAULT_PALETTE_ID;
  if (values.palette?.value) {
    const candidate = fold(values.palette.value);
    if (isPaletteId(candidate)) paletteId = candidate;
    else warnings.push({ line: values.palette.line, code: 'bad_palette', text: `Paleta "${values.palette.value}" no existe: se usa "default".` });
  }

  let tz = DEFAULT_GYM_TIMEZONE;
  if (values.tz?.value) {
    if (isValidTimezone(values.tz.value)) tz = values.tz.value;
    else warnings.push({ line: values.tz.line, code: 'bad_timezone', text: `Zona horaria "${values.tz.value}" inválida: se usa ${DEFAULT_GYM_TIMEZONE}.` });
  }

  let defaultCapacity = DEMO_DEFAULT_CAPACITY;
  if (values.capacity?.value) {
    const cap = Number(values.capacity.value);
    if (Number.isInteger(cap) && cap >= 1 && cap <= 500) defaultCapacity = cap;
    else errors.push({ line: values.capacity.line, code: 'bad_capacity', text: `Capacidad inválida "${values.capacity.value}".` });
  }

  const today = getGymDate(now, tz);
  const maxDate = addDaysToDateStr(today, DEMO_MAX_DAYS);
  let expiresOn = addDaysToDateStr(today, DEMO_DEFAULT_DAYS);
  if (values.expires?.value) {
    const raw = values.expires.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
      errors.push({ line: values.expires.line, code: 'bad_expiry', text: `Fecha "${raw}" inválida. Usa AAAA-MM-DD.` });
    } else if (raw <= today) {
      errors.push({ line: values.expires.line, code: 'expiry_past', text: 'La fecha de vencimiento debe ser futura.' });
    } else if (raw > maxDate) {
      warnings.push({ line: values.expires.line, code: 'expiry_clamped', text: `Máximo ${DEMO_MAX_DAYS} días: vence el ${maxDate}.` });
      expiresOn = maxDate;
    } else {
      expiresOn = raw;
    }
  }

  const sessions: DemoSession[] = [];
  for (const { text: lineText, line } of scheduleLines) {
    const parsed = parseScheduleLine(lineText, defaultCapacity);
    if (parsed.error) errors.push({ line, ...parsed.error });
    else if (parsed.session) sessions.push(parsed.session);
  }
  if (scheduleLines.length === 0) {
    errors.push({ code: 'missing_schedule', text: 'Falta "horario:" con al menos una clase.' });
  }

  const seen = new Set<string>();
  for (const session of sessions) {
    for (const day of session.days) {
      const key = `${day}-${session.time}-${fold(session.className)}`;
      if (seen.has(key)) {
        warnings.push({ code: 'duplicate_session', text: `Clase repetida: ${session.className} ${session.time} (día ${day}).` });
      }
      seen.add(key);
    }
  }

  const plans: DemoPlanInput[] = [];
  for (const { text: lineText, line } of planLines) {
    const parts = lineText.split('|').map((part) => part.trim());
    if (parts.length < 2 || !parts[0]) {
      errors.push({ line, code: 'plan_format', text: 'Formato de plan: "Nombre | precio | límite".' });
      continue;
    }
    const priceUsd = parsePrice(parts[1]);
    if (priceUsd === null) {
      errors.push({ line, code: 'bad_price', text: `Precio inválido "${parts[1]}".` });
      continue;
    }
    const limit = parsePlanLimit(parts[2] ?? '');
    if (!limit) {
      errors.push({ line, code: 'bad_limit', text: `Límite "${parts[2]}" no reconocido. Usa "ilimitado", "8 clases / 30 dias" o "3 por semana".` });
      continue;
    }
    plans.push({ name: parts[0], priceUsd, ...limit });
  }

  const plansInvented = planLines.length === 0;
  if (plansInvented) {
    plans.push({
      name: INVENTED_PLAN_NAME,
      priceUsd: INVENTED_PLAN_PRICE,
      limitType: 'none',
      weeklyLimit: null,
      sessionLimit: null,
      validityDays: null,
    });
    warnings.push({
      code: 'invented_plan',
      text: 'Sin planes publicados: se crea "Plan mensual" con precio inventado. No lo muestres en el video.',
    });
  }

  if (errors.length) return { errors, warnings };
  return {
    input: {
      name,
      source,
      paletteId,
      expiresOn,
      tz,
      defaultCapacity,
      plans,
      plansInvented,
      sessions,
    },
    errors,
    warnings,
  };
}
