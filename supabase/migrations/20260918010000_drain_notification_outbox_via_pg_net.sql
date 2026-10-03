-- Hobby Vercel cannot run */5 crons. After a waitlist promotion lands in
-- notification_outbox, Postgres POSTs to the existing drain route via pg_net.
--
-- One-time Vault secrets (Dashboard → Database → Vault, or SQL editor):
--   select vault.create_secret(
--     'https://hq.getwodus.com/api/admin/cron/notifications',
--     'notification_drain_url'
--   );
--   select vault.create_secret(
--     '<same value as Vercel CRON_SECRET>',
--     'notification_drain_secret'
--   );
-- If notification_drain_url is omitted, the trigger uses the HQ URL above.

BEGIN;

-- Wodus never received 20260906120200; create the outbox if this file is run alone.
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.request_notification_drain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, net, vault, pg_temp
AS $$
DECLARE
  drain_url text;
  cron_secret text;
  req_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
BEGIN
  SELECT ds.decrypted_secret INTO drain_url
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'notification_drain_url'
  LIMIT 1;

  SELECT ds.decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'notification_drain_secret'
  LIMIT 1;

  drain_url := nullif(btrim(coalesce(drain_url, '')), '');
  IF drain_url IS NULL THEN
    drain_url := 'https://hq.getwodus.com/api/admin/cron/notifications';
  END IF;

  cron_secret := nullif(btrim(coalesce(cron_secret, '')), '');
  IF cron_secret IS NOT NULL THEN
    req_headers := req_headers || jsonb_build_object('Authorization', 'Bearer ' || cron_secret);
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := drain_url,
      body := jsonb_build_object('id', NEW.id),
      headers := req_headers,
      timeout_milliseconds := 8000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notification drain request failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.request_notification_drain() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.request_notification_drain() FROM anon, authenticated;

DROP TRIGGER IF EXISTS tr_notification_outbox_drain ON public.notification_outbox;
CREATE TRIGGER tr_notification_outbox_drain
  AFTER INSERT ON public.notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION private.request_notification_drain();

COMMIT;
