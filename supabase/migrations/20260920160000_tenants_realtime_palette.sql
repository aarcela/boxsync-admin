-- Palette live-updates: members subscribe to tenants.settings.paletteId.
alter table public.tenants replica identity full;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tenants'
  ) then
    alter publication supabase_realtime add table public.tenants;
  end if;
end $$;
