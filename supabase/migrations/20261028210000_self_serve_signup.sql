-- Self-serve gym signup, setup progress, product events, trial lifecycle.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS signup_source text NOT NULL DEFAULT 'hq',
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_staff_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactive_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_extended_days integer NOT NULL DEFAULT 0;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_signup_source_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_signup_source_check
  CHECK (signup_source IN ('hq', 'self_serve'));

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_trial_extended_days_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_trial_extended_days_check
  CHECK (trial_extended_days >= 0 AND trial_extended_days <= 3650);

CREATE TABLE IF NOT EXISTS public.tenant_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_user_id uuid,
  owner_name text NOT NULL,
  email text NOT NULL,
  phone_e164 text,
  instagram text,
  city text,
  ip_hash text,
  user_agent text,
  captcha_ok boolean NOT NULL DEFAULT false,
  possible_duplicate boolean NOT NULL DEFAULT false,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_signups_email_lower_idx
  ON public.tenant_signups (lower(email));
CREATE INDEX IF NOT EXISTS tenant_signups_phone_e164_idx
  ON public.tenant_signups (phone_e164);
CREATE INDEX IF NOT EXISTS tenant_signups_instagram_idx
  ON public.tenant_signups (lower(instagram));
CREATE INDEX IF NOT EXISTS tenant_signups_tenant_id_idx
  ON public.tenant_signups (tenant_id);

ALTER TABLE public.tenant_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_signups FROM anon, authenticated;
GRANT ALL ON public.tenant_signups TO service_role;

CREATE TABLE IF NOT EXISTS public.tenant_setup_progress (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_setup_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_setup_progress_select_admin ON public.tenant_setup_progress;
CREATE POLICY tenant_setup_progress_select_admin ON public.tenant_setup_progress
  FOR SELECT TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_admin_staff());

DROP POLICY IF EXISTS tenant_setup_progress_update_admin ON public.tenant_setup_progress;
CREATE POLICY tenant_setup_progress_update_admin ON public.tenant_setup_progress
  FOR UPDATE TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_admin_staff())
  WITH CHECK (public.same_tenant(tenant_id) AND public.is_tenant_admin_staff());

DROP POLICY IF EXISTS tenant_setup_progress_insert_admin ON public.tenant_setup_progress;
CREATE POLICY tenant_setup_progress_insert_admin ON public.tenant_setup_progress
  FOR INSERT TO authenticated
  WITH CHECK (public.same_tenant(tenant_id) AND public.is_tenant_admin_staff());

GRANT SELECT, INSERT, UPDATE ON public.tenant_setup_progress TO authenticated;
REVOKE DELETE ON public.tenant_setup_progress FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid,
  name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_events_name_created_idx
  ON public.product_events (name, created_at DESC);
CREATE INDEX IF NOT EXISTS product_events_tenant_idx
  ON public.product_events (tenant_id, created_at DESC);

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_events FROM anon, authenticated;
GRANT ALL ON public.product_events TO service_role;

CREATE OR REPLACE FUNCTION public.auth_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO auth, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.auth_email_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_exists(text) TO service_role;

