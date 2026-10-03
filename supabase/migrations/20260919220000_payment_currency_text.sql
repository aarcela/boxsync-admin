-- Allow any ISO-like currency code on payment rails (COP, custom, etc.).
ALTER TABLE public.payment_methods
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN currency TYPE text USING currency::text,
  ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE public.payments
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN currency TYPE text USING currency::text,
  ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE public.expenses
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN currency TYPE text USING currency::text,
  ALTER COLUMN currency SET DEFAULT 'USD';

DROP TYPE IF EXISTS public.currency_type;
