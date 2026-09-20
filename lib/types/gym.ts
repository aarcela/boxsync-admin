import { CurrencyType, type TenantCurrencyConfig } from '../currency';
import type { PlatformPlanId } from '../platform-plans';

export { CurrencyType };
export type { TenantCurrencyConfig };
export type { PlatformPlanId };

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  settings?: Record<string, unknown> | null;
  platform_plan?: PlatformPlanId;
  platform_plan_started_at?: string | null;
  trial_ends_at?: string | null;
  is_active?: boolean;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  ai_monthly_question_limit?: number | null;
}

export interface TenantHqStats {
  userCount: number;
  memberCount: number;
  activeMemberCount: number;
  staffCount: number;
  coachCount: number;
  adminCount: number;
  pendingPaymentCount: number;
  overMemberCap: boolean;
  trialExpired: boolean;
  trialEndsSoon: boolean;
  isActive: boolean;
  aiQuestionsUsed: number;
  aiQuestionLimit: number;
  aiCustomLimit: boolean;
}

export interface TenantWithHqStats extends Tenant {
  platform_plan: PlatformPlanId;
  stats: TenantHqStats;
}

export interface PlatformHqOverview {
  boxCount: number;
  userCount: number;
  memberCount: number;
  activeMemberCount: number;
  staffCount: number;
  mrrUsd: number;
  pendingPaymentCount: number;
  overCapCount: number;
  trialCount: number;
  expiredTrialCount: number;
  solvencyRate: number;
  planCounts: Record<PlatformPlanId, number>;
}

export type HqFinancialPeriod = 'today' | 'week' | 'month' | 'custom';

export type HqTenantPayStatus = 'trial' | 'paid' | 'unpaid' | 'pending';

export interface HqFinancialSeriesPoint {
  month: string;
  collectedUsd: number;
  otherIncomeUsd: number;
  incomeUsd: number;
  expensesUsd: number;
  netUsd: number;
}

export interface HqMethodMix {
  label: string;
  usd: number;
  count: number;
}

export interface HqCategoryMix {
  category: string;
  usd: number;
  count: number;
}

export interface HqTenantFinancialRow {
  id: string;
  name: string;
  slug: string;
  platform_plan: PlatformPlanId;
  isActive: boolean;
  monthlyFeeUsd: number;
  collectedUsd: number;
  payStatus: HqTenantPayStatus;
  lastPaidAt: string | null;
  paymentCount: number;
}

export interface HqFinancialOverview {
  expectedMrrUsd: number;
  collectedUsd: number;
  otherIncomeUsd: number;
  incomeUsd: number;
  expensesUsd: number;
  netUsd: number;
  marginPct: number;
  unpaidCount: number;
  unpaidUsd: number;
  pendingCount: number;
  trialCount: number;
  paidBoxCount: number;
  boxCount: number;
}

export interface HqLedgerPayment {
  id: string;
  tenant_id: string;
  tenant_name: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  method: string;
  period_start: string;
  notes: string | null;
  created_at: string;
}

export interface HqLedgerIncome {
  id: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  income_date: string;
  status: string;
  notes: string | null;
}

export interface HqLedgerExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  expense_date: string;
  status: string;
  notes: string | null;
}

export interface HqFinancialsPayload {
  period: HqFinancialPeriod;
  start: string;
  end: string;
  overview: HqFinancialOverview;
  series: HqFinancialSeriesPoint[];
  methodMix: HqMethodMix[];
  expenseMix: HqCategoryMix[];
  tenants: HqTenantFinancialRow[];
  payments: HqLedgerPayment[];
  incomes: HqLedgerIncome[];
  expenses: HqLedgerExpense[];
}

export interface HqTenantFinancialDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    platform_plan: PlatformPlanId;
    isActive: boolean;
    monthlyFeeUsd: number;
  };
  period: HqFinancialPeriod;
  start: string;
  end: string;
  collectedUsd: number;
  payStatus: HqTenantPayStatus;
  lastPaidAt: string | null;
  series: HqFinancialSeriesPoint[];
  payments: HqLedgerPayment[];
}

