'use client';

import { useState } from 'react';
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
  Wallet
} from 'lucide-react';
import { useLanguage } from '../../components/LanguageContext';
import { Globe } from 'lucide-react';
import Image from 'next/image';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { lang, setLanguage, t } = useLanguage();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems = [
    { name: t('Overview'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('Attendance'), href: '/dashboard/attendance', icon: ClipboardCheck },
    { name: t('Financials'), href: '/dashboard/financials', icon: DollarSign }, 
    { name: t('Insights'), href: '/dashboard/financials/insights', icon: Zap }, 
    { name: t('Athletes'), href: '/dashboard/athletes', icon: Users },
    { name: t('Schedule'), href: '/dashboard/schedule', icon: CalendarDays },
    { name: t('WOD Editor'), href: '/dashboard/wods', icon: Dumbbell },
    { name: t('News'), href: '/dashboard/news', icon: Megaphone },
    { name: t('Feedback'), href: '/dashboard/feedback', icon: MessageSquare },
    { name: t('Performance'), href: '/dashboard/performance', icon: TrendingUp },
    { name: t('Expenses'), href: '/dashboard/expenses', icon: Wallet },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      
      {/* SIDEBAR */}
      <aside 
        className={`bg-gray-900 text-white transition-all duration-300 ease-in-out flex flex-col
          ${isSidebarOpen ? 'w-64' : 'w-20'}
        `}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-center border-b border-gray-800">
          {isSidebarOpen ? (
            <Image src="/assets/logo.png" alt="Logo" width={100} height={100} />
          ) : (
            <span className="font-black text-2xl text-[#FF2800]">P</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 space-y-2 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
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
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

    </div>
  );
}