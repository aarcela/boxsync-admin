const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'getwodus.com';

export const ROOT_HOSTS = new Set([
  ROOT_DOMAIN,
  `www.${ROOT_DOMAIN}`,
  'localhost',
  'localhost:3000',
]);

export const HQ_HOSTS = new Set([`hq.${ROOT_DOMAIN}`, 'hq.localhost', 'hq.localhost:3000']);

function normalizeHost(host: string): string {
  return host.toLowerCase().split(':')[0];
}

function hostWithPort(host: string): string {
  return host.toLowerCase();
}

export function isRootHost(host: string): boolean {
  const normalized = normalizeHost(host);
  const withPort = hostWithPort(host);
  return ROOT_HOSTS.has(normalized) || ROOT_HOSTS.has(withPort);
}

export function isHqHost(host: string): boolean {
  const normalized = normalizeHost(host);
  const withPort = hostWithPort(host);
  return HQ_HOSTS.has(normalized) || HQ_HOSTS.has(withPort);
}

export function isTenantHost(host: string): boolean {
  return resolveTenantSlug(host) !== null;
}

export function resolveTenantSlug(host: string): string | null {
  const lower = host.toLowerCase();

  if (isRootHost(lower) || isHqHost(lower)) {
    return null;
  }

  const hostname = lower.split(':')[0];
  const parts = hostname.split('.');

  // Local dev: madrid.localhost
  if (hostname.endsWith('.localhost') && parts.length >= 2) {
    const slug = parts[0];
    if (slug && slug !== 'www' && slug !== 'hq') {
      return slug;
    }
    return null;
  }

  // Production: madrid.getwodus.com
  if (parts.length >= 3 && parts.slice(-2).join('.') === ROOT_DOMAIN) {
    const slug = parts[0];
    if (slug && slug !== 'www' && slug !== 'hq') {
      return slug;
    }
  }

  return null;
}

export function buildTenantDashboardUrl(slug: string, path = '/dashboard'): string {
  const dashboardPath = path.startsWith('/') ? path : `/${path}`;
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    const port = process.env.PORT ?? '3000';
    return `http://${slug}.localhost:${port}${dashboardPath}`;
  }

  return `https://${slug}.${ROOT_DOMAIN}${dashboardPath}`;
}
