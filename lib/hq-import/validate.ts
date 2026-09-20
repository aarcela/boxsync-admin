import { PROFILE_ROLES, type ProfileRole } from '@/lib/auth';
import { getPlatformPlan, isOverMemberCap } from '@/lib/platform-plans';
import { renewDateToIso } from '@/lib/renew-date';
import type { Language } from '@/lib/translations';
import type { InscriptionPlan, PlanLimitType, PlatformPlanId } from '@/lib/types/gym';
import {
  HQ_IMPORT_MAX_BYTES,
  HQ_IMPORT_MAX_ROWS,
  parseCsv,
  type CsvRecord,
} from './csv';
import {
  MEMBER_CSV_HEADERS,
  PLAN_CSV_HEADERS,
  type HqImportKind,
} from './templates';
import type {
  HqImportIssue,
  HqImportRowPreview,
  HqImportSummary,
  MembersValidationResult,
  PlansValidationResult,
  ValidatedMemberRow,
  ValidatedPlanRow,
} from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIMIT_TYPES: PlanLimitType[] = ['none', 'weekly', 'period'];
const INSCRIPTION_PLANS: InscriptionPlan[] = ['standard', 'promo', 're-entry', 'founder'];

export type ExistingPlan = { id: string; name: string; is_active: boolean };

export type ExistingAuthUser = {
  id: string;
  email: string;
  tenant_id: string | null;
  role: string | null;
};

function missingHeaders(headers: string[], required: readonly string[]): string[] {
  const set = new Set(headers);
  return required.filter((header) => !set.has(header));
}

function parseBoolean(raw: string, defaultValue: boolean): { value: boolean } | { error: string } {
  if (!raw) return { value: defaultValue };
  const normalized = raw.toLowerCase();
  if (['true', '1', 'yes', 'y', 'si', 'sí'].includes(normalized)) return { value: true };
  if (['false', '0', 'no', 'n'].includes(normalized)) return { value: false };
  return { error: 'Invalid boolean. Use true or false.' };
}

function parseNonNegativeNumber(raw: string, required: boolean): { value: number | null } | { error: string } {
  if (!raw) {
    if (required) return { error: 'Invalid price' };
    return { value: null };
  }
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return { error: 'Invalid price' };
  return { value };
}

function parsePositiveInt(raw: string): { value: number | null } | { error: string } {
  if (!raw) return { value: null };
  if (!/^\d+$/.test(raw)) return { error: 'Invalid number' };
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return { error: 'Invalid number' };
  return { value };
}

