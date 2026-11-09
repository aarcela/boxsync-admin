-- Per-tenant check-in QR codes with legacy lobby/join QR compatibility.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_tenant_checkin_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT rtrim(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/', '-_'), '=');
$$;

CREATE TABLE IF NOT EXISTS public.tenant_checkin_codes (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  accept_legacy_qr boolean NOT NULL DEFAULT false,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  rotated_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_checkin_codes_code_uidx
  ON public.tenant_checkin_codes (code);

ALTER TABLE public.tenant_checkin_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tenant_checkin_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tenant_checkin_codes TO authenticated;

DROP POLICY IF EXISTS tenant_checkin_codes_select_staff ON public.tenant_checkin_codes;
CREATE POLICY tenant_checkin_codes_select_staff ON public.tenant_checkin_codes
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_staff()
  );

INSERT INTO public.tenant_checkin_codes (tenant_id, code, accept_legacy_qr)
SELECT
  t.id,
  public.generate_tenant_checkin_code(),
  (t.signup_source IS DISTINCT FROM 'self_serve')
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_checkin_codes c WHERE c.tenant_id = t.id
);

CREATE OR REPLACE FUNCTION public.create_tenant_checkin_code_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_attempt int := 0;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    v_code := public.generate_tenant_checkin_code();
    BEGIN
      INSERT INTO public.tenant_checkin_codes (tenant_id, code, accept_legacy_qr)
      VALUES (NEW.id, v_code, false);
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt >= 8 THEN
          RAISE;
        END IF;
    END;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_create_checkin_code ON public.tenants;
CREATE TRIGGER tenants_create_checkin_code
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_tenant_checkin_code_row();

CREATE OR REPLACE FUNCTION public.rotate_checkin_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_code text;
  v_attempt int := 0;