export const HQ_EXPENSE_CATEGORIES = [
  'Hosting',
  'Tools',
  'Staff',
  'Marketing',
  'Legal',
  'Travel',
  'Other',
] as const;

export type HqExpenseCategory = (typeof HQ_EXPENSE_CATEGORIES)[number];

export const HQ_INCOME_CATEGORIES = [
  'services',
  'income_adjustments',
  'other_income',
] as const;

export type HqIncomeCategory = (typeof HQ_INCOME_CATEGORIES)[number];

export type PaymentMethodType = 'pago_movil' | 'zelle' | 'binance' | 'efectivo' | 'otro';

/** Structured field keys per method_type — see PAYMENT_METHOD_FIELD_DEFS in payment-method-fields.ts */
export type PaymentMethodFields = Record<string, string>;

export interface PaymentMethod {
  id: string;
  label: string;
  currency: string;
  method_type: PaymentMethodType;
  fields: PaymentMethodFields;
  /** Legacy free-text details — still used when method_type === 'otro'. */
  details: string | null;
  is_active: boolean;
  tenant_id?: string;
  created_at: string;
}

export interface ClassTypeRow {
  id: string;
  tenant_id: string;
  name: string;
  color_hex: string;
  default_duration_min: number;
  is_open_box: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type ClassTypeInput = Omit<ClassTypeRow, 'id' | 'created_at' | 'tenant_id'>;

export type PlanLimitType = 'weekly' | 'period' | 'none';

export interface MembershipPlan {
  id: string;
  name: string;
  price_usd: number;
  description: string | null;
  is_active: boolean;
  weekly_limit: number | null;
  limit_type: PlanLimitType;
  session_limit: number | null;
  validity_days: number | null;
  tenant_id: string;
  created_at: string;
}

export interface MembershipPlanWithUsage extends MembershipPlan {
  member_count: number;
}

export type MembershipPlanInput = Omit<MembershipPlan, 'id' | 'created_at' | 'tenant_id'>;

/** Default unlimited plan seeded when a new box (tenant) is provisioned. */
export const DEFAULT_UNLIMITED_MEMBERSHIP_PLAN: MembershipPlanInput = {
  name: 'Unlimited',
  price_usd: 80,
  description: null,
  is_active: true,
  weekly_limit: null,
  limit_type: 'none',
  session_limit: null,
  validity_days: null,
};

export interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  payment_method_id?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  proof_image_url: string;
  rejection_reason?: string | null;
  created_at: string;
  user_id: string;
  currency: string;
  /** Legacy compatibility for older API payloads. */
  currency_type?: string;
  exchange_rate_at_time?: number | null;
  exchange_rate_source?: string | null;
  reference_currency_amount?: number | null;
  plan_period_start?: string | null;
  profiles: {
    full_name: string | null;
  } | null;
}

export interface CurrencyStats {
  totalRevenue: number;
  pendingAmount: number;
  pendingCount: number;
  cashAmount: number;
  methodCounts: Record<string, number>;
}

export interface FinancialStats {
  reference: CurrencyStats;
  local: CurrencyStats;
  activeMembers: number;
  inactiveMembers: number;
  projectedRevenueREF: number;
  projectedRevenueVES: number;
  overdueAmountREF: number;
  solvencyRate: number;
}

export type BookingStatus = 'booked' | 'attended' | 'no_show';

