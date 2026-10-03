-- Push notification infrastructure: device tokens, an outbox for events that
-- happen inside DB functions we don't control (waitlist promotion), and the
-- bookkeeping columns needed for payment-rejection reasons and expiry-reminder
-- de-duplication.

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_tokens_own ON public.push_tokens;
CREATE POLICY push_tokens_own ON public.push_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_expiry_reminder_sent_at timestamptz;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Fires on the RESULT of any update to class_waitlist.status, regardless of
-- what wrote it — safe to add without touching the (unseen, live-only)
-- function that actually performs waitlist promotion.
CREATE OR REPLACE FUNCTION public.enqueue_waitlist_promotion_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'promoted' AND OLD.status IS DISTINCT FROM 'promoted' THEN
    INSERT INTO public.notification_outbox (user_id, kind, payload)
    VALUES (NEW.user_id, 'waitlist_promoted', jsonb_build_object('class_id', NEW.class_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_waitlist_promotion_notify ON public.class_waitlist;
CREATE TRIGGER tr_waitlist_promotion_notify
  AFTER UPDATE ON public.class_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_waitlist_promotion_notification();

COMMIT;
