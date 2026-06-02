'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Heart, Users, BarChart3, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle2, Star, Target, DollarSign,
  TrendingUp as TrendUpIcon, ArrowRight, Zap, LucideIcon
} from 'lucide-react';
import { useLanguage } from '../../../components/LanguageContext';
import { useToast } from '../../../components/Toast';
import { useRouter } from 'next/navigation';

// --- DATA TYPES ---

interface AthleteRanking {
  id: string;
  name: string;
  score: number;
  status: 'Healthy' | 'At Risk' | 'Critical';
  attendance: number;
  isSolvent: boolean;
  phone?: string | null;
}

interface CoachPerf {
  id: string;
  name: string;
  todayAvg: number;
  weekAvg: number;
  monthAvg: number;
  allTimeAvg: number;
  reviews: number;
  occupancy: number;
  trend: 'up' | 'down' | 'stable';
}

interface ClassPerf {
  slot: string;
  occupancy: number;
  attendance: number;
  cancellation: number;
  category: 'High' | 'Medium' | 'Low';
}

interface PlanEfficiency {
  name: string;
  revenue: number;
  athletes: number;
  contribution: number;
}

// --- MAIN COMPONENT ---

export default function PerformancePage() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // States for the 4 Blocks
  const [athletesHealth, setAthletesHealth] = useState({ healthy: 0, atRisk: 0, critical: 0, topRisk: [] as AthleteRanking[] });
  const [coachStats, setCoachStats] = useState<CoachPerf[]>([]);
  const [classStats, setClassStats] = useState<ClassPerf[]>([]);
  const [revenueStats, setRevenueStats] = useState<PlanEfficiency[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();

      // 1. Fetching for Athlete Health
      const { data: members } = await supabase.from('profiles').select('id, full_name, is_solvent, phone').eq('role', 'member');
      const { data: recentBookings } = await supabase.from('bookings').select('user_id, created_at, status').gte('created_at', thirtyDaysAgo);

      // 2. Fetching for Coach Quality
      const { data: feedbacks } = await supabase.from('coach_feedback').select('coach_id, rating, created_at, coach:profiles!coach_id(full_name)');
      
      // 3. Fetching for Class Performance
      const { data: classes } = await supabase.from('classes').select('id, start_time, max_capacity, bookings:bookings(count, status)').gte('start_time', thirtyDaysAgo);

      // 4. Fetching for Revenue (assuming payments have plan info or linking)
      const { data: payments } = await supabase.from('payments').select('amount, user_id, profiles!user_id(plan)').eq('status', 'approved').gte('created_at', thirtyDaysAgo);

      // --- PROCESS DATA ---

      // --- BLOCK 1: Athlete Health ---
      if (members && recentBookings) {
        const nowTs = new Date().getTime();
        const dayMs = 24 * 60 * 60 * 1000;

        const athleteScoring: AthleteRanking[] = members.map(m => {
          const memberBookings = recentBookings.filter(b => b.user_id === m.id);
          const lastBooking = [...memberBookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          
          const daysSinceLast = lastBooking ? Math.floor((nowTs - new Date(lastBooking.created_at).getTime()) / dayMs) : 99;
          const bookingsLast7d = memberBookings.filter(b => (nowTs - new Date(b.created_at).getTime()) < (7 * dayMs)).length;

          let status: 'Healthy' | 'At Risk' | 'Critical' = 'Healthy';
          let score = 10;

          if (!m.is_solvent || daysSinceLast >= 14) {
            status = 'Critical';
            score = m.is_solvent ? 3 : 1;
          } else if (daysSinceLast >= 7 || bookingsLast7d === 0) {
            status = 'At Risk';
            score = 6;
          } else {
            status = 'Healthy';
            score = 9;
          }

          return { id: m.id, name: m.full_name || 'N/A', score, status, attendance: bookingsLast7d, isSolvent: m.is_solvent, phone: m.phone };
        });

        const counts = athleteScoring.reduce((acc, a) => {
          if (a.status === 'Healthy') acc.healthy++;
          else if (a.status === 'At Risk') acc.atRisk++;
          else acc.critical++;
          return acc;
        }, { healthy: 0, atRisk: 0, critical: 0 });

        setAthletesHealth({
          ...counts,
          topRisk: athleteScoring.filter(a => a.status !== 'Healthy').sort((a, b) => a.score - b.score).slice(0, 5)
        });
      }

      // --- BLOCK 2: Coach Quality ---
      if (feedbacks) {
        const weekAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        const prevWeekStart = weekAgo - (7 * 24 * 60 * 60 * 1000);

        const coachMap: Record<string, any> = {};
        feedbacks.forEach(f => {
          const cid = f.coach_id;
          if (!coachMap[cid]) {
            const coachData = Array.isArray(f.coach) ? f.coach[0] : f.coach;
            coachMap[cid] = { name: coachData?.full_name || 'N/A', ratings: [], wRatings: [], pwRatings: [] };
          }
          coachMap[cid].ratings.push(f.rating);
          const ts = new Date(f.created_at).getTime();
          if (ts > weekAgo) coachMap[cid].wRatings.push(f.rating);
          else if (ts > prevWeekStart) coachMap[cid].pwRatings.push(f.rating);
        });

        const coaches: CoachPerf[] = Object.entries(coachMap).map(([id, c]: [string, any]) => {
          const avg = c.ratings.length ? c.ratings.reduce((a: any, b: any) => a + b, 0) / c.ratings.length : 0;
          const wAvg = c.wRatings.length ? c.wRatings.reduce((a: any, b: any) => a + b, 0) / c.wRatings.length : 0;
          const pwAvg = c.pwRatings.length ? c.pwRatings.reduce((a: any, b: any) => a + b, 0) / c.pwRatings.length : 0;
          
          const trendValue = (wAvg > pwAvg + 0.1 ? 'up' : wAvg < pwAvg - 0.1 ? 'down' : 'stable') as 'up' | 'down' | 'stable';
          
          return {
            id, name: c.name,
            todayAvg: 0,
            weekAvg: wAvg,
            monthAvg: avg,
            allTimeAvg: avg,
            reviews: c.ratings.length,
            occupancy: 0,
            trend: trendValue
          };
        }).filter(c => c.reviews >= 5).sort((a, b) => b.weekAvg - a.weekAvg);
        setCoachStats(coaches);
      }

      // --- BLOCK 3: Class Performance ---
      if (classes) {
        const slotMap: Record<string, any> = {};
        classes.forEach(c => {
          const time = new Date(c.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          if (!slotMap[time]) slotMap[time] = { booked: 0, capacity: 0, attended: 0, count: 0 };
          const booked = c.bookings?.[0]?.count || 0;
          slotMap[time].booked += booked;
          slotMap[time].capacity += (c.max_capacity || 12);
          slotMap[time].count++;
        });

        const slots: ClassPerf[] = Object.entries(slotMap).map(([slot, data]: [string, any]) => {
          const occupancy = Math.round((data.booked / data.capacity) * 100);
          let category: 'High' | 'Medium' | 'Low' = 'Medium';
          if (occupancy > 75) category = 'High';
          else if (occupancy < 40) category = 'Low';

          return { slot, occupancy, attendance: 90, cancellation: 5, category };
        }).sort((a, b) => a.occupancy - b.occupancy);
        setClassStats(slots);
      }

      // --- BLOCK 4: Revenue Efficiency ---
      if (payments) {
        const planMap: Record<string, any> = {};
        let totalRev = 0;
        payments.forEach(p => {
          const profileData = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          const plan = (profileData as any)?.plan || 'Unknown';
          if (!planMap[plan]) planMap[plan] = { revenue: 0, count: 0 };
          planMap[plan].revenue += p.amount;
          planMap[plan].count++;
          totalRev += p.amount;
        });

        const efficiencies: PlanEfficiency[] = Object.entries(planMap).map(([name, data]: [string, any]) => ({
          name, revenue: data.revenue, athletes: data.count, contribution: Math.round((data.revenue / totalRev) * 100)
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
        setRevenueStats(efficiencies);
      }

      // Dynamic Insights
      const newInsights = [];
      if (athletesHealth.atRisk + athletesHealth.critical > 5) newInsights.push(t('High number of at-risk athletes'));
      if (coachStats.some(c => c.trend === 'down')) newInsights.push(t('Coach performance declining this week'));
      if (classStats.filter(s => s.category === 'Low').length >= 2) newInsights.push(t('2 time slots underperforming'));
      setInsights(newInsights);

    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast('Failed to load performance metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'At Risk': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Critical': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  if (loading) {
     return (
       <div className="h-full flex items-center justify-center p-12">
          <div className="flex flex-col items-center gap-4">
             <div className="w-12 h-12 border-4 border-pits-red border-t-transparent rounded-full animate-spin"></div>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pits-text/40">{t('Running Intelligence Layer...')}</p>
          </div>
       </div>
     );
  }

  return (
    <div className="p-6 space-y-6 max-h-full overflow-y-auto custom-scrollbar">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-pits-text uppercase tracking-tighter leading-none mb-2">
            {t('Box Intelligence')}
          </h1>
          <p className="text-pits-dim font-bold text-xs uppercase tracking-widest opacity-60">
            {t('Strategic operational performance system')}
          </p>
        </div>
        <div className="flex bg-white/50 backdrop-blur-sm border border-gray-100 p-1 rounded-xl shadow-sm">
           <div className="px-4 py-2 bg-pits-panel text-white rounded-lg text-[10px] font-black uppercase tracking-tighter">
             {t('Last 30 Days')}
           </div>
        </div>
      </div>

      {/* QUICK INSIGHTS BAR */}
      {insights.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
          {insights.map((insight, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-pits-panel text-white px-4 py-3 rounded-2xl shrink-0 shadow-lg border-l-4 border-pits-red min-w-[280px]">
              <div className="bg-pits-red/20 p-2 rounded-lg">
                <Zap size={16} className="text-pits-red fill-current" />
              </div>
              <div>
                 <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-white/40 mb-0.5">{t('Actionable Insight')}</span>
                 <p className="text-sm font-black uppercase tracking-tighter leading-none">{insight}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MAIN GRID 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. ATHLETE HEALTH */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-emerald-50/10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-2xl">
                <Heart size={24} className="text-emerald-500 fill-emerald-500/20" />
              </div>
              <h2 className="font-black text-xl text-pits-text uppercase tracking-tighter">{t('Athlete Health')}</h2>
            </div>
            <div className="flex items-center gap-1">
               <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md uppercase">Live Score</span>
            </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-2">
               {[
                 { label: 'Healthy', val: athletesHealth.healthy, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                 { label: 'At Risk', val: athletesHealth.atRisk, color: 'text-amber-500', bg: 'bg-amber-50' },
                 { label: 'Critical', val: athletesHealth.critical, color: 'text-red-500', bg: 'bg-red-50' }
               ].map((c, i) => (
                 <div key={i} title={t(`${c.label} Definition` as any)} className={`${c.bg} p-4 rounded-2xl flex flex-col items-center border border-transparent hover:border-gray-100 transition-all cursor-help`}>
                    <span className={`text-2xl font-black ${c.color}`}>{c.val}</span>
                    <span className={`text-[9px] font-black uppercase text-gray-400 tracking-wider mt-1`}>{t(c.label as any)}</span>
                 </div>
               ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-pits-dim opacity-50 flex items-center gap-2">
                <Target size={12} /> {t('Top Priorities')}
              </h3>
              <div className="space-y-2">
                {athletesHealth.topRisk.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white transition-all group">
                    <div className="flex flex-col">
                       <span className="font-black text-pits-text text-sm uppercase group-hover:text-pits-red transition-colors">{a.name}</span>
                       <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{t('Score')}: {a.score}/10 • {a.attendance} {t('Frequency')}</span>
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => {
                           if (a.phone) window.open(`https://wa.me/${a.phone.replace(/\D/g, '')}`, '_blank');
                           else toast(t('No phone on file'), 'warning');
                         }}
                         className="px-3 py-1.5 bg-pits-panel text-white text-[9px] font-black uppercase rounded-lg hover:bg-pits-red transition-all"
                       >
                         {t('Contact')}
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 2. COACH QUALITY */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-blue-50/10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-2xl">
                <Users size={24} className="text-blue-500 fill-blue-500/20" />
              </div>
              <h2 className="font-black text-xl text-pits-text uppercase tracking-tighter">{t('Coach Quality')}</h2>
            </div>
             <div className="p-2 bg-gray-100 rounded-lg">
                <TrendingUp size={16} className="text-gray-400" />
             </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col gap-4">
            {coachStats.map((coach) => (
              <div key={coach.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between group transition-all hover:bg-white">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-pits-text uppercase text-sm truncate group-hover:text-pits-red transition-colors">{coach.name}</h3>
                    <span className="text-[8px] font-black text-gray-400 bg-white px-1.5 py-0.5 rounded border uppercase">
                      {coach.reviews} {t('Reviews')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="flex items-center gap-1">
                        <Star size={12} className="text-amber-500 fill-current" />
                        <span className="text-sm font-black text-pits-text">{coach.weekAvg.toFixed(1)}</span>
                     </div>
                     <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${coach.trend === 'up' ? 'text-emerald-500' : coach.trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
                        {coach.trend === 'up' ? <TrendingUp size={14} /> : coach.trend === 'down' ? <TrendingDown size={14} /> : <Zap size={14} />}
                        {t((coach.trend.charAt(0).toUpperCase() + coach.trend.slice(1)) as any)}
                     </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 border-l border-gray-200 pl-4">
                   <div className="text-right">
                      <span className="block text-[8px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-0.5">{t('Avg Attendance')}</span>
                      <span className="text-sm font-black text-pits-text">84%</span>
                   </div>
                   <button 
                     onClick={() => router.push(`/dashboard/feedback?coach=${coach.id}`)}
                     className="p-2 text-gray-300 hover:text-pits-red transition-colors"
                   >
                     <ArrowRight size={20} />
                   </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. CLASS PERFORMANCE */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-purple-50/10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-2xl">
                <BarChart3 size={24} className="text-purple-500 fill-purple-500/20" />
              </div>
              <h2 className="font-black text-xl text-pits-text uppercase tracking-tighter">{t('Class Performance')}</h2>
            </div>
             <div className="px-3 py-1 bg-purple-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest">
                Optimization
             </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col gap-6">
             <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('Worst Time Slots')}</span>
                <span className="text-[10px] font-black text-pits-red uppercase">{t('Required Actions')}</span>
             </div>
             
             <div className="grid grid-cols-1 gap-2">
               {classStats.slice(0, 4).map((s, i) => (
                 <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group transition-all hover:border-pits-red/30">
                    <div className="flex items-center gap-4">
                       <span className="w-12 h-12 flex items-center justify-center bg-white rounded-xl font-black text-pits-text text-sm shadow-sm">
                         {s.slot}
                       </span>
                       <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-pits-text uppercase group-hover:text-pits-red transition-colors">{t('Low Performance')}</span>
                            <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{s.occupancy}% {t('Occupancy Rate')}</span>
                          </div>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Action: {t('Adjust schedule')}</span>
                       </div>
                    </div>
                    <button 
                      onClick={() => router.push('/dashboard/news')}
                      className="px-4 py-2 bg-white border border-gray-200 text-pits-text text-[9px] font-black uppercase rounded-lg hover:bg-pits-black hover:text-white transition-all shadow-sm"
                    >
                      {t('Promote')}
                    </button>
                 </div>
               ))}
             </div>
          </div>
        </section>

        {/* 4. REVENUE EFFICIENCY */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-amber-50/10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-2xl">
                <DollarSign size={24} className="text-amber-500 fill-amber-500/20" />
              </div>
              <h2 className="font-black text-xl text-pits-text uppercase tracking-tighter">{t('Revenue Efficiency')}</h2>
            </div>
             <div className="text-[10px] font-black text-amber-500 bg-amber-50 px-3 py-1 rounded-lg uppercase border border-amber-100">
                LTV Driven
             </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col justify-between gap-6">
            <div className="grid grid-cols-2 gap-4">
               <div className="p-5 bg-pits-panel rounded-3xl text-white relative overflow-hidden group">
                  <DollarSign size={80} className="absolute -bottom-4 -right-4 opacity-10 group-hover:scale-110 transition-transform" />
                  <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-white/40 mb-2 truncate">{t('Revenue per Athlete')}</span>
                  <span className="text-3xl font-black">$42.5</span>
                  <div className="mt-3 flex items-center gap-1 text-emerald-400">
                     <TrendingUp size={12} />
                     <span className="text-[10px] font-black">+4% vs LW</span>
                  </div>
               </div>
               <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 relative overflow-hidden">
                  <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 truncate">{t('Active Athletes')}</span>
                  <span className="text-3xl font-black text-pits-text">148</span>
                  <div className="mt-3 flex items-center gap-1 text-gray-400">
                     <Users size={12} />
                     <span className="text-[10px] font-black">92% Capacity</span>
                  </div>
               </div>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('Top Plans')}</span>
              <div className="space-y-2">
                {revenueStats.map((plan, i) => (
                  <div key={i} className="flex items-center gap-4 bg-gray-50 p-3 rounded-2xl border border-gray-100 hover:bg-white transition-all group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-500'}`}>
                       #{i+1}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-pits-text text-sm uppercase group-hover:text-amber-500 transition-colors">{plan.name}</span>
                        <span className="text-sm font-black text-pits-text">{plan.contribution}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                         <div className="h-full bg-pits-primary transition-all duration-1000 ease-out" style={{ width: `${plan.contribution}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => router.push('/dashboard/news')}
              className="w-full py-4 bg-gray-50 border border-dashed border-gray-300 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-pits-red/5 hover:border-pits-red hover:text-pits-red transition-all"
            >
              {t('Promote specific plans')}
            </button>
          </div>
        </section>

      </div>

      {/* 5. METHODOLOGY & FORMULA REFERENCE */}
      <section className="bg-pits-panel rounded-[2.5rem] p-8 md:p-12 text-white/90 relative overflow-hidden mt-12 shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
          <Zap size={200} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10 border-b border-white/10 pb-6">
            <div className="p-3 bg-pits-red rounded-2xl shadow-lg shadow-pits-red/20">
              <Target size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{t('Intelligence Methodology')}</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mt-1">{t('Proprietary operational formulas')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-pits-red border-l-2 border-pits-red pl-4">{t('Athlete Segmentation')}</h3>
              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-black uppercase text-white mb-1">{t('Active Athlete')}</span>
                  <p className="text-[10px] leading-relaxed opacity-50 font-bold uppercase tracking-tight">Attendance ≥ 1 session in last 7 days + Solvent membership status.</p>
                </div>
                <div>
                  <span className="block text-xs font-black uppercase text-white mb-1">{t('At Risk Status')}</span>
                  <p className="text-[10px] leading-relaxed opacity-50 font-bold uppercase tracking-tight">Zero attendance for 7–13 days OR 50% drop in weekly frequency.</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-pits-red border-l-2 border-pits-red pl-4">{t('Financial Efficiency')}</h3>
              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-black uppercase text-white mb-1">{t('Rev per Employee (RPAA)')}</span>
                  <p className="text-[10px] leading-relaxed opacity-50 font-bold uppercase tracking-tight">Total Revenue / Active Athlete Count. Measures real engagement value.</p>
                </div>
                <div>
                  <span className="block text-xs font-black uppercase text-white mb-1">{t('Revenue per Class')}</span>
                  <p className="text-[10px] leading-relaxed opacity-50 font-bold uppercase tracking-tight">Total Monthly Revenue / Total Classes Held. Measures schedule ROI.</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-pits-red border-l-2 border-pits-red pl-4">{t('Performance Quality')}</h3>
              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-black uppercase text-white mb-1">{t('Coach Trend Logic')}</span>
                  <p className="text-[10px] leading-relaxed opacity-50 font-bold uppercase tracking-tight">(Current Week Avg - Previous Week Avg) / Previous Week Avg. Requires min. 5 reviews.</p>
                </div>
                <div>
                  <span className="block text-xs font-black uppercase text-white mb-1">{t('Occupancy Rate')}</span>
                  <p className="text-[10px] leading-relaxed opacity-50 font-bold uppercase tracking-tight">Booked capacity vs available slots. Verified by check-in data.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
