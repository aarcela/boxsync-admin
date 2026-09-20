export const HQ_IMPORT_KINDS = ['plans', 'members'] as const;
export type HqImportKind = (typeof HQ_IMPORT_KINDS)[number];

export function isHqImportKind(value: unknown): value is HqImportKind {
  return value === 'plans' || value === 'members';
}

export const PLAN_CSV_HEADERS = [
  'name',
  'price_usd',
  'limit_type',
  'weekly_limit',
  'session_limit',
  'validity_days',
  'is_active',
  'description',
] as const;

export const MEMBER_CSV_HEADERS = [
  'email',
  'full_name',
  'phone',
  'role',
  'plan_name',
  'is_solvent',
  'plan_period_start',
  'language',
  'inscription_plan',
] as const;

export const PLAN_CSV_TEMPLATE = `${PLAN_CSV_HEADERS.join(',')}
Unlimited,80,none,,,,true,Open gym and all classes
3x Week,60,weekly,3,,,true,Three classes per week
10-pack,90,period,,10,30,true,Ten classes in 30 days
`;

export const MEMBER_CSV_TEMPLATE = `${MEMBER_CSV_HEADERS.join(',')}
athlete.one@example.com,Ana Perez,+584121112233,member,Unlimited,false,,es,standard
athlete.two@example.com,Luis Gomez,+584124445566,member,3x Week,true,2026-10-15,es,standard
coach.one@example.com,Carla Ruiz,+584127778899,coach,Unlimited,true,,es,standard
`;

export function hqImportTemplate(kind: HqImportKind): { filename: string; csv: string } {
  if (kind === 'plans') {
    return { filename: 'wodus-import-plans.csv', csv: PLAN_CSV_TEMPLATE };
  }
  return { filename: 'wodus-import-members.csv', csv: MEMBER_CSV_TEMPLATE };
}
