-- Wodus HQ ledger: tenant SaaS payments + platform incomes/expenses.
-- Not box athlete payments. Service-role only (HQ APIs).

CREATE TABLE IF NOT EXISTS public.platform_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'approved',
  method text,
  period_start date NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_payments_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS platform_payments_tenant_idx
  ON public.platform_payments (tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS platform_payments_period_idx
  ON public.platform_payments (period_start DESC);

CREATE TABLE IF NOT EXISTS public.platform_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'other_income',
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  income_date date NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_incomes_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS platform_incomes_date_idx
  ON public.platform_incomes (income_date DESC);

CREATE TABLE IF NOT EXISTS public.platform_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  expense_date date NOT NULL,
  status text NOT NULL DEFAULT 'paid',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_expenses_status_check
    CHECK (status IN ('pending', 'paid', 'due'))
);

CREATE INDEX IF NOT EXISTS platform_expenses_date_idx
  ON public.platform_expenses (expense_date DESC);

ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;
