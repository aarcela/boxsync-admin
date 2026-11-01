export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_SLUGS = new Set([
  'www',
  'hq',
  'api',
  'admin',
  'app',
  'join',
  'login',
  'signup',
  'registro',
  'auth',
  'welcome',
  'support',
  'terms',
  'privacy',
  'returns',
  'copyright',
  'status',
  'mail',
  'ftp',
  'cdn',
  'static',
  'assets',
  'dashboard',
  'super-admin',
  'superadmin',
  'en',
  'es',
  'www-hq',
  'help',
  'docs',
  'billing',
  'account',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

export function isValidSlugFormat(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return (
    SLUG_RE.test(normalized) &&
    normalized.length >= 2 &&
    normalized.length <= 48 &&
    !isReservedSlug(normalized)
  );
}

export function slugifyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function suggestSlug(base: string, city?: string): string[] {
  const root = slugifyName(base) || 'gym';
  const citySlug = city ? slugifyName(city) : '';
  const suggestions: string[] = [];
  if (citySlug) suggestions.push(`${root}-${citySlug}`.slice(0, 48));
  suggestions.push(`${root}-2`);
  suggestions.push(`${root}-3`);
  return [...new Set(suggestions.filter(isValidSlugFormat))];
}
