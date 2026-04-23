'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
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
  MessagesSquare
} from 'lucide-react';
import { useLanguage } from '../../components/LanguageContext';
import Image from 'next/image';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { lang, setLanguage, t } = useLanguage();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const toggleMenu = (menuName: string) => {
    setOpenMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(m => m !== menuName) 
        : [...prev, menuName]
    );
  };

  // Auto-expand menu if sub-item is active
  useEffect(() => {
    navItems.forEach(item => {
      if ('subItems' in item && item.subItems?.some(sub => pathname === sub.href)) {
        if (!openMenus.includes(item.name)) {
          setOpenMenus(prev => [...prev, item.name]);
        }
      }
    });

    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [pathname]);

  // Initial responsive check
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems = [
    { name: t('Overview'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('Attendance'), href: '/dashboard/attendance', icon: ClipboardCheck },
    { 
      name: t('Financial'), 
      icon: DollarSign,
      subItems: [
        { name: t('Dashboard'), href: '/dashboard/financials', icon: DollarSign },
        { name: t('Expenses'), href: '/dashboard/expenses', icon: Wallet },
        { name: t('Accountability'), href: '/dashboard/accountability', icon: Scale },
        { name: t('Insights'), href: '/dashboard/financials/insights', icon: Zap },
      ]
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
      ]
    },
    { name: t('Feedback'), href: '/dashboard/feedback', icon: MessageSquare },
    { name: t('Performance'), href: '/dashboard/performance', icon: TrendingUp },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      
      {/* MOBILE BACKDROP */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* SIDEBAR */}
      <aside 
        className={`bg-gray-900 text-white transition-all duration-300 ease-in-out flex flex-col
          fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0
          ${isSidebarOpen 
            ? 'w-64 translate-x-0' 
            : '-translate-x-full lg:translate-x-0 lg:w-20'}
        `}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          <div className={`flex-1 flex items-center ${isSidebarOpen ? 'justify-start pl-2' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <Image src="/assets/logo.png" alt="Logo" width={100} height={100} />
            ) : (
              <span className="font-black text-2xl text-[#FF2800]">P</span>
            )}
          </div>
          
          {/* Close button for mobile */}
          {isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 space-y-2 px-3">
          {navItems.map((item) => {
            const hasSubItems = 'subItems' in item && item.subItems && item.subItems.length > 0;
            const isMenuOpen = openMenus.includes(item.name);
            const isActive = 'href' in item 
              ? pathname === item.href 
              : 'subItems' in item && item.subItems?.some(sub => pathname === sub.href);
            
            return (
              <div key={item.name} className="space-y-1">
                {hasSubItems ? (
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={`w-full flex items-center p-3 rounded-lg transition-colors group
                      ${isActive && !isMenuOpen
                        ? 'bg-gray-800 text-white' 
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
                    `}
                  >
                    <item.icon size={20} className={isActive ? 'text-pits-red' : 'text-gray-400 group-hover:text-white'} />
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
                ) : (
                  <Link
                    href={(item as any).href}
                    className={`flex items-center p-3 rounded-lg transition-colors group
                      ${isActive 
                        ? 'bg-pits-red text-white' 
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
                    `}
                  >
                    <item.icon size={20} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'} />
                    {isSidebarOpen && (
                      <span className="ml-3 font-bold text-sm uppercase tracking-wide">
                        {item.name}
                      </span>
                    )}
                  </Link>
                )}

                {hasSubItems && isMenuOpen && isSidebarOpen && (
                  <div className="ml-4 space-y-1 border-l border-gray-800 pl-2">
                    {(item as any).subItems.map((sub: any) => {
                      const isSubActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.name}
                          href={sub.href}
                          className={`flex items-center p-2 rounded-lg transition-colors group
                            ${isSubActive 
                              ? 'bg-pits-red text-white' 
                              : 'text-gray-500 hover:bg-gray-800 hover:text-white'}
                          `}
                        >
                          <sub.icon size={16} className={isSubActive ? 'text-white' : 'text-gray-500 group-hover:text-white'} />
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
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center w-full p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-[#FF2800] transition-colors"
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            {/* Language Toggle */}
            <div className="flex items-center bg-gray-50 border border-gray-100 rounded-full p-1 ml-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                  lang === 'en' ? 'bg-pits-red text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                  lang === 'es' ? 'bg-pits-red text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                ES
              </button>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="w-8 h-8 bg-pits-red rounded-full flex items-center justify-center text-white font-bold text-xs">
              AD
            </div>
            <span className="ml-3 font-bold text-sm text-gray-700">{t('Admin')}</span>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

    </div>
  );
}