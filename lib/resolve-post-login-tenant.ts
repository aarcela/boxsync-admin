/**
 * Resolves tenant slug after login via server route (bypasses tenants RLS).
 */
export async function resolvePostLoginTenantSlug(): Promise<string | null> {
  const res = await fetch('/api/auth/resolve-tenant', { credentials: 'include' });
  if (!res.ok) return null;

  const body = (await res.json()) as { slug?: string };
  return typeof body.slug === 'string' ? body.slug : null;
}
