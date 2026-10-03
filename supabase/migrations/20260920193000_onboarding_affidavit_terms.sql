-- Athlete affidavit: accept WODUS Terms (health disclaimer + limitation of liability).
alter table public.profiles
  add column if not exists onboarding_affidavit_terms boolean not null default false;
