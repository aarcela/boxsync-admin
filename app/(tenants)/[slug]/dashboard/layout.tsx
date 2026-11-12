'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isStaffRole } from '@/lib/auth';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Dumbbell, 
  LogOut, 
  Menu,
  X, 
  DollarSign,
  Megaphone,
  Bell,
  ClipboardCheck,
  BarChart3,
  MessageSquare,
  TrendingUp,
  Scale,
  MessagesSquare,
  Trophy,
  Tags,
  Layers,
  CreditCard,
  Banknote,
  Receipt,
  Clock,
  Rocket,
  Sparkles,
  Palette,
  ClipboardList,
  CalendarClock,
  Settings,
  QrCode,
  ListChecks,
  MessageCircle,
  Search,
  ArrowLeftRight,
  ChevronDown,
  User,
  Languages,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils/format-date';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import CommandPalette, { type PaletteLink } from '@/components/CommandPalette';
import { useMoneyCurrency } from '@/lib/hooks/useMoneyCurrency';
import Tooltip from '@/components/Tooltip';
import { financialService } from '@/lib/services/financialService';
import {
  getPlatformPlan,
  isTrialEndingSoon,
  isTrialExpired,
} from '@/lib/platform-plans';
import {
  founderWhatsAppUrl,
  setupHelpWhatsAppText,
} from '@/lib/founder-contact';
import Image from 'next/image';
import type { TranslationKey } from '@/lib/translations';

type NavTab = {
  name: string;
  href: string;
  icon: LucideIcon;
  tip: string;
};

/** One sidebar entry. Groups with several tabs show a tab bar above their pages. */
type NavGroup = {
  id: string;
  name: string;
  icon: LucideIcon;
  tip: string;
  tabs: NavTab[];
};

