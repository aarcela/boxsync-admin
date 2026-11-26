-- Enforce unique athlete phones without requiring every profile to have one.
-- Dashboard "Is Unique" + non-nullable fails because ~40 profiles still have phone NULL.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_not_null
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';
