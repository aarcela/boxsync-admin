'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Wallet,
  ChevronDown,
  Scale,
  MessagesSquare,
  Trophy,
  Tags,
  Layers,
  CreditCard,
  Banknote,
  Receipt,
  Clock,
  Rocket
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import Tooltip from '@/components/Tooltip';
import { financialService } from '@/lib/services/financialService';
import Image from 'next/image';

type NavSubItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  tip: string;
};

type NavLinkItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  tip: string;
};

type NavParentItem = {
  name: string;
  icon: LucideIcon;
  tip: string;
  subItems: NavSubItem[];
};

type NavItem = NavLinkItem | NavParentItem;

type NavSection = {
  id: string;
  /** Empty = no header (used when the only item is an accordion with the same name). */
  label: string;
  items: NavItem[];
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Always start closed so SSR + first client paint match (avoid hydration mismatch).
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { lang, setLanguage, t } = useLanguage();
  const { name: boxName } = useTenant();
  const { toast } = useToast();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [runningExpiry, setRunningExpiry] = useState(false);
  const [confirmExpiryOpen, setConfirmExpiryOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsSidebarOpen(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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

  const navSections = useMemo((): NavSection[] => {
    const moneySubItems: NavSubItem[] = [
      { name: t('Money overview'), href: '/dashboard/financials', icon: DollarSign, tip: t('Nav tip Money overview') },
      { name: t('Income'), href: '/dashboard/income', icon: TrendingUp, tip: t('Nav tip Income') },
      { name: t('Expenses'), href: '/dashboard/expenses', icon: Wallet, tip: t('Nav tip Expenses') },
      { name: t('Who has paid'), href: '/dashboard/accountability', icon: Scale, tip: t('Nav tip Who has paid') },
      { name: t('Membership Plans'), href: '/dashboard/plans', icon: Tags, tip: t('Nav tip Membership Plans') },
      { name: t('How they pay'), href: '/dashboard/payment_methods', icon: CreditCard, tip: t('Nav tip How they pay') },
      { name: t('Reports'), href: '/dashboard/financials/insights', icon: BarChart3, tip: t('Nav tip Reports') },
    ];

    if (userRole === 'admin') {
      moneySubItems.push(
        { name: t('Salary'), href: '/dashboard/salary', icon: Banknote, tip: t('Nav tip Salary') },
        { name: t('Payroll'), href: '/dashboard/payroll', icon: Receipt, tip: t('Nav tip Payroll') },
      );
    }

    return [
      {
        id: 'today',
        label: t('Today'),
        items: [
          { name: t('Home'), href: '/dashboard', icon: LayoutDashboard, tip: t('Nav tip Home') },
          { name: t('Nav Check-in'), href: '/dashboard/attendance', icon: ClipboardCheck, tip: t('Nav tip Check-in') },
          { name: t('Athletes'), href: '/dashboard/athletes', icon: Users, tip: t('Nav tip Athletes') },
        ],
      },
      {
        id: 'classes',
        label: '',
        items: [
          {
            name: t('Classes'),
            icon: Dumbbell,
            tip: t('Nav tip Classes'),
            subItems: [
              { name: t('Schedule'), href: '/dashboard/schedule', icon: CalendarDays, tip: t('Nav tip Schedule') },
              { name: t('Daily workouts'), href: '/dashboard/wods', icon: Dumbbell, tip: t('Nav tip Daily workouts') },
              { name: t('Class Types'), href: '/dashboard/class_types', icon: Layers, tip: t('Nav tip Class Types') },
              { name: t('Personal Records'), href: '/dashboard/personal_records', icon: Trophy, tip: t('Nav tip Personal Records') },
            ],
          },
        ],
      },
      {
        id: 'money',
        label: '',
        items: [
          {
            name: t('Money'),
            icon: DollarSign,
            tip: t('Nav tip Money'),
            subItems: moneySubItems,
          },
        ],
      },
      {
        id: 'talk',
        label: t('Talk to members'),
        items: [
          { name: t('Announcements'), href: '/dashboard/news', icon: Megaphone, tip: t('Nav tip Announcements') },
          { name: t('Push notifications'), href: '/dashboard/notifications', icon: Bell, tip: t('Nav tip Push notifications') },
          { name: t('Community'), href: '/dashboard/community', icon: MessagesSquare, tip: t('Nav tip Community') },
          { name: t('Feedback'), href: '/dashboard/feedback', icon: MessageSquare, tip: t('Nav tip Feedback') },
        ],
      },
      {
        id: 'results',
        label: t('Results'),
        items: [
          { name: t('Box health'), href: '/dashboard/performance', icon: TrendingUp, tip: t('Nav tip Box health') },
        ],
      },
      {
        id: 'special',
        label: t('Special'),
        items: [
          { name: t('Founding Pilot'), href: '/dashboard/pilot', icon: Rocket, tip: t('Nav tip Founding Pilot') },
        ],
      },
    ];
  }, [t, userRole]);

  const toggleMenu = (menuName: string) => {
    setOpenMenus((prev) => (prev.includes(menuName) ? [] : [menuName]));
  };

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

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
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* SIDEBAR */}
      <aside 
        className={`bg-pits-shell text-pits-shell-ink transition-all duration-300 ease-in-out flex flex-col
          fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0
          ${isSidebarOpen 
            ? 'w-64 translate-x-0' 
            : '-translate-x-full lg:translate-x-0 lg:w-20'}
        `}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4">
          <div className={`flex-1 flex items-center py-4 ${isSidebarOpen ? 'justify-start pl-2' : 'justify-center'}`}>
            {isSidebarOpen ? (
               <>
              <Image src="/assets/logo.png" alt="Logo" className="w-10 h-10" width={40} height={40} />
              <span className="font-black text-2xl text-pits-white ml-2">WODUS</span>
               </>
            ) : (
              <span className="font-black text-2xl text-pits-shell-accent">W</span>
            )}
          </div>
          
          {/* Close button for mobile */}
          {isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-pits-shell-ink-muted hover:text-pits-shell-accent transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation — min-h-0 + overflow so expanded submenus stay scrollable */}
        <nav className="flex-1 min-h-0 overflow-y-auto py-6 space-y-4 px-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {navSections.map((section) => (
            <div key={section.id} className="space-y-1">
              {isSidebarOpen && section.label && (
                <p className="px-3 pt-1 pb-1 text-[9px] font-black uppercase tracking-widest text-pits-shell-ink-muted/70">
                  {section.label}
                </p>
              )}
              {!isSidebarOpen && section.id !== 'today' && (
                <div className="mx-2 my-2 border-t border-pits-shell-edge" />
              )}
              {section.items.map((item) => {
                const hasSubItems = 'subItems' in item && item.subItems && item.subItems.length > 0;
                const isMenuOpen =
                  openMenus.includes(item.name) ||
                  ('subItems' in item && item.subItems?.some((sub) => pathname === sub.href) === true);
                const isActive =
                  'href' in item
                    ? pathname === item.href
                    : 'subItems' in item && item.subItems?.some((sub) => pathname === sub.href);

                return (
                  <div key={`${section.id}-${item.name}`} className="space-y-1">
                    {hasSubItems ? (
                      <Tooltip content={item.tip} side="right" className="w-full">
                        <button
                          type="button"
                          onClick={() => toggleMenu(item.name)}
                          className={`w-full flex items-center p-3 rounded-lg transition-colors group border-2 border-transparent
                            ${isActive
                              ? 'border-pits-shell-accent text-pits-shell-ink'
                              : 'text-pits-shell-ink-muted hover:border-pits-shell-edge hover:text-pits-shell-ink'}
                          `}
                        >
                          <item.icon size={20} className={isActive ? 'text-pits-shell-accent' : 'text-pits-shell-ink-muted group-hover:text-pits-shell-accent'} />
                          {isSidebarOpen && (
                            <>
                              <span className="ml-3 font-bold text-sm uppercase tracking-wide flex-1 text-left">
                                {item.name}
                              </span>
                              <ChevronDown
                                size={16}
                                className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
                              />
                            </>
                          )}
                        </button>
                      </Tooltip>
                    ) : 'href' in item ? (
                      <Tooltip content={item.tip} side="right" className="w-full">
                        <Link
                          href={item.href}
                          onClick={closeSidebarOnMobile}
                          className={`w-full flex items-center p-3 rounded-lg transition-colors group border-2 border-transparent
                            ${isActive
                              ? 'border-pits-shell-accent text-pits-shell-ink'
                              : 'text-pits-shell-ink-muted hover:border-pits-shell-edge hover:text-pits-shell-ink'}
                          `}
                        >
                          <item.icon size={20} className={isActive ? 'text-pits-shell-accent' : 'text-pits-shell-ink-muted group-hover:text-pits-shell-accent'} />
                          {isSidebarOpen && (
                            <span className="ml-3 font-bold text-sm uppercase tracking-wide">
                              {item.name}
                            </span>
                          )}
                        </Link>
                      </Tooltip>
                    ) : null}

                    {hasSubItems && isMenuOpen && isSidebarOpen && 'subItems' in item && (
                      <div className="ml-4 space-y-1 border-l border-pits-shell-edge pl-2">
                        {item.subItems.map((sub) => {
                          const isSubActive = pathname === sub.href;
                          return (
                            <Tooltip key={sub.href} content={sub.tip} side="right" className="w-full">
                              <Link
                                href={sub.href}
                                onClick={closeSidebarOnMobile}
                                className={`w-full flex items-center p-2 rounded-lg transition-colors group border-2 border-transparent
                                  ${isSubActive
                                    ? 'border-pits-shell-accent text-pits-shell-ink'
                                    : 'text-pits-shell-ink-muted hover:border-pits-shell-edge hover:text-pits-shell-ink'}
                                `}
                              >
                                <sub.icon size={16} className={isSubActive ? 'text-pits-shell-accent' : 'text-pits-shell-ink-muted group-hover:text-pits-shell-accent'} />
                                <span className="ml-3 font-bold text-[11px] uppercase tracking-wide">
                                  {sub.name}
                                </span>
                              </Link>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer / Logout */}
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="flex items-center w-full p-2 rounded-lg text-pits-shell-ink-muted hover:border hover:border-pits-shell-edge hover:text-pits-shell-accent transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && (
              <span className="ml-3 font-bold text-sm uppercase tracking-wide">
                {t('Log Out')}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-pits-shell shadow-lg flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-md hover:bg-pits-shell-edge text-pits-shell-ink-muted hover:text-pits-shell-accent transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            {/* Language Toggle */}
            <div className="flex items-center bg-pits-black border border-pits-shell-edge rounded-full p-1 ml-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                  lang === 'en' ? 'bg-pits-shell-accent text-pits-dark-text shadow-sm' : 'text-pits-shell-ink-muted hover:text-pits-shell-ink'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                  lang === 'es' ? 'bg-pits-shell-accent text-pits-dark-text shadow-sm' : 'text-pits-shell-ink-muted hover:text-pits-shell-ink'
                }`}
              >
                ES
              </button>
            </div>

            {boxName && (
              <span className="font-black text-sm sm:text-base uppercase tracking-tight text-pits-shell-ink truncate max-w-[32vw] sm:max-w-xs">
                {boxName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Tooltip
              content={
                dueCount > 0
                  ? t('Nav tip memberships due', { count: dueCount })
                  : t('Nav tip Update expired memberships')
              }
            >
              <button
                type="button"
                onClick={() => setConfirmExpiryOpen(true)}
                disabled={runningExpiry}
                className={`relative flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors border disabled:opacity-50 ${
                  dueCount > 0
                    ? 'bg-pits-red/15 hover:bg-pits-red/25 text-pits-red border-pits-red/40'
                    : 'bg-pits-shell-edge hover:bg-pits-black text-pits-shell-ink-muted hover:text-pits-shell-accent border-pits-shell-edge'
                }`}
              >
                <Clock size={16} className={runningExpiry ? 'animate-spin' : ''} />
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wide">
                  {t('Update expired memberships')}
                </span>
                {dueCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-pits-red text-white text-[9px] font-black leading-none flex items-center justify-center">
                    {dueCount > 99 ? '99+' : dueCount}
                  </span>
                )}
              </button>
            </Tooltip>

            <Link
              href="/dashboard/profile"
              className="flex items-center rounded-lg px-2 py-1.5 -mr-2 hover:bg-pits-shell-edge transition-colors"
            >
            <div className="w-8 h-8 bg-pits-shell-accent rounded-full flex items-center justify-center text-pits-dark-text font-bold text-xs">
              {userInitials}
            </div>
            <span className="ml-3 font-bold text-sm text-pits-shell-ink-muted hidden sm:inline">
              {userFullName || t('Admin')}
            </span>
            </Link>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="bg-pits-edge flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6 text-pits-ink">
          {children}
        </main>
      </div>

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
    </div>
  );
}