/** Home only matches itself; every other tab also owns its sub-routes (e.g. athletes/[id]). */
function tabMatchLength(pathname: string, href: string): number {
  if (href === '/dashboard') return pathname === href ? href.length : -1;
  return pathname === href || pathname.startsWith(`${href}/`) ? href.length : -1;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Desktop rail starts expanded and mobile drawer starts closed, so SSR and first paint
  // match without a width animation on every page load.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!accountMenuRef.current?.contains(e.target as Node)) setAccountMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountMenuOpen]);
  const { lang, setLanguage, t } = useLanguage();
  const { name: boxName, features, platformPlan, trialEndsAt, signupSource } = useTenant();
  const { toast } = useToast();
  const moneyCurrency = useMoneyCurrency();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [runningExpiry, setRunningExpiry] = useState(false);
  const [confirmExpiryOpen, setConfirmExpiryOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [trialBannerTracked, setTrialBannerTracked] = useState(false);


  const loadDueCount = useCallback(async () => {
    try {
      setDueCount(await financialService.getDueExpiryCount());
    } catch {
      // Keep last known count; toast only on an explicit run.
    }
  }, []);

  useEffect(() => {
    void loadDueCount();
    const onFocus = () => {
      void loadDueCount();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadDueCount]);

  const runExpiry = async () => {
    setRunningExpiry(true);
    try {
      const res = await financialService.runExpiryCheck();
      if (res.count === 0) {
        toast(t('No memberships to expire.'), 'info');
      } else {
        toast(t('Locked {{count}} expired memberships.', { count: res.count }), 'success');
      }
      setDueCount(0);
    } catch {
      toast(t('Expiry sync error.'), 'error');
    } finally {
      setRunningExpiry(false);
      await loadDueCount();
    }
  };

  const userInitials = (() => {
    if (!userFullName?.trim()) return 'AD';
    const parts = userFullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return userFullName.slice(0, 2).toUpperCase();
  })();

  const navGroups = useMemo((): NavGroup[] => {
    const tab = (name: TranslationKey, href: string, icon: LucideIcon, tip: TranslationKey): NavTab => ({
      name: t(name),
      href,
      icon,
      tip: t(tip),
    });
    const groups: NavGroup[] = [
      { id: 'home', name: t('Home'), icon: LayoutDashboard, tip: t('Nav tip Home'), tabs: [tab('Home', '/dashboard', LayoutDashboard, 'Nav tip Home')] },
      { id: 'checkin', name: t('Nav Check-in'), icon: ClipboardCheck, tip: t('Nav tip Check-in'), tabs: [tab('Nav Check-in', '/dashboard/attendance', ClipboardCheck, 'Nav tip Check-in')] },
      { id: 'users', name: t('Users'), icon: Users, tip: t('Nav tip Users'), tabs: [tab('Users', '/dashboard/athletes', Users, 'Nav tip Users')] },
      {
        id: 'classes',
        name: t('Classes'),
        icon: Dumbbell,
        tip: t('Nav tip Classes'),
        tabs: [
          tab('Schedule', '/dashboard/schedule', CalendarDays, 'Nav tip Schedule'),
          ...(features.wod ? [tab('Daily workouts', '/dashboard/wods', Dumbbell, 'Nav tip Daily workouts')] : []),
          ...(features.personalRecords
            ? [tab('Personal Records', '/dashboard/personal_records', Trophy, 'Nav tip Personal Records')]
            : []),
          tab('Class Types', '/dashboard/class_types', Layers, 'Nav tip Class Types'),
        ],
      },
      {
        id: 'money',
        name: t('Money'),
        icon: DollarSign,
        tip: t('Nav tip Money'),
        tabs: [
          tab('Payments tab', '/dashboard/financials', DollarSign, 'Nav tip Payments tab'),
          tab('This month', '/dashboard/accountability', Scale, 'Nav tip Month result'),
          tab('Movements', '/dashboard/movements', ArrowLeftRight, 'Nav tip Movements'),
          ...(userRole === 'admin'
            ? [
                tab('Salary', '/dashboard/salary', Banknote, 'Nav tip Salary'),
                tab('Payroll', '/dashboard/payroll', Receipt, 'Nav tip Payroll'),
              ]
            : []),
        ],
      },
      {
        id: 'messages',
        name: t('Messages'),
        icon: Megaphone,
        tip: t('Nav tip Messages'),
        tabs: [
          tab('Announcements', '/dashboard/news', Megaphone, 'Nav tip Announcements'),
          tab('Push notifications', '/dashboard/notifications', Bell, 'Nav tip Push notifications'),
          ...(features.community
            ? [tab('Community', '/dashboard/community', MessagesSquare, 'Nav tip Community')]
            : []),
          tab('Feedback', '/dashboard/feedback', MessageSquare, 'Nav tip Feedback'),
        ],
      },
      {
        id: 'results',
        name: t('Results'),
        icon: BarChart3,
        tip: t('Nav tip Results'),
        tabs: [
          tab('Box health', '/dashboard/performance', TrendingUp, 'Nav tip Box health'),
          tab('Ask AI', '/dashboard/ask', Sparkles, 'Nav tip Ask AI'),
          tab('Revenue Rescue', '/dashboard/financials/insights', BarChart3, 'Nav tip Reports'),
          tab('Founding Pilot', '/dashboard/pilot', Rocket, 'Nav tip Founding Pilot'),
        ],
      },
      {
        id: 'settings',
        name: t('Settings'),
        icon: Settings,
        tip: t('Nav tip Settings'),
        tabs: [
          ...(userRole === 'admin' ? [tab('Booking', '/dashboard/booking', CalendarClock, 'Nav tip Booking')] : []),
          tab('Membership Plans', '/dashboard/plans', Tags, 'Nav tip Membership Plans'),
          tab('How they pay', '/dashboard/payment_methods', CreditCard, 'Nav tip How they pay'),
          ...(userRole === 'admin'
            ? [
                tab('Onboarding', '/dashboard/onboarding', ClipboardList, 'Nav tip Onboarding'),
                tab('Appearance', '/dashboard/appearance', Palette, 'Nav tip Appearance'),
              ]
            : []),
          ...(emailConfirmed ? [tab('Join QR', '/dashboard/profile', QrCode, 'Nav tip Athlete join QR')] : []),
          ...(userRole === 'admin' || signupSource === 'self_serve'
            ? [{ name: t('Setup assistant'), href: '/dashboard/setup', icon: ListChecks, tip: t('Configure your gym') }]
            : []),
        ],
      },
    ];
    return groups.filter((g) => g.tabs.length > 0);
  }, [t, userRole, features, emailConfirmed, signupSource]);

  /** The group and tab that own the current page (longest matching href wins). */
  const activeNav = useMemo(() => {
    let best: { group: NavGroup; tab: NavTab; len: number } | null = null;
    for (const group of navGroups) {
      for (const navTab of group.tabs) {
        const len = tabMatchLength(pathname, navTab.href);
        if (len > (best?.len ?? -1)) best = { group, tab: navTab, len };
      }
    }
    return best;
  }, [navGroups, pathname]);

  const paletteLinks = useMemo(
    (): PaletteLink[] =>
      navGroups.flatMap((group) =>
        group.tabs.map((navTab) => ({
          name: navTab.name,
          href: navTab.href,
          icon: navTab.icon,
          group: group.tabs.length > 1 ? group.name : undefined,
        })),
      ),
    [navGroups],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closeSidebarOnMobile = () => setMobileOpen(false);

  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) setCollapsed((c) => !c);
    else setMobileOpen((o) => !o);
  };

  /** Hidden only on desktop while the rail is collapsed; the mobile drawer is always full width. */
  const whenExpanded = collapsed ? 'lg:hidden' : '';

  useEffect(() => {
    if (pathname.includes('/dashboard/wods') && !features.wod) {
      router.replace('/dashboard');
    }
    if (pathname.includes('/dashboard/personal_records') && !features.personalRecords) {
      router.replace('/dashboard');
    }
    if (pathname.includes('/dashboard/community') && !features.community) {
      router.replace('/dashboard');
    }
  }, [pathname, features.wod, features.personalRecords, features.community, router]);

  // Client-side guard (middleware is the primary enforcement)
  useEffect(() => {
    const verifyStaffSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single();
      if (!isStaffRole(profile?.role)) {
        await supabase.auth.signOut();
        router.replace('/');
        return;
      }
      setUserRole(profile?.role ?? null);
      setUserFullName(profile?.full_name ?? null);
      setEmailConfirmed(Boolean(user.email_confirmed_at));
    };
    verifyStaffSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="flex h-screen bg-pits-surface overflow-hidden">
      
      {/* MOBILE BACKDROP */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`bg-pits-shell text-pits-shell-ink transition-[width,transform] duration-200 ease-out flex flex-col overflow-x-hidden
          fixed inset-y-0 left-0 z-50 w-64 lg:relative lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'lg:w-20' : 'lg:w-64'}
        `}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4 shrink-0">
          <div className={`flex-1 flex items-center py-4 pl-2 ${collapsed ? 'lg:justify-center lg:pl-0' : ''}`}>
            <Image src="/assets/logo.png" alt="Logo" className={`w-10 h-10 ${collapsed ? 'lg:hidden' : ''}`} width={40} height={40} />
            <span className={`font-black text-2xl text-pits-white ml-2 whitespace-nowrap ${whenExpanded}`}>WODUS</span>
            <span className={`font-black text-2xl text-pits-shell-accent hidden ${collapsed ? 'lg:inline' : ''}`}>W</span>
          </div>

          {/* Close button for mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={t('Close')}
            className="lg:hidden p-2 text-pits-shell-ink-muted hover:text-pits-shell-accent transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation — min-h-0 + overflow so expanded submenus stay scrollable */}
        <nav
          aria-label={t('Menu')}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-6 space-y-1 px-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {navGroups.map((group) => {
            const isActive = activeNav?.group.id === group.id;
            return (
              <div key={group.id}>
                {group.id === 'settings' ? <div className="mx-2 my-3 border-t border-pits-shell-edge" /> : null}
                <Tooltip content={group.tip} side="right" className="w-full min-w-0">
                  <Link
                    href={group.tabs[0].href}
                    onClick={closeSidebarOnMobile}
                    aria-label={group.name}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full min-w-0 flex items-center p-3 rounded-lg transition-colors group border-2 border-transparent ${
                      collapsed ? 'lg:justify-center' : ''
                    } ${
                      isActive
                        ? 'border-pits-shell-accent text-pits-shell-ink'
                        : 'text-pits-shell-ink-muted hover:border-pits-shell-edge hover:text-pits-shell-ink'
                    }`}
                  >
                    <group.icon
                      size={20}
                      className={`shrink-0 ${isActive ? 'text-pits-shell-accent' : 'text-pits-shell-ink-muted group-hover:text-pits-shell-accent'}`}
                    />
                    <span className={`ml-3 font-bold text-sm uppercase tracking-wide min-w-0 truncate ${whenExpanded}`}>
                      {group.name}
                    </span>
                  </Link>
                </Tooltip>
              </div>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="p-4 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            aria-label={t('Log Out')}
            className={`flex items-center w-full min-w-0 p-2 rounded-lg text-pits-shell-ink-muted hover:border hover:border-pits-shell-edge hover:text-pits-shell-accent transition-colors ${collapsed ? 'lg:justify-center' : ''}`}
          >
            <LogOut size={20} className="shrink-0" />
            <span className={`ml-3 font-bold text-sm uppercase tracking-wide min-w-0 truncate ${whenExpanded}`}>
              {t('Log Out')}
            </span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-pits-shell shadow-lg flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={t('Menu')}
              className="p-2 rounded-md hover:bg-pits-shell-edge text-pits-shell-ink-muted hover:text-pits-shell-accent transition-colors"
            >
              <Menu size={20} />
            </button>
            

            {boxName && (
              <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
                <span className="font-black text-sm sm:text-base uppercase tracking-tight text-pits-shell-ink truncate max-w-[32vw] sm:max-w-xs">
                  {boxName}
                </span>
                <span
                  className={`text-[11px] font-black uppercase tracking-wider truncate ${
                    platformPlan === 'trial' && isTrialExpired(platformPlan, trialEndsAt)
                      ? 'text-red-400'
                      : platformPlan === 'trial' && isTrialEndingSoon(platformPlan, trialEndsAt)
                        ? 'text-orange-300'
                        : 'text-pits-shell-ink-muted'
                  }`}
                >
                  {t(getPlatformPlan(platformPlan).nameKey)}
                  {platformPlan === 'trial' && trialEndsAt
                    ? ` · ${
                        isTrialExpired(platformPlan, trialEndsAt)
                          ? t('Trial ended')
                          : t('Trial ends {{date}}', {
                              date: formatDate(trialEndsAt, lang),
                            })
                      }`
                    : ''}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={t('Search')}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-pits-shell-edge bg-pits-black/40 text-pits-shell-ink-muted hover:text-pits-shell-ink hover:border-pits-shell-ink-muted transition-colors"
            >
              <Search size={16} />
              <span className="hidden md:inline text-xs font-semibold">{t('Search')}</span>
              <kbd className="hidden md:inline text-[11px] font-semibold border border-pits-shell-edge rounded px-1">⌘K</kbd>
            </button>
            {dueCount > 0 ? (
              <Tooltip content={t('Nav tip memberships due', { count: dueCount })}>
                <button
                  type="button"
                  onClick={() => setConfirmExpiryOpen(true)}
                  disabled={runningExpiry}
                  className="relative flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors border disabled:opacity-50 bg-pits-warning-soft hover:bg-pits-warning-edge text-pits-warning border-pits-warning-edge"
                >
                  <Clock size={16} className={runningExpiry ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline text-xs font-semibold">
                    {t('{{count}} memberships due', { count: dueCount })}
                  </span>
                  <span className="sm:hidden text-xs font-bold">{dueCount > 99 ? '99+' : dueCount}</span>
                </button>
              </Tooltip>
            ) : null}

            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                className="flex items-center rounded-lg px-2 py-1.5 -mr-2 hover:bg-pits-shell-edge transition-colors"
              >
                <span className="w-8 h-8 bg-pits-shell-accent rounded-full flex items-center justify-center text-pits-dark-text font-bold text-xs">
                  {userInitials}
                </span>
                <span className="ml-3 font-bold text-sm text-pits-shell-ink-muted hidden sm:inline">
                  {userFullName || t('Admin')}
                </span>
                <ChevronDown size={14} className="ml-1 text-pits-shell-ink-muted hidden sm:inline" />
              </button>
              {accountMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-pits-edge bg-pits-surface-elevated shadow-2xl py-1 z-[60] text-pits-text"
                >
                  <Link
                    href="/dashboard/profile"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-pits-surface-muted"
                  >
                    <User size={16} className="text-pits-dim" />
                    {t('My Profile')}
                  </Link>
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Languages size={16} className="text-pits-dim" />
                      {t('Language')}
                    </span>
                    <div className="flex rounded-lg border border-pits-edge p-0.5" role="group" aria-label={t('Language')}>
                      {(['es', 'en'] as const).map((code) => (
                        <button
                          key={code}
                          type="button"
                          aria-pressed={lang === code}
                          onClick={() => setLanguage(code)}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                            lang === code ? 'bg-pits-text text-white' : 'text-pits-dim hover:text-pits-text'
                          }`}
                        >
                          {code.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="my-1 border-t border-pits-edge" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-pits-danger hover:bg-pits-danger-soft"
                  >
                    <LogOut size={16} />
                    {t('Log Out')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {!emailConfirmed && (
          <div className="px-4 py-2 bg-pits-warning-soft text-pits-warning text-xs font-bold uppercase tracking-wider">
            {t('Check your email to activate your account.')}
          </div>
        )}
        {platformPlan === 'trial' && isTrialExpired(platformPlan, trialEndsAt) && (
          <div className="px-4 py-2 bg-pits-danger-soft text-pits-danger text-xs font-bold uppercase tracking-wider">
            {t('Your trial has ended. The dashboard is read-only.')}
          </div>
        )}
        {platformPlan === 'trial' &&
          !isTrialExpired(platformPlan, trialEndsAt) &&
          isTrialEndingSoon(platformPlan, trialEndsAt) && (
            <TrialFounderBanner
              date={trialEndsAt}
              gymName={boxName}
              t={t}
              tracked={trialBannerTracked}
              onTrack={() => setTrialBannerTracked(true)}
            />
          )}

        {/* Scrollable Page Content */}
        <main
          className={`bg-pits-edge flex-1 min-w-0 min-h-0 p-4 lg:p-6 text-pits-ink ${
            pathname.includes('/dashboard/ask')
              ? 'overflow-hidden flex flex-col'
              : 'overflow-y-auto overflow-x-hidden'
          }`}
        >
          {activeNav && activeNav.group.tabs.length > 1 ? (
            <nav
              aria-label={activeNav.group.name}
              className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 mb-4 lg:mb-6 px-4 lg:px-6 border-b border-pits-border bg-pits-surface-elevated shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex items-center gap-3 min-w-max">
              <ul className="flex gap-1 min-w-max">
                {activeNav.group.tabs.map((navTab) => {
                  const selected = navTab.href === activeNav.tab.href;
                  return (
                    <li key={navTab.href}>
                      <Link
                        href={navTab.href}
                        aria-current={selected ? 'page' : undefined}
                        className={`inline-flex items-center gap-2 px-3 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                          selected
                            ? 'border-pits-primary text-pits-text'
                            : 'border-transparent text-pits-dim hover:text-pits-text'
                        }`}
                      >
                        <navTab.icon size={16} className={selected ? 'text-pits-primary' : ''} />
                        {navTab.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {activeNav.group.id === 'money' && moneyCurrency.hasTwo ? (
                <div
                  className="ml-auto flex rounded-lg border border-pits-edge bg-pits-surface-muted p-0.5"
                  role="group"
                  aria-label={t('Currency')}
                >
                  {(['reference', 'local'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={moneyCurrency.mode === mode}
                      onClick={() => moneyCurrency.setMode(mode)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                        moneyCurrency.mode === mode
                          ? 'bg-pits-surface-elevated text-pits-text shadow-sm'
                          : 'text-pits-dim hover:text-pits-text'
                      }`}
                    >
                      {mode === 'reference' ? moneyCurrency.currencies.reference : moneyCurrency.currencies.local}
                    </button>
                  ))}
                </div>
              ) : null}
              </div>
            </nav>
          ) : null}
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} pages={paletteLinks} />

      <ConfirmDialog
        isOpen={confirmExpiryOpen}
        title={t('Lock expired memberships?')}
        message={
          dueCount > 0
            ? t('Expiry lock confirm', { count: dueCount })
            : t('No members due to expire.')
        }
        confirmLabel={t('Lock access')}
        variant="warning"
        onConfirm={async () => {
          setConfirmExpiryOpen(false);
          await runExpiry();
        }}
        onCancel={() => setConfirmExpiryOpen(false)}
      />

      {platformPlan === 'trial' && (
        <a
          href={founderWhatsAppUrl(setupHelpWhatsAppText(boxName || slugFromPath(pathname)))}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-pits-primary text-pits-dark-text px-4 py-3 text-xs font-black uppercase tracking-wider shadow-lg"
        >
          <MessageCircle size={16} />
          <span className="hidden sm:inline">{t('We will help you set it up')}</span>
        </a>
      )}
    </div>
  );
}

function slugFromPath(pathname: string): string {
  const match = pathname.match(/^\/([^/]+)/);
  return match?.[1] ?? 'gym';
}

function TrialFounderBanner({
  date,
  gymName,
  t,
  tracked,
  onTrack,
}: {
  date: string | null;
  gymName: string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  tracked: boolean;
  onTrack: () => void;
}) {
  useEffect(() => {
    if (tracked) return;
    onTrack();
    void fetch('/api/admin/setup', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trial_banner' }),
    });
  }, [tracked, onTrack]);

  const { lang } = useLanguage();
  const label = date ? formatDate(date, lang) : '';
  return (
    <div className="px-4 py-2 bg-pits-warning-soft text-pits-warning text-xs font-bold flex flex-wrap items-center gap-3">
      <span>
        {t('Your trial ends on {{date}}. Write us to keep your founding price.', {
          date: label,
        })}
      </span>
      <a
        href={founderWhatsAppUrl(setupHelpWhatsAppText(gymName))}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        WhatsApp
      </a>
    </div>
  );
}