import type { PlanLimitType } from '@/lib/types/gym';
import type { ProfileRole } from '@/lib/auth';
import type { Language } from '@/lib/translations';
import type { InscriptionPlan } from '@/lib/types/gym';
import type { HqImportKind } from './templates';

export type HqImportAction = 'create' | 'skip' | 'error';

export type HqImportIssue = {
  line: number;
  message: string;
};

export type HqImportRowPreview = {
  line: number;
  action: HqImportAction;
  label: string;
  issues: string[];
};

export type HqImportSummary = {
  kind: HqImportKind;
  rowCount: number;
  createCount: number;
  skipCount: number;
  errorCount: number;
  canCommit: boolean;
  issues: HqImportIssue[];
  rows: HqImportRowPreview[];
  blockingErrors: string[];
};

export type ValidatedPlanRow = {
  line: number;
  action: 'create' | 'skip';
  name: string;
  price_usd: number;
  limit_type: PlanLimitType;
  weekly_limit: number | null;
  session_limit: number | null;
  validity_days: number | null;
  is_active: boolean;
  description: string | null;
};

export type ValidatedMemberRow = {
  line: number;
  action: 'create' | 'skip';
  email: string;
  full_name: string;
  phone: string | null;
  role: Exclude<ProfileRole, 'admin'>;
  plan_id: string;
  plan_name: string;
  is_solvent: boolean;
  plan_period_start: string | null;
  language: Language;
  inscription_plan: InscriptionPlan;
};

export type PlansValidationResult = {
  summary: HqImportSummary;
  creates: ValidatedPlanRow[];
};

export type MembersValidationResult = {
  summary: HqImportSummary;
  creates: ValidatedMemberRow[];
};
