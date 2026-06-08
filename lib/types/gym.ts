export enum CurrencyType {
  EUR = 'EUR',
  VES = 'VES',
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  label: string;
  currency: CurrencyType;
  details: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  price_usd: number;
  description: string | null;
  is_active: boolean;
  weekly_limit: number | null;
  tenant_id: string;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  proof_image_url: string;
  created_at: string;
  user_id: string;
  currency_type: string;
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
  EUR: CurrencyStats;
  VES: CurrencyStats;
  activeMembers: number;
  inactiveMembers: number;
  projectedRevenueEUR: number;
  projectedRevenueVES: number;
  overdueAmountEUR: number;
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

export type AthletePlan = 'unlimited' | '3x_week' | '4x_week' | '5x_week' | 'open_box' | 'crossfit_kids';
export type InscriptionPlan = 'standard' | 'promo' | 're-entry' | 'founder';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'member' | 'coach' | 'manager' | 'admin';
  is_solvent: boolean;
  plan: AthletePlan;
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
  coach: { full_name: string } | null;
  bookings: { count: number }[];
}

export type ExpenseCategory = 
  | 'Staff' 
  | 'Rent' 
  | 'Utilities' 
  | 'Maintenance' 
  | 'Services' 
  | 'Marketing' 
  | 'Taxes' 
  | 'Other';

export interface ExpenseRecord {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  currency: CurrencyType;
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
  currency: CurrencyType;
  exchange_rate_at_time: number;
  income_date: string;
  payment_method?: string;
  status: IncomeStatus;
  created_by?: string;
  created_at: string;
}

export interface ProfitabilityStats {
  totalRevenueEUR: number;
  totalExpensesEUR: number;
  netProfitEUR: number;
  profitMargin: number;
  breakEvenEUR: number;
  fixedCostsEUR: number;
  variableCostsEUR: number;
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