function emptyToNull(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function buildSummary(params: {
  kind: HqImportKind;
  rowCount: number;
  rows: HqImportRowPreview[];
  blockingErrors: string[];
}): HqImportSummary {
  const createCount = params.rows.filter((row) => row.action === 'create').length;
  const skipCount = params.rows.filter((row) => row.action === 'skip').length;
  const errorCount = params.rows.filter((row) => row.action === 'error').length;
  const issues: HqImportIssue[] = [];
  for (const row of params.rows) {
    for (const message of row.issues) {
      issues.push({ line: row.line, message });
    }
  }
  return {
    kind: params.kind,
    rowCount: params.rowCount,
    createCount,
    skipCount,
    errorCount,
    canCommit: params.blockingErrors.length === 0 && errorCount === 0 && createCount > 0,
    issues,
    rows: params.rows,
    blockingErrors: params.blockingErrors,
  };
}

function csvGuard(csv: string, required: readonly string[]): {
  parsed: ReturnType<typeof parseCsv>;
  blockingErrors: string[];
} {
  const blockingErrors: string[] = [];
  if (Buffer.byteLength(csv, 'utf8') > HQ_IMPORT_MAX_BYTES) {
    blockingErrors.push('CSV too large');
  }
  const parsed = parseCsv(csv);
  const missing = missingHeaders(parsed.headers, required);
  if (missing.length) {
    blockingErrors.push(`Missing columns: ${missing.join(', ')}`);
  }
  if (parsed.rows.length === 0) {
    blockingErrors.push('File is empty');
  }
  if (parsed.rows.length > HQ_IMPORT_MAX_ROWS) {
    blockingErrors.push('Too many rows (max 500)');
  }
  return { parsed, blockingErrors };
}

export function validatePlansCsv(
  csv: string,
  existingPlans: ExistingPlan[]
): PlansValidationResult {
  const { parsed, blockingErrors } = csvGuard(csv, PLAN_CSV_HEADERS);
  const existingByName = new Map(
    existingPlans.map((plan) => [plan.name.trim().toLowerCase(), plan])
  );
  const seen = new Map<string, number>();
  const rows: HqImportRowPreview[] = [];
  const creates: ValidatedPlanRow[] = [];

  if (blockingErrors.length) {
    return {
      summary: buildSummary({
        kind: 'plans',
        rowCount: parsed.rows.length,
        rows,
        blockingErrors,
      }),
      creates,
    };
  }

  for (const record of parsed.rows) {
    const issues: string[] = [];
    const name = record.values.name?.trim() ?? '';
    if (!name) issues.push('Missing plan name');

    const key = name.toLowerCase();
    if (name) {
      if (seen.has(key)) issues.push('Duplicate plan name in file');
      else seen.set(key, record.line);
    }

    const priceResult = parseNonNegativeNumber(record.values.price_usd ?? '', true);
    if ('error' in priceResult) issues.push(priceResult.error);

    const limitTypeRaw = (record.values.limit_type ?? '').trim().toLowerCase();
    if (!LIMIT_TYPES.includes(limitTypeRaw as PlanLimitType)) {
      issues.push('Invalid limit type');
    }
    const limitType = limitTypeRaw as PlanLimitType;

    const weekly = parsePositiveInt(record.values.weekly_limit ?? '');
    const sessions = parsePositiveInt(record.values.session_limit ?? '');
    const validity = parsePositiveInt(record.values.validity_days ?? '');
    if ('error' in weekly) issues.push('Invalid weekly limit');
    if ('error' in sessions) issues.push('Invalid session limit');
    if ('error' in validity) issues.push('Invalid validity days');

    const weeklyVal = 'error' in weekly ? null : weekly.value;
    const sessionVal = 'error' in sessions ? null : sessions.value;
    const validityVal = 'error' in validity ? null : validity.value;

    if (limitType === 'none') {
      if (weeklyVal || sessionVal || validityVal) {
        issues.push('Unused limit fields must be empty');
      }
    } else if (limitType === 'weekly') {
      if (!weeklyVal) issues.push('Weekly limit required');
      if (sessionVal || validityVal) issues.push('Unused limit fields must be empty');
    } else if (limitType === 'period') {
      if (!sessionVal || !validityVal) issues.push('Session limit and validity days required');
      if (weeklyVal) issues.push('Unused limit fields must be empty');
    }

    const activeResult = parseBoolean(record.values.is_active ?? '', true);
    if ('error' in activeResult) issues.push(activeResult.error);

    if (issues.length) {
      rows.push({
        line: record.line,
        action: 'error',
        label: name || `(line ${record.line})`,
        issues,
      });
      continue;
    }

    if (existingByName.has(key)) {
      rows.push({
        line: record.line,
        action: 'skip',
        label: name,
        issues: ['Plan already exists'],
      });
      continue;
    }

    const create: ValidatedPlanRow = {
      line: record.line,
      action: 'create',
      name,
      price_usd: 'error' in priceResult ? 0 : (priceResult.value as number),
      limit_type: limitType,
      weekly_limit: limitType === 'weekly' ? weeklyVal : null,
      session_limit: limitType === 'period' ? sessionVal : null,
      validity_days: limitType === 'period' ? validityVal : null,
      is_active: 'error' in activeResult ? true : activeResult.value,
      description: emptyToNull(record.values.description ?? ''),
    };
    creates.push(create);
    rows.push({ line: record.line, action: 'create', label: name, issues: [] });
  }

  return {
    summary: buildSummary({
      kind: 'plans',
      rowCount: parsed.rows.length,
      rows,
      blockingErrors,
    }),
    creates,
  };
}

export function validateMembersCsv(
  csv: string,
  context: {
    tenantId: string;
    existingPlans: ExistingPlan[];
    existingUsers: ExistingAuthUser[];
    platformPlan: PlatformPlanId;
    memberCount: number;
    activeMemberCount: number;
  }
): MembersValidationResult {
  const { parsed, blockingErrors } = csvGuard(csv, MEMBER_CSV_HEADERS);
  const plansByName = new Map(
    context.existingPlans
      .filter((plan) => plan.is_active)
      .map((plan) => [plan.name.trim().toLowerCase(), plan])
  );
  const usersByEmail = new Map(
    context.existingUsers.map((user) => [user.email.trim().toLowerCase(), user])
  );
  const seen = new Map<string, number>();
  const rows: HqImportRowPreview[] = [];
  const creates: ValidatedMemberRow[] = [];

  if (plansByName.size === 0) {
    blockingErrors.push('Import membership plans before members.');
  }

  if (blockingErrors.length) {
    return {
      summary: buildSummary({
        kind: 'members',
        rowCount: parsed.rows.length,
        rows,
        blockingErrors,
      }),
      creates,
    };
  }

  let newMembers = 0;
  let newSolventMembers = 0;

  for (const record of parsed.rows) {
    const result = validateMemberRecord(record, {
      tenantId: context.tenantId,
      plansByName,
      usersByEmail,
      seen,
    });
    rows.push(result.preview);
    if (result.create) {
      creates.push(result.create);
      if (result.create.role === 'member') {
        newMembers += 1;
        if (result.create.is_solvent) newSolventMembers += 1;
      }
    }
  }

  const cap = getPlatformPlan(context.platformPlan).maxActiveMembers;
  if (cap !== null) {
    if (context.memberCount + newMembers > cap) {
      blockingErrors.push('Import would exceed member cap');
    } else if (
      isOverMemberCap(context.platformPlan, context.activeMemberCount + newSolventMembers)
    ) {
      blockingErrors.push('Import would exceed member cap');
    }
  }

  return {
    summary: buildSummary({
      kind: 'members',
      rowCount: parsed.rows.length,
      rows,
      blockingErrors,
    }),
    creates,
  };
}

function validateMemberRecord(
  record: CsvRecord,
  ctx: {
    tenantId: string;
    plansByName: Map<string, ExistingPlan>;
    usersByEmail: Map<string, ExistingAuthUser>;
    seen: Map<string, number>;
  }
): { preview: HqImportRowPreview; create?: ValidatedMemberRow } {
  const issues: string[] = [];
  const email = (record.values.email ?? '').trim().toLowerCase();
  const fullName = (record.values.full_name ?? '').trim();
  const label = fullName || email || `(line ${record.line})`;

  if (!email) issues.push('Missing email');
  else if (!EMAIL_RE.test(email)) issues.push('Invalid email');

  if (email) {
    if (ctx.seen.has(email)) issues.push('Duplicate email in file');
    else ctx.seen.set(email, record.line);
  }

  if (!fullName) issues.push('Missing full name');

  const roleRaw = ((record.values.role ?? '').trim().toLowerCase() || 'member') as ProfileRole;
  if (roleRaw === 'admin') issues.push('Admin cannot be imported');
  else if (!PROFILE_ROLES.includes(roleRaw)) issues.push('Invalid role');

  const planName = (record.values.plan_name ?? '').trim();
  if (!planName) issues.push('Missing plan name');
  const plan = planName ? ctx.plansByName.get(planName.toLowerCase()) : undefined;
  if (planName && !plan) issues.push('Unknown plan name');

  const solventDefault = roleRaw === 'member' ? false : true;
  const solventResult = parseBoolean(record.values.is_solvent ?? '', solventDefault);
  if ('error' in solventResult) issues.push('Invalid solvent value');
  const isSolvent = 'error' in solventResult ? solventDefault : solventResult.value;

  const periodRaw = (record.values.plan_period_start ?? '').trim();
  let planPeriodStart: string | null = null;
  if (periodRaw) {
    if (!DATE_RE.test(periodRaw)) {
      issues.push('Invalid plan_period_start');
    } else {
      planPeriodStart = renewDateToIso(periodRaw);
    }
  }
  if (roleRaw === 'member' && isSolvent && !planPeriodStart) {
    issues.push('Solvent members need plan_period_start (YYYY-MM-DD)');
  }

  const languageRaw = (record.values.language ?? '').trim().toLowerCase() || 'es';
  if (languageRaw !== 'en' && languageRaw !== 'es') issues.push('Invalid language');

  const inscriptionRaw =
    ((record.values.inscription_plan ?? '').trim().toLowerCase() || 'standard') as InscriptionPlan;
  if (!INSCRIPTION_PLANS.includes(inscriptionRaw)) issues.push('Invalid inscription plan');

  const existing = email ? ctx.usersByEmail.get(email) : undefined;
  if (existing && existing.tenant_id !== ctx.tenantId) {
    issues.push('Email belongs to another box');
  }

  if (issues.length) {
    return { preview: { line: record.line, action: 'error', label, issues } };
  }

  if (existing) {
    return {
      preview: {
        line: record.line,
        action: 'skip',
        label,
        issues: ['Athlete already exists'],
      },
    };
  }

  if (!plan) {
    return {
      preview: { line: record.line, action: 'error', label, issues: ['Unknown plan name'] },
    };
  }

  const create: ValidatedMemberRow = {
    line: record.line,
    action: 'create',
    email,
    full_name: fullName,
    phone: emptyToNull(record.values.phone ?? ''),
    role: roleRaw as Exclude<ProfileRole, 'admin'>,
    plan_id: plan.id,
    plan_name: plan.name,
    is_solvent: roleRaw === 'member' ? isSolvent : true,
    plan_period_start: planPeriodStart,
    language: languageRaw === 'en' ? 'en' : 'es',
    inscription_plan: inscriptionRaw,
  };

  return { preview: { line: record.line, action: 'create', label, issues: [] }, create };
}
