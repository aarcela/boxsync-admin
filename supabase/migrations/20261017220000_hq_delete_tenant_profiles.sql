-- Tenant delete was failing with profiles_tenant_id_fkey because profiles
-- still referenced the tenant when the tenant row was removed. Drop profile
-- triggers for the delete, remove auth users in the same transaction, then
-- delete any profile that was reinserted before the tenant row.

CREATE OR REPLACE FUNCTION public.hq_delete_tenant(p_tenant_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $$
DECLARE
  member_ids uuid[];
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant id is required';
  END IF;

  PERFORM 1 FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO member_ids
  FROM public.profiles
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.coach_feedback
  WHERE tenant_id = p_tenant_id
     OR user_id = ANY (member_ids)
     OR coach_id = ANY (member_ids)
     OR class_id IN (SELECT id FROM public.classes WHERE tenant_id = p_tenant_id);
  DELETE FROM public.class_waitlist
  WHERE tenant_id = p_tenant_id
     OR user_id = ANY (member_ids)
     OR class_id IN (SELECT id FROM public.classes WHERE tenant_id = p_tenant_id);
  DELETE FROM public.guest_bookings
  WHERE tenant_id = p_tenant_id
     OR class_id IN (SELECT id FROM public.classes WHERE tenant_id = p_tenant_id);
  DELETE FROM public.bookings
  WHERE tenant_id = p_tenant_id
     OR user_id = ANY (member_ids)
     OR class_id IN (SELECT id FROM public.classes WHERE tenant_id = p_tenant_id);
  DELETE FROM public.feedback
  WHERE tenant_id = p_tenant_id
     OR user_id = ANY (member_ids)
     OR class_id IN (SELECT id FROM public.classes WHERE tenant_id = p_tenant_id);
  UPDATE public.classes SET coach_id = NULL WHERE coach_id = ANY (member_ids);
  DELETE FROM public.classes WHERE tenant_id = p_tenant_id;
  DELETE FROM public.guest_athletes WHERE tenant_id = p_tenant_id;

  DELETE FROM public.wod_results WHERE tenant_id = p_tenant_id;
  DELETE FROM public.wods WHERE tenant_id = p_tenant_id;

  DELETE FROM public.post_comments WHERE tenant_id = p_tenant_id;
  DELETE FROM public.post_likes WHERE tenant_id = p_tenant_id;
  DELETE FROM public.posts WHERE tenant_id = p_tenant_id;

  DELETE FROM public.personal_records WHERE tenant_id = p_tenant_id;
  DELETE FROM public.pr_movements WHERE tenant_id = p_tenant_id;

  DELETE FROM public.payments
  WHERE tenant_id = p_tenant_id OR user_id = ANY (member_ids);
  DELETE FROM public.expenses
  WHERE tenant_id = p_tenant_id OR created_by = ANY (member_ids);
  DELETE FROM public.incomes
  WHERE tenant_id = p_tenant_id OR created_by = ANY (member_ids);
  DELETE FROM public.payment_methods WHERE tenant_id = p_tenant_id;

  DELETE FROM public.news WHERE tenant_id = p_tenant_id;
  DELETE FROM public.push_tokens WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_ai_usage WHERE tenant_id = p_tenant_id;
  DELETE FROM public.hq_import_jobs WHERE tenant_id = p_tenant_id;
  DELETE FROM public.box_settings WHERE tenant_id = p_tenant_id;
  DELETE FROM public.class_types WHERE tenant_id = p_tenant_id;
  DELETE FROM public.platform_payments WHERE tenant_id = p_tenant_id;

  DELETE FROM public.intervention_events WHERE tenant_id = p_tenant_id;
  DELETE FROM public.member_interventions WHERE tenant_id = p_tenant_id;
  DELETE FROM public.pilot_baselines WHERE tenant_id = p_tenant_id;

  DELETE FROM public.notification_outbox
  WHERE user_id = ANY (member_ids);

  DELETE FROM public.coach_salary_tier_rates WHERE tenant_id = p_tenant_id;
  DELETE FROM public.coach_salary_tiers WHERE tenant_id = p_tenant_id;

  DELETE FROM public.membership_plans WHERE tenant_id = p_tenant_id;

  ALTER TABLE public.profiles DISABLE TRIGGER USER;
  BEGIN
    DELETE FROM public.profiles WHERE tenant_id = p_tenant_id;
    DELETE FROM auth.users WHERE id = ANY (member_ids);
    DELETE FROM public.profiles WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tenants WHERE id = p_tenant_id;
    ALTER TABLE public.profiles ENABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.profiles ENABLE TRIGGER USER;
    RAISE;
  END;

  RETURN member_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.hq_delete_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hq_delete_tenant(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hq_delete_tenant(uuid) TO service_role;
