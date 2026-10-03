-- Structured payment method templates (Pago Móvil, Zelle, Binance Pay ID, Efectivo)
-- Additive only: existing rows default to method_type='otro', which keeps using the
-- pre-existing free-text `details` column, so no backfill is required.

BEGIN;

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS method_type text NOT NULL DEFAULT 'otro',
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.payment_methods
  DROP CONSTRAINT IF EXISTS payment_methods_method_type_check;

ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_method_type_check
  CHECK (method_type IN ('pago_movil', 'zelle', 'binance', 'efectivo', 'otro'));

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.payment_methods(id);

COMMIT;
