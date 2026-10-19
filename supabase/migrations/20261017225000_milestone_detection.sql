-- Milestone detection v1 (class count) + v1.5 (birthdays, anniversaries)
-- Tracks achievement milestones for athletes: class attendance, birthdays, membership anniversaries

BEGIN;

-- Table to store achieved milestones
CREATE TABLE IF NOT EXISTS public.milestones_achieved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  milestone_type text NOT NULL, -- 'class_count', 'birthday', 'anniversary'
  milestone_value text NOT NULL, -- '10', '25', 'birthday_2026', '1_year'
  achieved_at timestamptz NOT NULL DEFAULT now(),
  push_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, milestone_type, milestone_value)
);

CREATE INDEX idx_milestones_achieved_user_tenant ON public.milestones_achieved(user_id, tenant_id);
CREATE INDEX idx_milestones_achieved_type ON public.milestones_achieved(milestone_type);
CREATE INDEX idx_milestones_achieved_push_pending ON public.milestones_achieved(push_sent_at) WHERE push_sent_at IS NULL;

-- RLS: athletes read own, staff read tenant
ALTER TABLE public.milestones_achieved ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS milestones_achieved_own ON public.milestones_achieved;
CREATE POLICY milestones_achieved_own ON public.milestones_achieved
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS milestones_achieved_staff ON public.milestones_achieved;
CREATE POLICY milestones_achieved_staff ON public.milestones_achieved
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'coach')
    )
  );

-- Add birthday opt-out to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS allow_birthday_milestone boolean DEFAULT true;