export interface Booking {
  id: string;
  status: BookingStatus;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface WaitlistEntry {
  id: string;
  joined_at: string;
  status: 'active' | 'promoted' | 'cancelled' | 'ineligible';
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface CapacityInsight {
  id: string;
  kind: 'low_occupancy' | 'no_show' | 'high_demand';
  title: string;
  detail: string;
  sampleSize: number;
}

/** Legacy slug values; athletes now use membership_plans.id (UUID). */
export type AthletePlan = string;
export type InscriptionPlan = 'standard' | 'promo' | 're-entry' | 'founder';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  /** True when the auth user has not confirmed email / finished welcome setup. */
  invite_pending?: boolean;
  phone: string;
  role: 'member' | 'coach' | 'manager' | 'admin';
  is_solvent: boolean;
  plan: AthletePlan;
  plan_period_start?: string | null;
  plan_name?: string;
  inscription_plan: InscriptionPlan;
  inscription_paid: boolean;
  created_at: string;
  avatar_url: string | null;
  qr_code?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  level?: string | null;
  crossfit_years?: number | null;
  home_box?: string | null;
  has_allergies?: boolean | null;
  allergies_text?: string | null;
  has_medical_condition?: boolean | null;
  medical_condition_text?: string | null;
  has_injury?: boolean | null;
  injury_text?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  onboarding_affidavit_accepted_at?: string | null;
  onboarding_affidavit_version?: number;
  onboarding_affidavit_truth?: boolean;
  onboarding_affidavit_fit?: boolean;
  onboarding_affidavit_release?: boolean;
  onboarding_affidavit_terms?: boolean;
  instagram?: string | null;
  admin_note?: string | null;
  inscription_cost?: number;
  discount?: number | null;
  salary_tier_id?: string | null;
  bookings?: { 
    id: string;
    status: string; 
    created_at: string;
    classes?: {
      class_type: string;
      start_time: string;
    }
  }[];
  last_payment_date?: string;
}

export type ClassSession = {
  id: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  class_type: string;
  is_cancelled: boolean;
  coach_id?: string | null;
  coach: { full_name: string } | null;
  bookings: { count: number }[];
  waitlist?: { count: number }[];
}

export const EXPENSE_CATEGORIES = [
  'Staff',
  'Rent',
  'Utilities',
  'Maintenance',
  'Services',
  'Marketing',
  'Taxes',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpenseRecord {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  exchange_rate_at_time: number;
  expense_date: string;
  created_at: string;
  created_by?: string;
  status: 'pending' | 'paid' | 'due';
  payment_method: string;
}

export type IncomeCategory =
  | 'merchandise_sales'
  | 'supplement_sales'
  | 'food_beverage_sales'
  | 'workshops_seminars'
  | 'events_competitions'
  | 'space_rental'
  | 'sponsorships'
  | 'income_adjustments'
  | 'other_income';

export type IncomeStatus = 'pending' | 'confirmed' | 'cancelled';

export interface IncomeRecord {
  id: string;
  description: string;
  category: IncomeCategory;
  amount: number;
  currency: string;
  exchange_rate_at_time: number;
  income_date: string;
  payment_method?: string;
  status: IncomeStatus;
  created_by?: string;
  created_at: string;
}

export interface ProfitabilityStats {
  totalRevenueREF: number;
  totalExpensesREF: number;
  netProfitREF: number;
  profitMargin: number;
  breakEvenREF: number;
  fixedCostsREF: number;
  variableCostsREF: number;
}

export interface CoachSalaryTier {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  rates?: CoachSalaryTierRate[];
}

export interface CoachSalaryTierRate {
  id: string;
  tier_id: string;
  class_type: string;
  rate_usd: number;
  tenant_id: string;
}

export interface CoachWithSalaryTier {
  id: string;
  full_name: string;
  role: Profile['role'];
  salary_tier_id: string | null;
  salary_tier?: { id: string; name: string } | null;
}

export type PayrollClassStatus = 'confirmed' | 'pending' | 'cancelled';

export interface PayrollClass {
  id: string;
  start_time: string;
  end_time: string;
  class_type: string;
  is_cancelled: boolean;
  payroll_confirmed: boolean;
  coach_id: string | null;
  coach: {
    id: string;
    full_name: string;
    salary_tier_id: string | null;
    email?: string | null;
  } | null;
  bookings: { count: number }[];
  payrollStatus?: PayrollClassStatus;
  payRateUsd?: number | null;
}
