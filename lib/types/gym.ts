export enum CurrencyType {
  EUR = 'EUR',
  VES = 'VES',
}

export interface PaymentMethod {
  id: string;
  label: string;
  currency: CurrencyType;
  details: string | null;
  is_active: boolean;
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
  inscription_plan: InscriptionPlan;
  inscription_paid: boolean;
  created_at: string;
  avatar_url: string | null;
  discount?: number | null;
  bookings?: { status: string; created_at: string }[];
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

export interface ProfitabilityStats {
  totalRevenueEUR: number;
  totalExpensesEUR: number;
  netProfitEUR: number;
  profitMargin: number;
  breakEvenEUR: number;
  fixedCostsEUR: number;
  variableCostsEUR: number;
}