-- Function to get milestone thresholds from tenant settings (with defaults)
CREATE OR REPLACE FUNCTION get_milestone_thresholds(p_tenant_id uuid)
RETURNS int[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_settings jsonb;
  v_thresholds jsonb;
  v_result int[];
BEGIN
  SELECT settings INTO v_settings FROM public.tenants WHERE id = p_tenant_id;
  
  -- Extract milestones.classCountThresholds, default to [1, 10, 25, 50, 100, 200]
  v_thresholds := v_settings->'milestones'->'classCountThresholds';
  
  IF v_thresholds IS NOT NULL AND jsonb_typeof(v_thresholds) = 'array' THEN
    SELECT array_agg((value::text)::int) INTO v_result
    FROM jsonb_array_elements(v_thresholds)
    WHERE jsonb_typeof(value) = 'number';
  END IF;
  
  IF v_result IS NULL OR array_length(v_result, 1) = 0 THEN
    v_result := ARRAY[1, 10, 25, 50, 100, 200];
  END IF;
  
  RETURN v_result;
END;
$$;

-- Function to check if milestones are enabled for tenant
CREATE OR REPLACE FUNCTION are_milestones_enabled(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_settings jsonb;
  v_enabled boolean;
BEGIN
  SELECT settings INTO v_settings FROM public.tenants WHERE id = p_tenant_id;
  
  -- Extract milestones.enabled, default to true
  v_enabled := (v_settings->'milestones'->>'enabled')::boolean;
  
  RETURN COALESCE(v_enabled, true);
END;
$$;

-- Function to check if milestone push is enabled for tenant
CREATE OR REPLACE FUNCTION are_milestone_pushes_enabled(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_settings jsonb;
  v_push_enabled boolean;
BEGIN
  SELECT settings INTO v_settings FROM public.tenants WHERE id = p_tenant_id;
  
  -- Extract milestones.pushEnabled, default to true
  v_push_enabled := (v_settings->'milestones'->>'pushEnabled')::boolean;
  
  RETURN COALESCE(v_push_enabled, true);
END;
$$;

-- Function to handle class count milestones on booking attended
CREATE OR REPLACE FUNCTION check_class_count_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_lifetime_count int;
  v_thresholds int[];
  v_threshold int;
  v_already_achieved boolean;
  v_push_enabled boolean;
  v_milestones_enabled boolean;
BEGIN
  -- Only trigger when status changes TO 'attended'
  IF NEW.status = 'attended' AND (OLD.status IS NULL OR OLD.status != 'attended') THEN
    v_user_id := NEW.user_id;
    v_tenant_id := NEW.tenant_id;
    
    -- Check if milestones are enabled for this tenant
    v_milestones_enabled := are_milestones_enabled(v_tenant_id);
    IF NOT v_milestones_enabled THEN
      RETURN NEW;
    END IF;
    
    -- Count lifetime attended bookings for this user in this tenant
    SELECT COUNT(*) INTO v_lifetime_count
    FROM public.bookings
    WHERE user_id = v_user_id 
      AND tenant_id = v_tenant_id 
      AND status = 'attended';
    
    -- Get thresholds from tenant settings
    v_thresholds := get_milestone_thresholds(v_tenant_id);
    v_push_enabled := are_milestone_pushes_enabled(v_tenant_id);
    
    -- Check each threshold
    FOREACH v_threshold IN ARRAY v_thresholds
    LOOP
      IF v_lifetime_count >= v_threshold THEN
        -- Check if already achieved (idempotent)
        SELECT EXISTS(
          SELECT 1 FROM public.milestones_achieved
          WHERE user_id = v_user_id
            AND tenant_id = v_tenant_id
            AND milestone_type = 'class_count'
            AND milestone_value = v_threshold::text
        ) INTO v_already_achieved;
        
        IF NOT v_already_achieved THEN
          -- Insert milestone achievement
          INSERT INTO public.milestones_achieved (
            user_id, 
            tenant_id, 
            milestone_type, 
            milestone_value, 
            achieved_at
          ) VALUES (
            v_user_id,
            v_tenant_id,
            'class_count',
            v_threshold::text,
            now()
          );
          
          -- Enqueue push notification if enabled
          IF v_push_enabled THEN
            INSERT INTO public.notification_outbox (user_id, kind, payload)
            VALUES (
              v_user_id, 
              'milestone_class_count',
              jsonb_build_object('count', v_threshold)
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on bookings when status changes to attended
DROP TRIGGER IF EXISTS tr_check_class_count_milestone ON public.bookings;
CREATE TRIGGER tr_check_class_count_milestone
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_class_count_milestone();

-- Also check on INSERT in case bookings are created directly with attended status
DROP TRIGGER IF EXISTS tr_check_class_count_milestone_insert ON public.bookings;
CREATE TRIGGER tr_check_class_count_milestone_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'attended')
  EXECUTE FUNCTION check_class_count_milestone();

-- Function to backfill existing milestones without sending pushes
-- This avoids spam when the feature is first deployed
CREATE OR REPLACE FUNCTION backfill_class_count_milestones(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(tenant_id uuid, user_id uuid, milestone_value text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH user_counts AS (
    SELECT 
      b.tenant_id,
      b.user_id,
      COUNT(*) as attended_count
    FROM public.bookings b
    WHERE b.status = 'attended'
      AND (p_tenant_id IS NULL OR b.tenant_id = p_tenant_id)
    GROUP BY b.tenant_id, b.user_id
  ),
  thresholds_expanded AS (
    SELECT DISTINCT
      uc.tenant_id,
      uc.user_id,
      uc.attended_count,
      unnest(get_milestone_thresholds(uc.tenant_id)) as threshold
    FROM user_counts uc
    WHERE are_milestones_enabled(uc.tenant_id)
  ),
  milestones_to_add AS (
    SELECT 
      te.tenant_id,
      te.user_id,
      te.threshold::text as milestone_value
    FROM thresholds_expanded te
    WHERE te.attended_count >= te.threshold
      AND NOT EXISTS (
        SELECT 1 FROM public.milestones_achieved ma
        WHERE ma.user_id = te.user_id
          AND ma.tenant_id = te.tenant_id
          AND ma.milestone_type = 'class_count'
          AND ma.milestone_value = te.threshold::text
      )
  )
  INSERT INTO public.milestones_achieved (
    user_id,
    tenant_id,
    milestone_type,
    milestone_value,
    achieved_at,
    push_sent_at
  )
  SELECT 
    mta.user_id,
    mta.tenant_id,
    'class_count',
    mta.milestone_value,
    now(),
    now() -- Mark as already sent to avoid backfill spam
  FROM milestones_to_add mta
  RETURNING 
    milestones_achieved.tenant_id,
    milestones_achieved.user_id,
    milestones_achieved.milestone_value,
    1::bigint as count;
END;
$$;

-- Function to check daily milestones (birthdays and anniversaries)
-- Called by cron at midnight America/Caracas (04:00 UTC)
CREATE OR REPLACE FUNCTION check_daily_milestones()
RETURNS TABLE(
  milestone_type text,
  user_id uuid,
  tenant_id uuid,
  milestone_value text,
  inserted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_today_caracas date;
  v_year int;
  v_month int;
  v_day int;
  v_profile record;
  v_birth_year int;
  v_age int;
  v_anniversary_years int;
  v_milestone_value text;
  v_inserted boolean;
  v_milestones_enabled boolean;
  v_push_enabled boolean;
  v_anniversary_date date;
BEGIN
  -- Get today's date in Caracas timezone
  v_today_caracas := (now() AT TIME ZONE 'America/Caracas')::date;
  v_year := EXTRACT(YEAR FROM v_today_caracas);
  v_month := EXTRACT(MONTH FROM v_today_caracas);
  v_day := EXTRACT(DAY FROM v_today_caracas);
  
  -- Check birthdays
  FOR v_profile IN 
    SELECT 
      p.id as user_id,
      p.tenant_id,
      p.birth_date,
      p.allow_birthday_milestone
    FROM public.profiles p
    WHERE p.birth_date IS NOT NULL
      AND p.allow_birthday_milestone = true
      AND EXTRACT(MONTH FROM p.birth_date::date) = v_month
      AND EXTRACT(DAY FROM p.birth_date::date) = v_day
      AND are_milestones_enabled(p.tenant_id)
  LOOP
    v_milestone_value := 'birthday_' || v_year::text;
    v_milestones_enabled := are_milestones_enabled(v_profile.tenant_id);
    v_push_enabled := are_milestone_pushes_enabled(v_profile.tenant_id);
    
    -- Check if already achieved this year
    IF NOT EXISTS (
      SELECT 1 FROM public.milestones_achieved
      WHERE user_id = v_profile.user_id
        AND tenant_id = v_profile.tenant_id
        AND milestone_type = 'birthday'
        AND milestone_value = v_milestone_value
    ) THEN
      -- Insert birthday milestone
      INSERT INTO public.milestones_achieved (
        user_id,
        tenant_id,
        milestone_type,
        milestone_value,
        achieved_at
      ) VALUES (
        v_profile.user_id,
        v_profile.tenant_id,
        'birthday',
        v_milestone_value,
        now()
      );
      
      v_inserted := true;
      
      -- Enqueue push notification if enabled
      IF v_push_enabled THEN
        v_birth_year := EXTRACT(YEAR FROM v_profile.birth_date::date);
        v_age := v_year - v_birth_year;
        
        INSERT INTO public.notification_outbox (user_id, kind, payload)
        VALUES (
          v_profile.user_id,
          'milestone_birthday',
          jsonb_build_object('age', v_age)
        );
      END IF;
    ELSE
      v_inserted := false;
    END IF;
    
    RETURN QUERY SELECT 'birthday'::text, v_profile.user_id, v_profile.tenant_id, v_milestone_value, v_inserted;
  END LOOP;
  
  -- Check membership anniversaries
  FOR v_profile IN 
    SELECT 
      p.id as user_id,
      p.tenant_id,
      COALESCE(p.plan_period_start, p.created_at) as start_date
    FROM public.profiles p
    WHERE COALESCE(p.plan_period_start, p.created_at) IS NOT NULL
      AND are_milestones_enabled(p.tenant_id)
  LOOP
    v_anniversary_date := v_profile.start_date::date;
    
    -- Check if anniversary is today (month and day match)
    IF EXTRACT(MONTH FROM v_anniversary_date) = v_month
      AND EXTRACT(DAY FROM v_anniversary_date) = v_day THEN
      
      -- Calculate years
      v_anniversary_years := v_year - EXTRACT(YEAR FROM v_anniversary_date);
      
      -- Only celebrate if at least 1 year and anniversary date is before today
      IF v_anniversary_years >= 1 THEN
        v_milestone_value := v_anniversary_years::text || '_year';
        v_milestones_enabled := are_milestones_enabled(v_profile.tenant_id);
        v_push_enabled := are_milestone_pushes_enabled(v_profile.tenant_id);
        
        -- Check if already achieved this year
        IF NOT EXISTS (
          SELECT 1 FROM public.milestones_achieved
          WHERE user_id = v_profile.user_id
            AND tenant_id = v_profile.tenant_id
            AND milestone_type = 'anniversary'
            AND milestone_value = v_milestone_value
        ) THEN
          -- Insert anniversary milestone
          INSERT INTO public.milestones_achieved (
            user_id,
            tenant_id,
            milestone_type,
            milestone_value,
            achieved_at
          ) VALUES (
            v_profile.user_id,
            v_profile.tenant_id,
            'anniversary',
            v_milestone_value,
            now()
          );
          
          v_inserted := true;
          
          -- Enqueue push notification if enabled
          IF v_push_enabled THEN
            INSERT INTO public.notification_outbox (user_id, kind, payload)
            VALUES (
              v_profile.user_id,
              'milestone_anniversary',
              jsonb_build_object('years', v_anniversary_years)
            );
          END IF;
        ELSE
          v_inserted := false;
        END IF;
        
        RETURN QUERY SELECT 'anniversary'::text, v_profile.user_id, v_profile.tenant_id, v_milestone_value, v_inserted;
      END IF;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
