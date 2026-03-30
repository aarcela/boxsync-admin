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
  Zap
} from 'lucide-react';
import Image from 'next/image';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Attendance', href: '/dashboard/attendance', icon: ClipboardCheck },
    { name: 'Financials', href: '/dashboard/financials', icon: DollarSign }, 
    { name: 'Insights', href: '/dashboard/financials/insights', icon: Zap }, 
    { name: 'Athletes', href: '/dashboard/athletes', icon: Users },
    { name: 'Schedule', href: '/dashboard/schedule', icon: CalendarDays },
    { name: 'WOD Editor', href: '/dashboard/wods', icon: Dumbbell },
    { name: 'News', href: '/dashboard/news', icon: Megaphone },
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
                Log Out
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="flex items-center">
            <div className="w-8 h-8 bg-pits-red rounded-full flex items-center justify-center text-white font-bold text-xs">
              AD
            </div>
            <span className="ml-3 font-bold text-sm text-gray-700">Admin</span>
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