BEGIN
  IF NOT public.is_tenant_admin_staff() OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := public.generate_tenant_checkin_code();
    BEGIN
      UPDATE public.tenant_checkin_codes
      SET
        code = v_code,
        rotated_at = now(),
        rotated_by = auth.uid()
      WHERE tenant_id = v_tenant;

      IF NOT FOUND THEN
        INSERT INTO public.tenant_checkin_codes (tenant_id, code, accept_legacy_qr, rotated_by)
        VALUES (v_tenant, v_code, false, auth.uid());
      END IF;

      RETURN v_code;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt >= 8 THEN
          RAISE;
        END IF;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_accept_legacy_qr(p_value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
BEGIN
  IF NOT public.is_tenant_admin_staff() OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.tenant_checkin_codes
  SET accept_legacy_qr = COALESCE(p_value, false)
  WHERE tenant_id = v_tenant;

  IF NOT FOUND THEN
    INSERT INTO public.tenant_checkin_codes (tenant_id, code, accept_legacy_qr)
    VALUES (v_tenant, public.generate_tenant_checkin_code(), COALESCE(p_value, false));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_in_athlete(qr_payload text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_member_tenant uuid;
  v_member_slug text;
  v_tenant_name text;
  v_scanned_tenant uuid;
  v_payload text := trim(COALESCE(qr_payload, ''));
  v_code text;
  v_slug text;
  v_accept_legacy boolean := false;
  v_booking_id uuid;
  v_booking_status text;
  v_class_id uuid;
  pay jsonb;
BEGIN
  IF v_uid IS NULL OR v_payload = '' THEN
    RETURN json_build_object(
      'status', 'error',
      'code', 'invalid_qr',
      'message', 'QR no válido'
    );
  END IF;

  SELECT p.tenant_id, t.slug, t.name
  INTO v_member_tenant, v_member_slug, v_tenant_name
  FROM public.profiles p
  JOIN public.tenants t ON t.id = p.tenant_id
  WHERE p.id = v_uid;

  IF v_member_tenant IS NULL THEN
    RETURN json_build_object(
      'status', 'error',
      'code', 'invalid_qr',
      'message', 'QR no válido'
    );
  END IF;

  -- New per-tenant check-in URL or bare code (preserve code casing)
  IF v_payload ~* '^https?://(www\.)?getwodus\.com/checkin/[^/?#]+' THEN
    v_code := (regexp_match(v_payload, 'getwodus\.com/checkin/([^/?#]+)', 'i'))[1];
  ELSIF v_payload ~ '^[A-Za-z0-9_-]{16}$' THEN
    v_code := v_payload;
  END IF;

  IF v_code IS NOT NULL THEN
    SELECT c.tenant_id INTO v_scanned_tenant
    FROM public.tenant_checkin_codes c
    WHERE c.code = v_code;
  ELSE
    -- Legacy lobby string
    IF v_payload = 'PITS_LOBBY_ACCESS' THEN
      SELECT c.accept_legacy_qr INTO v_accept_legacy
      FROM public.tenant_checkin_codes c
      WHERE c.tenant_id = v_member_tenant;

      IF COALESCE(v_accept_legacy, false) THEN
        v_scanned_tenant := v_member_tenant;
      END IF;
    ELSE
      -- Join deep link / HTTPS join URL whose slug matches the member's gym
      IF v_payload ~* '^boxwaveapp://join' THEN
        IF v_payload ~* 'slug=' THEN
          v_slug := lower((regexp_match(v_payload, '[?&]slug=([^&#]+)', 'i'))[1]);
        ELSE
          v_slug := lower((regexp_match(v_payload, 'boxwaveapp://join/([^/?#]+)', 'i'))[1]);
        END IF;
      ELSIF v_payload ~* '^https?://(www\.)?getwodus\.com/join/[^/?#]+' THEN
        v_slug := lower((regexp_match(v_payload, 'getwodus\.com/join/([^/?#]+)', 'i'))[1]);
      END IF;

      IF v_slug IS NOT NULL THEN
        v_slug := nullif(trim(both from replace(replace(v_slug, '%20', '-'), '+', '-')), '');
      END IF;

      IF v_slug IS NOT NULL AND v_slug = lower(v_member_slug) THEN
        SELECT c.accept_legacy_qr INTO v_accept_legacy
        FROM public.tenant_checkin_codes c
        WHERE c.tenant_id = v_member_tenant;

        IF COALESCE(v_accept_legacy, false) THEN
          v_scanned_tenant := v_member_tenant;
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_scanned_tenant IS NULL THEN
    RETURN json_build_object(
      'status', 'error',
      'code', 'invalid_qr',
      'message', 'QR no válido',
      'tenant_name', v_tenant_name
    );
  END IF;

  IF v_scanned_tenant IS DISTINCT FROM v_member_tenant THEN
    RETURN json_build_object(
      'status', 'error',
      'code', 'wrong_gym',
      'message', 'Este QR es de otro gym',
      'tenant_name', v_tenant_name
    );
  END IF;

  pay := private.member_payment_status(v_member_tenant, v_uid);
  IF COALESCE((pay ->> 'checkin_blocked')::boolean, false) THEN
    RETURN json_build_object(
      'status', 'error',
      'code', 'blocked_overdue',
      'message', 'Membresía vencida. Debes pagar para marcar asistencia.',
      'tenant_name', v_tenant_name,
      'payment_status', pay
    );
  END IF;

  SELECT b.id, b.status::text, b.class_id
  INTO v_booking_id, v_booking_status, v_class_id
  FROM public.bookings b
  JOIN public.classes c ON c.id = b.class_id
  WHERE b.tenant_id = v_member_tenant
    AND b.user_id = v_uid
    AND COALESCE(c.is_cancelled, false) = false
    AND c.start_time BETWEEN now() - interval '30 minutes' AND now() + interval '30 minutes'
  ORDER BY abs(extract(epoch FROM (c.start_time - now())))
  LIMIT 1;

  IF v_booking_id IS NULL OR v_booking_status NOT IN ('booked', 'attended') THEN
    RETURN json_build_object(
      'status', 'error',
      'code', 'no_booking',
      'message', 'No tienes una reserva para esta hora',
      'tenant_name', v_tenant_name,
      'payment_status', pay
    );
  END IF;

  IF v_booking_status = 'attended' THEN
    RETURN json_build_object(
      'status', 'error',
      'code', 'already_checked_in',
      'message', 'Ya marcaste asistencia',
      'tenant_name', v_tenant_name,
      'class_id', v_class_id,
      'payment_status', pay
    );
  END IF;

  UPDATE public.bookings
  SET status = 'attended'
  WHERE id = v_booking_id
    AND status = 'booked';

  RETURN json_build_object(
    'status', 'success',
    'code', 'ok',
    'message', format('¡Bienvenido a %s! Asistencia marcada.', v_tenant_name),
    'tenant_name', v_tenant_name,
    'class_id', v_class_id,
    'payment_status', pay
  );
END;
$$;

DROP FUNCTION IF EXISTS public.check_in_athlete_core(text);

REVOKE ALL ON FUNCTION public.rotate_checkin_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_accept_legacy_qr(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_in_athlete(text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.generate_tenant_checkin_code() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rotate_checkin_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_accept_legacy_qr(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_athlete(text) TO authenticated;
