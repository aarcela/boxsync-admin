-- Tenant terminology lives in tenants.settings.terms (jsonb). No schema change.
-- Shape: { member: { singular, plural }, venue, session, coach, workout }
-- Missing keys fall back to CrossFit defaults in app/admin code so existing
-- tenants keep current labels (atleta / box / WOD). Do not backfill.

comment on column public.tenants.settings is
  'JSONB gym settings. Known keys: paletteId, features, onboarding, booking, currencies, supportWhatsApp, terms. terms: { member: { singular, plural }, venue, session, coach, workout }.';
