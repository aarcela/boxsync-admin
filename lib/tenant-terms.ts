/** Labels in tenants.settings.terms. Keep in sync with app/constants/tenantTerms.ts */

export type TenantTermsLang = 'en' | 'es';

export type TenantTermNoun = {
  singular: string;
  plural: string;
};

export type TenantTerms = {
  member: TenantTermNoun;
  venue: string;
  session: string;
  coach: string;
  workout: string;
};

export type TenantMemberPresetId = 'athletes' | 'students' | 'users' | 'clients';

/** Defaults stay CrossFit-flavored except venue, which is gym-neutral. */
export const DEFAULT_TENANT_TERMS_ES: TenantTerms = {
  member: { singular: 'atleta', plural: 'atletas' },
  venue: 'gimnasio',
  session: 'clase',
  coach: 'coach',
  workout: 'WOD',
};

export const DEFAULT_TENANT_TERMS_EN: TenantTerms = {
  member: { singular: 'athlete', plural: 'athletes' },
  venue: 'gym',
  session: 'class',
  coach: 'coach',
  workout: 'WOD',
};

export const MEMBER_TERM_PRESETS: Record<
  TenantMemberPresetId,
  Record<TenantTermsLang, TenantTermNoun>
> = {
  athletes: {
    es: { singular: 'Atleta', plural: 'Atletas' },
    en: { singular: 'Athlete', plural: 'Athletes' },
  },
  students: {
    es: { singular: 'Alumno', plural: 'Alumnos' },
    en: { singular: 'Student', plural: 'Students' },
  },
  users: {
    es: { singular: 'Usuario', plural: 'Usuarios' },
    en: { singular: 'User', plural: 'Users' },
  },
  clients: {
    es: { singular: 'Cliente', plural: 'Clientes' },
    en: { singular: 'Client', plural: 'Clients' },
  },
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function strField(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function nounField(value: unknown, fallback: TenantTermNoun): TenantTermNoun {
  const bag = asObject(value);
  return {
    singular: strField(bag?.singular, fallback.singular),
    plural: strField(bag?.plural, fallback.plural),
  };
}

export function defaultTenantTerms(lang: TenantTermsLang): TenantTerms {
  return lang === 'en' ? DEFAULT_TENANT_TERMS_EN : DEFAULT_TENANT_TERMS_ES;
}

export function parseTenantTerms(
  settings: unknown,
  lang: TenantTermsLang = 'es'
): TenantTerms {
  const fallback = defaultTenantTerms(lang);
  const bag = asObject(asObject(settings)?.terms);
  if (!bag) return fallback;
  return {
    member: nounField(bag.member, fallback.member),
    venue: strField(bag.venue, fallback.venue),
    session: strField(bag.session, fallback.session),
    coach: strField(bag.coach, fallback.coach),
    workout: strField(bag.workout, fallback.workout),
  };
}

export function getRawTenantTerms(settings: unknown): Record<string, unknown> | null {
  return asObject(asObject(settings)?.terms);
}

export function serializeTenantTerms(terms: TenantTerms): Record<string, unknown> {
  return {
    member: {
      singular: terms.member.singular.trim(),
      plural: terms.member.plural.trim(),
    },
    venue: terms.venue.trim(),
    session: terms.session.trim(),
    coach: terms.coach.trim(),
    workout: terms.workout.trim(),
  };
}

export function patchTenantTermsSettings(
  settings: unknown,
  patch: Partial<TenantTerms>
): Record<string, unknown> {
  const current = asObject(settings) ?? {};
  const bag = { ...(asObject(current.terms) ?? {}) };
  if (patch.member) {
    const member = { ...(asObject(bag.member) ?? {}) };
    if (typeof patch.member.singular === 'string' && patch.member.singular.trim()) {
      member.singular = patch.member.singular.trim();
    }
    if (typeof patch.member.plural === 'string' && patch.member.plural.trim()) {
      member.plural = patch.member.plural.trim();
    }
    bag.member = member;
  }
  if (typeof patch.venue === 'string' && patch.venue.trim()) bag.venue = patch.venue.trim();
  if (typeof patch.session === 'string' && patch.session.trim()) bag.session = patch.session.trim();
  if (typeof patch.coach === 'string' && patch.coach.trim()) bag.coach = patch.coach.trim();
  if (typeof patch.workout === 'string' && patch.workout.trim()) bag.workout = patch.workout.trim();
  return { ...current, terms: bag };
}

function termValue(terms: TenantTerms, key: string): string {
  switch (key) {
    case 'member':
      return terms.member.singular;
    case 'members':
      return terms.member.plural;
    case 'venue':
      return terms.venue;
    case 'session':
      return terms.session;
    case 'coach':
      return terms.coach;
    case 'workout':
      return terms.workout;
    default:
      return '';
  }
}

function applyPlaceholderCase(value: string, token: string): string {
  const raw = value.trim();
  if (!raw) return raw;
  if (token === token.toUpperCase()) return raw.toUpperCase();
  if (token[0] === token[0].toUpperCase()) {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  if (raw.length <= 4 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) return raw;
  return raw.toLowerCase();
}

const TERM_PLACEHOLDER_RE = /\{(members|member|venue|session|coach|workout)\}/gi;

export function interpolateTenantTerms(text: string, terms: TenantTerms): string {
  return text.replace(TERM_PLACEHOLDER_RE, (_match, token: string) =>
    applyPlaceholderCase(termValue(terms, token.toLowerCase()), token)
  );
}

type TermsListener = () => void;

let publishedSettings: unknown = null;
let termsVersion = 0;
const termsListeners = new Set<TermsListener>();

export function publishTenantSettings(settings: unknown) {
  publishedSettings = settings;
  termsVersion += 1;
  for (const listener of termsListeners) listener();
}

export function getPublishedTenantSettings(): unknown {
  return publishedSettings;
}

export function getTenantTermsVersion(): number {
  return termsVersion;
}

export function subscribeTenantTerms(listener: TermsListener): () => void {
  termsListeners.add(listener);
  return () => {
    termsListeners.delete(listener);
  };
}
