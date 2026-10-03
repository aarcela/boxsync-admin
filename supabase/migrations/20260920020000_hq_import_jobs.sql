-- HQ CSV import audit + email lookup for dry-run. Service-role only (HQ APIs).

CREATE TABLE IF NOT EXISTS public.hq_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL,
  file_hash text NOT NULL,
  file_name text,
  actor_user_id uuid,
  row_count integer NOT NULL DEFAULT 0,
  create_count integer NOT NULL DEFAULT 0,
  skip_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  send_invites boolean NOT NULL DEFAULT false,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  error_message text,
  CONSTRAINT hq_import_jobs_kind_check CHECK (kind IN ('plans', 'members')),
  CONSTRAINT hq_import_jobs_status_check CHECK (status IN ('validated', 'committed', 'failed'))
);

CREATE INDEX IF NOT EXISTS hq_import_jobs_tenant_idx
  ON public.hq_import_jobs (tenant_id, created_at DESC);

ALTER TABLE public.hq_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.hq_lookup_auth_users_by_email(p_emails text[])
RETURNS TABLE (id uuid, email text, tenant_id uuid, role text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $$
  SELECT
    u.id,
    lower(u.email::text),
    p.tenant_id,
    p.role::text
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.email IS NOT NULL
    AND lower(u.email::text) = ANY (
      SELECT lower(trim(e))
      FROM unnest(COALESCE(p_emails, ARRAY[]::text[])) AS e
      WHERE trim(e) <> ''
    );
$$;

REVOKE ALL ON FUNCTION public.hq_lookup_auth_users_by_email(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hq_lookup_auth_users_by_email(text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hq_lookup_auth_users_by_email(text[]) TO service_role;
