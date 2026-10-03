-- Membership solvency can change while a member stays logged in (admin restore).
-- STABLE allowed Postgres to reuse a stale is_solvent result during booking.
ALTER FUNCTION private.capacity_booking_error(uuid, uuid) VOLATILE;
