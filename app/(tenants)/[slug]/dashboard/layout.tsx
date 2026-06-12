'use client';

import { useState, useEffect, useMemo } from 'react';
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
  ClipboardCheck,
  Zap,
  MessageSquare,
  TrendingUp,
  Wallet,
  ChevronDown,
  Scale,
  MessagesSquare,
  Trophy,
  Tags,
  Banknote,
  Receipt
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import Image from 'next/image';

type NavSubItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type NavLinkItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type NavParentItem = {
  name: string;
  icon: LucideIcon;
  subItems: NavSubItem[];
};

type NavItem = NavLinkItem | NavParentItem;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );
  const { lang, setLanguage, t } = useLanguage();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  const navItems = useMemo((): NavItem[] => {
    const financialSubItems = [
      { name: t('Dashboard'), href: '/dashboard/financials', icon: DollarSign },
      { name: t('Expenses'), href: '/dashboard/expenses', icon: Wallet },
      { name: t('Incomes'), href: '/dashboard/income', icon: TrendingUp },
      { name: t('Accountability'), href: '/dashboard/accountability', icon: Scale },
      { name: t('Insights'), href: '/dashboard/financials/insights', icon: Zap },
    ];

    if (userRole === 'admin') {
      financialSubItems.push({
        name: t('Salary'),
        href: '/dashboard/salary',
        icon: Banknote,
      });
      financialSubItems.push({
        name: t('Payroll'),
        href: '/dashboard/payroll',
        icon: Receipt,
      });
    }

    return [
      { name: t('Overview'), href: '/dashboard', icon: LayoutDashboard },
      { name: t('Attendance'), href: '/dashboard/attendance', icon: ClipboardCheck },
      {
        name: t('Financial'),
        icon: DollarSign,
        subItems: financialSubItems,
      },
      { name: t('Athletes'), href: '/dashboard/athletes', icon: Users },
      {
        name: t('Box Management'),
        icon: Dumbbell,
        subItems: [
          { name: t('Schedule'), href: '/dashboard/schedule', icon: CalendarDays },
          { name: t('WOD Editor'), href: '/dashboard/wods', icon: Dumbbell },
          { name: t('News'), href: '/dashboard/news', icon: Megaphone },
          { name: t('Community'), href: '/dashboard/community', icon: MessagesSquare },
          { name: t('Payment Methods'), href: '/dashboard/payment_methods', icon: Wallet },
          { name: t('Membership Plans'), href: '/dashboard/plans', icon: Tags },
          { name: t('Personal Records'), href: '/dashboard/personal_records', icon: Trophy },
        ],
      },
      { name: t('Feedback'), href: '/dashboard/feedback', icon: MessageSquare },
      { name: t('Performance'), href: '/dashboard/performance', icon: TrendingUp },
    ];
  }, [t, userRole]);

  const toggleMenu = (menuName: string) => {
    setOpenMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(m => m !== menuName) 
        : [...prev, menuName]
    );
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
        .select('role')
        .eq('id', user.id)
        .single();
      if (!isStaffRole(profile?.role)) {
        await supabase.auth.signOut();
        router.replace('/');
        return;
      }
      setUserRole(profile?.role ?? null);
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

        {/* Navigation */}
        <nav className="flex-1 py-6 space-y-2 px-3">
          {navItems.map((item) => {
            const hasSubItems = 'subItems' in item && item.subItems && item.subItems.length > 0;
            const isMenuOpen =
              openMenus.includes(item.name) ||
              ('subItems' in item && item.subItems?.some(sub => pathname === sub.href) === true);
            const isActive = 'href' in item 
              ? pathname === item.href 
              : 'subItems' in item && item.subItems?.some(sub => pathname === sub.href);
            
            return (
              <div key={item.name} className="space-y-1">
                {hasSubItems ? (
                  <button
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
                ) : 'href' in item ? (
                  <Link
                    href={item.href}
                    onClick={closeSidebarOnMobile}
                    className={`flex items-center p-3 rounded-lg transition-colors group border-2 border-transparent
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
                ) : null}

                {hasSubItems && isMenuOpen && isSidebarOpen && 'subItems' in item && (
                  <div className="ml-4 space-y-1 border-l border-pits-shell-edge pl-2">
                    {item.subItems.map((sub) => {
                      const isSubActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.name}
                          href={sub.href}
                          onClick={closeSidebarOnMobile}
                          className={`flex items-center p-2 rounded-lg transition-colors group
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
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
          </div>
          
          <div className="flex items-center">
            <div className="w-8 h-8 bg-pits-shell-accent rounded-full flex items-center justify-center text-pits-dark-text font-bold text-xs">
              AD
            </div>
            <span className="ml-3 font-bold text-sm text-pits-shell-ink-muted">{t('Admin')}</span>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="bg-pits-edge flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6 text-pits-ink">
          {children}
        </main>
      </div>

    </div>
  );
}