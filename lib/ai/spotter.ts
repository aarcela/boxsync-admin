import type { TranslationKey } from '@/lib/translations';

/** Dashboard pages Spotter may link to. Paths are browser paths on the tenant host. */
export const SPOTTER_PAGES: ReadonlyArray<{ path: string; about: string }> = [
  { path: '/dashboard', about: 'Home: today at a glance, pending proofs' },
  { path: '/dashboard/attendance', about: 'Check-in: who came to class today, mark attendance, add guests' },
  { path: '/dashboard/athletes', about: 'Athletes: members, membership status, overdue members' },
  { path: '/dashboard/schedule', about: 'Schedule: classes and capacity' },
  { path: '/dashboard/financials', about: 'Payments: review and approve payment proofs, who has paid' },
  { path: '/dashboard/accountability', about: "This month: the month's income, expenses and result" },
  { path: '/dashboard/movements', about: 'Movements: income and expense entries' },
  { path: '/dashboard/plans', about: 'Membership plans' },
  { path: '/dashboard/performance', about: 'Box health: at-risk members and class fill' },
  { path: '/dashboard/notifications', about: 'Push notifications to athletes' },
];

const PAGE_PATHS = new Set(SPOTTER_PAGES.map((page) => page.path));

export function isSpotterPage(path: string): boolean {
  return PAGE_PATHS.has(path);
}

/** Strip the internal `/{slug}` prefix so `/{slug}/dashboard/x` and `/dashboard/x` both map to `/dashboard/x`. */
export function toDashboardPath(pathname: string): string {
  const index = pathname.indexOf('/dashboard');
  return index >= 0 ? pathname.slice(index) : pathname;
}

/** Closest known page for the current path (longest prefix match), used as context for the model. */
export function matchSpotterPage(path: string): (typeof SPOTTER_PAGES)[number] | null {
  let best: (typeof SPOTTER_PAGES)[number] | null = null;
  for (const page of SPOTTER_PAGES) {
    const hit = path === page.path || path.startsWith(`${page.path}/`);
    if (hit && (!best || page.path.length > best.path.length)) best = page;
  }
  return best;
}

const DEFAULT_SUGGESTIONS: TranslationKey[] = [
  'Spotter ask attended today',
  'Spotter ask who owes',
  'Spotter ask month money',
  'Spotter ask what can you do',
];

const PAGE_SUGGESTIONS: Record<string, TranslationKey[]> = {
  '/dashboard/attendance': ['Spotter ask attended today', 'Spotter ask no-shows', 'Spotter ask class fill'],
  '/dashboard/athletes': ['Spotter ask who owes', 'Spotter ask members active', 'Spotter ask pending proofs'],
  '/dashboard/schedule': ['Spotter ask class fill', 'Spotter ask attended today', 'Spotter ask no-shows'],
  '/dashboard/financials': ['Spotter ask pending proofs', 'Spotter ask who owes', 'Spotter ask month money'],
  '/dashboard/accountability': ['Spotter ask month money', 'Spotter ask vs last month', 'Spotter ask month net'],
  '/dashboard/movements': ['Spotter ask month net', 'Spotter ask month money', 'Spotter ask pending proofs'],
  '/dashboard/performance': ['Spotter ask class fill', 'Spotter ask members active', 'Spotter ask no-shows'],
};

export function spotterSuggestions(path: string): TranslationKey[] {
  const page = matchSpotterPage(path);
  return (page && PAGE_SUGGESTIONS[page.path]) || DEFAULT_SUGGESTIONS;
}

export const SPOTTER_ACTIONS_PROMPT = [
  'ACTION LINKS: When a dashboard page is where staff act on your answer, end with one or two markdown links on their own lines, like [Review 4 proofs](/dashboard/financials).',
  'Link text: a short verb phrase in the reply language (2–4 words, include the count when you have it). Only use these paths, exactly:',
  ...SPOTTER_PAGES.map((page) => `- ${page.path} — ${page.about}`),
  'Never invent other paths or full URLs. Skip links when none fit.',
].join('\n');
