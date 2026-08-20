-- Consolidated, idempotent fixes identified by SUPABASE_SCHEMA_EXPORT.sql.
-- This intentionally includes only the audited tenant defects.

BEGIN;

-- Prevent the duplicate WOD trigger from replacing an explicit/profile-derived
-- tenant with a missing JWT claim, then ensure every tenant table has the
-- standard profile-derived trigger.
DROP TRIGGER IF EXISTS tr_set_tenant_id_wods ON public.wods;

CREATE OR REPLACE FUNCTION public.set_tenant_id_from_profile() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO public
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  NEW.tenant_id := public.current_tenant_id();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_tenant_id_from_jwt() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  NEW.tenant_id := public.tenant_id();
  RETURN NEW;
END;
$$;

SELECT public.sync_tenant_id_triggers();

-- A WOD date is unique within a tenant, not globally.
ALTER TABLE public.wods DROP CONSTRAINT IF EXISTS wods_date_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wods_tenant_date_key'
      AND conrelid = 'public.wods'::regclass
  ) THEN
    ALTER TABLE public.wods
      ADD CONSTRAINT wods_tenant_date_key UNIQUE (tenant_id, date);
  END IF;
END $$;

-- box_settings keys are tenant-local. Existing single-tenant rows are assigned
-- only when a tenant exists; the PK conversion waits until every row is scoped.
UPDATE public.box_settings
SET tenant_id = (
  SELECT t.id
  FROM public.tenants t
  ORDER BY t.created_at
  LIMIT 1
)
WHERE tenant_id IS NULL
  AND EXISTS (SELECT 1 FROM public.tenants);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.box_settings WHERE tenant_id IS NULL)
    AND EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'box_settings_pkey'
        AND conrelid = 'public.box_settings'::regclass
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conname = 'box_settings_pkey'
        AND c.conrelid = 'public.box_settings'::regclass
        AND a.attname = 'tenant_id'
    )
  THEN
    ALTER TABLE public.box_settings DROP CONSTRAINT box_settings_pkey;
    ALTER TABLE public.box_settings ADD PRIMARY KEY (tenant_id, key);
  END IF;
END $$;

ALTER TABLE public.box_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS box_settings_select_staff ON public.box_settings;
CREATE POLICY box_settings_select_staff ON public.box_settings
  FOR SELECT TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_staff());

DROP POLICY IF EXISTS box_settings_insert_admin ON public.box_settings;
CREATE POLICY box_settings_insert_admin ON public.box_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_admin_staff()
    AND public.insert_tenant_allowed(tenant_id)
  );

DROP POLICY IF EXISTS box_settings_update_admin ON public.box_settings;
CREATE POLICY box_settings_update_admin ON public.box_settings
  FOR UPDATE TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_admin_staff())
  WITH CHECK (public.insert_tenant_allowed(tenant_id));

DROP POLICY IF EXISTS box_settings_delete_admin ON public.box_settings;
CREATE POLICY box_settings_delete_admin ON public.box_settings
  FOR DELETE TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_admin_staff());

-- post_comments had RLS enabled with no policies.
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_comments_select_tenant ON public.post_comments;
CREATE POLICY post_comments_select_tenant ON public.post_comments
  FOR SELECT TO authenticated
  USING (public.same_tenant(tenant_id));

DROP POLICY IF EXISTS post_comments_insert_own ON public.post_comments;
CREATE POLICY post_comments_insert_own ON public.post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.insert_tenant_allowed(tenant_id)
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS post_comments_update_own_or_staff ON public.post_comments;
CREATE POLICY post_comments_update_own_or_staff ON public.post_comments
  FOR UPDATE TO authenticated
  USING (
    public.same_tenant(tenant_id)
    AND (user_id = auth.uid() OR public.is_tenant_staff())
  )
  WITH CHECK (public.insert_tenant_allowed(tenant_id));

DROP POLICY IF EXISTS post_comments_delete_own_or_staff ON public.post_comments;
CREATE POLICY post_comments_delete_own_or_staff ON public.post_comments
  FOR DELETE TO authenticated
  USING (
    public.same_tenant(tenant_id)
    AND (user_id = auth.uid() OR public.is_tenant_staff())
  );

-- Authenticated users see only their tenant. Anonymous slug lookup remains
-- available for the pre-authentication tenant login flow.
DROP POLICY IF EXISTS tenants_select_own ON public.tenants;
DROP POLICY IF EXISTS tenants_select_authenticated ON public.tenants;
DROP POLICY IF EXISTS tenants_select_anon ON public.tenants;

CREATE POLICY tenants_select_authenticated ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());

CREATE POLICY tenants_select_anon ON public.tenants
  FOR SELECT TO anon
  USING (true);

-- Membership expiry must not accept a payment from another tenant.
CREATE OR REPLACE FUNCTION public.expire_monthly_memberships() RETURNS json
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO public, pg_temp
AS $$
DECLARE
  affected_rows integer := 0;
BEGIN
  UPDATE public.profiles p
  SET is_solvent = false
  WHERE p.role::text = 'member'
    AND p.is_solvent = true
    AND p.created_at < (CURRENT_DATE - INTERVAL '3 days')
    AND NOT EXISTS (
      SELECT 1
      FROM public.payments pay
      WHERE pay.user_id = p.id
        AND pay.tenant_id = p.tenant_id
        AND pay.status = 'approved'
        AND pay.created_at >= (CURRENT_DATE - INTERVAL '31 days')
    );

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN json_build_object(
    'status', 'success',
    'message', 'Processed expiry for ' || affected_rows || ' members.',
    'count', affected_rows,
    'timestamp', now()
  );
END;
$$;

-- SQL editor/service-role updates have no auth.uid(); do not let the member
-- guard revert those trusted writes.
CREATE OR REPLACE FUNCTION public.profiles_guard_member_update() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_tenant_staff() THEN
    RETURN NEW;
  END IF;

  IF NEW.id <> auth.uid() THEN
    RAISE EXCEPTION 'Members may only update their own profile';
  END IF;

  NEW.role := OLD.role;
  NEW.tenant_id := OLD.tenant_id;
  NEW.is_solvent := OLD.is_solvent;
  NEW.plan := OLD.plan;
  NEW.inscription_plan := OLD.inscription_plan;
  NEW.inscription_paid := OLD.inscription_paid;
  NEW.inscription_cost := OLD.inscription_cost;
  NEW.discount := OLD.discount;
  NEW.salary_tier_id := OLD.salary_tier_id;
  NEW.admin_note := OLD.admin_note;
  RETURN NEW;
END;
$$;

-- Tenant authorization comes only from trusted app metadata. User metadata is
-- user-editable and must never decide tenant membership.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO public, pg_temp
AS $$
DECLARE
  resolved_tenant_id uuid;
BEGIN
  resolved_tenant_id := COALESCE(
    NULLIF(new.raw_app_meta_data->>'tenant_id', '')::uuid,
    (SELECT tenant_id FROM public.profiles WHERE id = new.id)
  );

  INSERT INTO public.profiles (
    id, full_name, avatar_url, role, tenant_id, is_solvent
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New Athlete'),
    new.raw_user_meta_data->>'avatar_url',
    'member',
    resolved_tenant_id,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    tenant_id = COALESCE(EXCLUDED.tenant_id, public.profiles.tenant_id),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
