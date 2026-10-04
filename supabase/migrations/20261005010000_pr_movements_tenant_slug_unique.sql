-- PR movement slugs must be unique within a tenant, not globally.
-- A global unique/PK on slug alone blocks every box from sharing common
-- movements (back_squat, snatch, …) and surfaces as Postgres 23505 on insert.

BEGIN;

DO $$
DECLARE
  fk record;
  con record;
  has_table boolean;
  has_tenant boolean;
  pk_has_tenant boolean;
  pk_has_slug boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'pr_movements' AND c.relkind = 'r'
  ) INTO has_table;

  IF NOT has_table THEN
    RAISE NOTICE 'pr_movements missing — skip tenant slug uniqueness fix';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pr_movements'
      AND column_name = 'tenant_id'
  ) INTO has_tenant;

  IF NOT has_tenant THEN
    RAISE EXCEPTION 'pr_movements.tenant_id is required for tenant-scoped slugs';
  END IF;

  -- Backfill any legacy rows before tightening the key.
  UPDATE public.pr_movements
  SET tenant_id = (
    SELECT t.id
    FROM public.tenants t
    ORDER BY t.created_at
    LIMIT 1
  )
  WHERE tenant_id IS NULL
    AND EXISTS (SELECT 1 FROM public.tenants);

  IF EXISTS (SELECT 1 FROM public.pr_movements WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION 'pr_movements has rows with NULL tenant_id; cannot convert uniqueness';
  END IF;

  SELECT
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conname = 'pr_movements_pkey'
        AND c.conrelid = 'public.pr_movements'::regclass
        AND a.attname = 'tenant_id'
    ),
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conname = 'pr_movements_pkey'
        AND c.conrelid = 'public.pr_movements'::regclass
        AND a.attname = 'slug'
    )
  INTO pk_has_tenant, pk_has_slug;

  -- Already correct composite PK.
  IF pk_has_tenant AND pk_has_slug THEN
    -- Still ensure a named unique exists for clarity / FKs if someone dropped PK.
    NULL;
  ELSE
    -- Drop inbound FKs so we can rewrite the primary/unique key.
    FOR fk IN
      SELECT c.conname, c.conrelid::regclass AS tbl
      FROM pg_constraint c
      WHERE c.confrelid = 'public.pr_movements'::regclass
        AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
    END LOOP;

    -- Drop PK / unique constraints that enforce global slug uniqueness.
    FOR con IN
      SELECT c.conname, c.contype
      FROM pg_constraint c
      WHERE c.conrelid = 'public.pr_movements'::regclass
        AND c.contype IN ('p', 'u')
        AND pg_get_constraintdef(c.oid) ~* '\(slug\)'
        AND pg_get_constraintdef(c.oid) !~* 'tenant_id'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.pr_movements DROP CONSTRAINT %I',
        con.conname
      );
    END LOOP;

    -- Drop unique indexes that are not backed by a constraint name we caught.
    FOR con IN
      SELECT i.relname AS index_name
      FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_class t ON t.oid = x.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'pr_movements'
        AND x.indisunique
        AND NOT x.indisprimary
        AND pg_get_indexdef(x.indexrelid) ~* '\(slug\)'
        AND pg_get_indexdef(x.indexrelid) !~* 'tenant_id'
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', con.index_name);
    END LOOP;

    ALTER TABLE public.pr_movements
      ALTER COLUMN tenant_id SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'pr_movements_pkey'
        AND conrelid = 'public.pr_movements'::regclass
    ) THEN
      ALTER TABLE public.pr_movements
        ADD CONSTRAINT pr_movements_pkey PRIMARY KEY (tenant_id, slug);
    ELSIF NOT (pk_has_tenant AND pk_has_slug) THEN
      ALTER TABLE public.pr_movements DROP CONSTRAINT pr_movements_pkey;
      ALTER TABLE public.pr_movements
        ADD CONSTRAINT pr_movements_pkey PRIMARY KEY (tenant_id, slug);
    END IF;
  END IF;

  -- Recreate personal_records FK as tenant-scoped when both columns exist
  -- and every row already resolves to a movement in the same tenant.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'personal_records'
      AND column_name = 'movement_slug'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'personal_records'
      AND column_name = 'tenant_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personal_records_tenant_movement_fkey'
      AND conrelid = 'public.personal_records'::regclass
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.personal_records pr
    WHERE pr.movement_slug IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.pr_movements m
        WHERE m.tenant_id = pr.tenant_id
          AND m.slug = pr.movement_slug
      )
  ) THEN
    ALTER TABLE public.personal_records
      ADD CONSTRAINT personal_records_tenant_movement_fkey
      FOREIGN KEY (tenant_id, movement_slug)
      REFERENCES public.pr_movements (tenant_id, slug);
  END IF;
END $$;

COMMIT;