CREATE OR REPLACE FUNCTION public.maybe_activate_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  already timestamptz;
  has_class boolean;
  has_member boolean;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT activated_at INTO already
  FROM public.tenants
  WHERE id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND OR already IS NOT NULL THEN
    RETURN already IS NOT NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.classes c WHERE c.tenant_id = p_tenant_id
  ) INTO has_class;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.tenant_id = p_tenant_id AND p.role = 'member'
  ) INTO has_member;

  IF has_class AND has_member THEN
    UPDATE public.tenants
    SET activated_at = now()
    WHERE id = p_tenant_id AND activated_at IS NULL;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_activate_tenant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_activate_tenant(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_maybe_activate_from_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  PERFORM public.maybe_activate_tenant(NEW.tenant_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_maybe_activate_from_class ON public.classes;
CREATE TRIGGER tr_maybe_activate_from_class
  AFTER INSERT ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_maybe_activate_from_class();

CREATE OR REPLACE FUNCTION public.trg_maybe_activate_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.role = 'member' AND NEW.tenant_id IS NOT NULL THEN
    PERFORM public.maybe_activate_tenant(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_maybe_activate_from_profile ON public.profiles;
CREATE TRIGGER tr_maybe_activate_from_profile
  AFTER INSERT OR UPDATE OF role, tenant_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_maybe_activate_from_profile();

CREATE OR REPLACE FUNCTION public.tenant_member_bookings_allowed(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT NOT (
        t.platform_plan = 'trial'
        AND t.trial_ends_at IS NOT NULL
        AND now() > t.trial_ends_at + interval '7 days'
      )
      FROM public.tenants t
      WHERE t.id = p_tenant_id
    ),
    true
  );
$$;

GRANT EXECUTE ON FUNCTION public.tenant_member_bookings_allowed(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.class_booking_window_error(
  class_row_id uuid,
  kind text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  class_start timestamptz;
  tenant_uuid uuid;
  settings_bag jsonb;
  minutes_before integer;
  booking_bag jsonb;
BEGIN
  SELECT c.start_time, c.tenant_id
  INTO class_start, tenant_uuid
  FROM public.classes c
  WHERE c.id = class_row_id;

  IF NOT FOUND THEN
    RETURN 'Class not found.';
  END IF;

  IF kind IS DISTINCT FROM 'cancel'
     AND NOT public.tenant_member_bookings_allowed(tenant_uuid) THEN
    RETURN 'tenant_updating';
  END IF;

  SELECT t.settings INTO settings_bag
  FROM public.tenants t
  WHERE t.id = tenant_uuid;

  booking_bag := CASE
    WHEN settings_bag IS NULL THEN '{}'::jsonb
    ELSE COALESCE(settings_bag -> 'booking', '{}'::jsonb)
  END;

  IF kind = 'cancel' THEN
    minutes_before := COALESCE(
      NULLIF(booking_bag ->> 'cancelClosesMinutesBefore', '')::integer,
      60
    );
  ELSE
    minutes_before := COALESCE(
      NULLIF(booking_bag ->> 'bookClosesMinutesBefore', '')::integer,
      0
    );
  END IF;

  IF minutes_before < 0 THEN
    minutes_before := 0;
  END IF;

  IF class_start <= now() + make_interval(mins => minutes_before) THEN
    IF kind = 'cancel' THEN
      IF minutes_before <= 0 THEN
        RETURN 'You cannot cancel a class that has already started.';
      END IF;
      RETURN format(
        'Cancellations are only allowed up to %s minutes before class.',
        minutes_before
      );
    END IF;

    IF minutes_before <= 0 THEN
      RETURN 'You cannot book a class that has already started.';
    END IF;
    RETURN format(
      'Booking closes %s minutes before class starts.',
      minutes_before
    );
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_staff_trial_readonly()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  tid uuid;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT public.is_tenant_staff() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'tenants' THEN
    tid := COALESCE(NEW.id, OLD.id);
  ELSE
    tid := COALESCE(NEW.tenant_id, OLD.tenant_id);
  END IF;

  IF tid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tid
      AND t.platform_plan = 'trial'
      AND t.trial_ends_at IS NOT NULL
      AND t.trial_ends_at < now()
  ) THEN
    RAISE EXCEPTION 'trial_readonly'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants',
    'profiles',
    'classes',
    'class_types',
    'payment_methods',
    'membership_plans',
    'bookings',
    'wods',
    'news',
    'posts',
    'guest_athletes',
    'guest_bookings',
    'class_waitlist',
    'payments',
    'incomes',
    'expenses',
    'pr_movements',
    'personal_records',
    'coach_salary_tiers',
    'coach_salary_tier_rates',
    'post_likes',
    'post_comments',
    'feedback',
    'coach_feedback',
    'member_interventions',
    'intervention_events',
    'box_settings',
    'checkin_overrides',
    'tenant_setup_progress'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS tr_prevent_staff_trial_readonly ON public.%I',
        t
      );
      EXECUTE format(
        'CREATE TRIGGER tr_prevent_staff_trial_readonly
           BEFORE INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW
           EXECUTE FUNCTION public.prevent_staff_trial_readonly()',
        t
      );
    END IF;
  END LOOP;
END $$;
