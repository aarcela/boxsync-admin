-- Drop profile avatar URLs that point at 0-byte storage objects from the
-- old React Native FormData upload bug. The UI falls back to initials.

UPDATE profiles p
SET avatar_url = NULL
FROM storage.objects o
WHERE o.bucket_id = 'avatars'
  AND COALESCE((o.metadata->>'size')::int, 0) = 0
  AND p.avatar_url = 'https://mcbzisibacsjtumkfpad.supabase.co/storage/v1/object/public/avatars/' || o.name;
