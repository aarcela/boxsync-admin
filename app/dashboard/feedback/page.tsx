'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Star, User, Calendar, MessageSquare, Search, 
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Phone, Filter, ArrowRight
} from 'lucide-react';
import { useLanguage } from '../../../components/LanguageContext';
import { useToast } from '../../../components/Toast';

interface Feedback {
  id: string;
  booking_id: string;
  user_id: string;
  coach_id: string;
  class_id: string;
  rating: number;
  comment: string;
  created_at: string;
  athlete: {
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
  };
  coach: {
    full_name: string;
  };
  class: {
    class_type: string;
    start_time: string;
  };
}

interface CoachEvaluation {
  id: string;
  name: string;
  todayAR: number;
  todayCount: number;
  weekAR: number;
  weekCount: number;
  monthAR: number;
  monthCount: number;
  allTimeAR: number;
  allTimeCount: number;
  trend: 'up' | 'down' | 'stable';
  alert: boolean;
}

const ITEMS_PER_PAGE = 10;
const TREND_THRESHOLD = 0.2;
const ALERT_THRESHOLD = 4.2;

export default function FeedbackPage() {
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterCoach, setFilterCoach] = useState<string>('all');
  const [coaches, setCoaches] = useState<{ id: string; full_name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Evaluation Stats
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [globalAvg, setGlobalAvg] = useState(0);
  const [evaluations, setEvaluations] = useState<CoachEvaluation[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    fetchFeedback();
    fetchStats();
    fetchCoaches();
  }, [currentPage, filterRating, filterCoach]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchFeedback();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchStats = async () => {
    const { data, error } = await supabase
      .from('coach_feedback')
      .select('rating, coach_id, created_at, coach:profiles!coach_id(full_name)');
    
    if (!error && data) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const globalSum = data.reduce((acc, curr) => acc + curr.rating, 0);
      setGlobalAvg(globalSum / (data.length || 1));
      setCriticalCount(data.filter(f => f.rating <= 3).length);

      // Aggregation logic
      const agg: Record<string, any> = {};
      
      data.forEach(f => {
        const cid = f.coach_id;
        const ts = new Date(f.created_at).getTime();
        
        if (!agg[cid]) {
          agg[cid] = { 
            name: (f.coach as any)?.full_name || 'N/A',
            tSum: 0, tCount: 0,
            wSum: 0, wCount: 0,
            mSum: 0, mCount: 0,
            aSum: 0, aCount: 0
          };
        }

        const c = agg[cid];
        // All time
        c.aSum += f.rating; c.aCount++;
        // Month
        if (ts >= startOfMonth) { c.mSum += f.rating; c.mCount++; }
        // Week
        if (ts >= sevenDaysAgo) { c.wSum += f.rating; c.wCount++; }
        // Today
        if (ts >= today) { c.tSum += f.rating; c.tCount++; }
      });

      const coachEvals: CoachEvaluation[] = Object.entries(agg).map(([id, c]) => {
        const weekAR = c.wCount > 0 ? c.wSum / c.wCount : 0;
        const allTimeAR = c.aSum / c.aCount;
        
        // Trend Detection
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (c.wCount >= 3) { // Min volume for trend
          if (weekAR > allTimeAR + TREND_THRESHOLD) trend = 'up';
          else if (weekAR < allTimeAR - TREND_THRESHOLD) trend = 'down';
        }

        return {
          id,
          name: c.name,
          todayAR: c.tCount > 0 ? c.tSum / c.tCount : 0,
          todayCount: c.tCount,
          weekAR,
          weekCount: c.wCount,
          monthAR: c.mCount > 0 ? c.mSum / c.mCount : 0,
          monthCount: c.mCount,
          allTimeAR,
          allTimeCount: c.aCount,
          trend,
          alert: (c.wCount >= 3 && weekAR < ALERT_THRESHOLD) || (weekAR < allTimeAR - 0.5)
        };
      });

      setEvaluations(coachEvals.sort((a, b) => b.monthAR - a.monthAR).slice(0, 3));
    }
  };

  const fetchCoaches = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['coach', 'manager', 'admin'])
      .order('full_name');
    if (data) setCoaches(data);
  };

  const fetchFeedback = async () => {
    setLoading(true);
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('coach_feedback')
      .select(`
        *,
        athlete:profiles!user_id(full_name, avatar_url, phone),
        coach:profiles!coach_id(full_name),
        class:classes!class_id(class_type, start_time)
      `, { count: 'exact' });

    if (filterRating !== null) query = query.eq('rating', filterRating);
    if (searchTerm) query = query.ilike('comment', `%${searchTerm}%`);
    if (filterCoach !== 'all') query = query.eq('coach_id', filterCoach);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      setFeedback(data as any);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getARColor = (val: number) => {
    if (val === 0) return 'text-pits-dim';
    if (val >= 4.5) return 'text-pits-success';
    if (val >= ALERT_THRESHOLD) return 'text-pits-primary';
    return 'text-pits-error';
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={`${
              star <= rating ? 'fill-current' : 'text-pits-dim'
            } ${star <= rating ? getARColor(rating) : ''}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col overflow-hidden">
      {/* COMPACT STRATEGIC HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-pits-surface-elevated p-4 rounded-xl border border-pits-edge shadow-sm gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-pits-text uppercase italic tracking-tighter leading-none mb-1">
            {t('Service Quality Control')}
          </h2>
          <p className="text-pits-dim font-bold text-[10px] uppercase tracking-widest opacity-60">
            {t('Strategic monitoring and coach evaluation')}
          </p>
        </div>

        {/* INTEGRATED GLOBAL METRICS */}
        <div className="flex gap-2 w-full md:w-auto">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-pits-surface-muted rounded-lg border border-pits-edge min-w-[110px]">
             <div className="flex flex-col">
                <span className="text-[8px] font-black text-pits-dim uppercase tracking-tighter leading-none">{t('Avg Rating')}</span>
                <span className="text-lg font-black text-pits-text leading-none">{globalAvg.toFixed(1)}</span>
             </div>
             <TrendingUp size={14} className="text-pits-success" />
          </div>
          <div className="flex items-center gap-3 px-3 py-1.5 bg-pits-surface-muted rounded-lg border border-pits-edge min-w-[110px]">
             <div className="flex flex-col">
                <span className="text-[8px] font-black text-pits-dim uppercase tracking-tighter leading-none">{t('Critical')}</span>
                <span className={`text-lg font-black leading-none ${criticalCount > 0 ? 'text-pits-error' : 'text-pits-text'}`}>{criticalCount}</span>
             </div>
             <AlertTriangle size={14} className={criticalCount > 0 ? 'text-pits-error animate-pulse' : 'text-pits-dim'} />
          </div>
        </div>
      </div>

      {/* COMPACT EVALUATION COCKPIT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        {evaluations.map((val) => (
          <div key={val.id} className={`bg-pits-surface-elevated p-3 rounded-xl border shadow-sm relative overflow-hidden transition-all hover:border-pits-red ${val.alert ? 'border-pits-edge' : 'border-pits-edge'}`}>
            {val.alert && (
              <div className="absolute top-0 right-0 bg-pits-error text-pits-text text-[7px] font-black uppercase px-2 py-0.5 rounded-bl-lg tracking-widest">
                {t('Needs Attention')}
              </div>
            )}
            
            <div className="flex justify-between items-start mb-2">
              <div className="max-w-[70%]">
                <h3 className="text-sm font-black text-pits-text uppercase italic tracking-tight truncate leading-none mb-1">
                  {val.name}
                </h3>
                <div className="flex items-center gap-1.5">
                   {val.trend === 'up' && <TrendingUp size={12} className="text-pits-success" />}
                   {val.trend === 'down' && <TrendingDown size={12} className="text-pits-error" />}
                   <span className={`text-[10px] font-black uppercase tracking-widest ${
                     val.trend === 'up' ? 'text-pits-success' : val.trend === 'down' ? 'text-pits-error' : 'text-pits-dim'
                   }`}>
                     {val.trend === 'up' ? 'Improving' : val.trend === 'down' ? 'Declining' : 'Stable'}
                   </span>
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className={`text-xl font-black leading-none ${getARColor(val.monthAR)}`}>
                  {val.monthAR > 0 ? val.monthAR.toFixed(1) : "N/A"}
                </span>
                <span className="text-[9px] font-extrabold text-pits-dim uppercase leading-none mt-1 tracking-tighter">30D Avg</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 p-2 bg-pits-surface-elevated rounded-xl border border-pits-edge">
               {[
                 { l: 'Today', v: val.todayAR },
                 { l: '7 Days', v: val.weekAR },
                 { l: '30 Days', v: val.monthAR },
                 { l: 'All Time', v: val.allTimeAR }
               ].map((p, i) => (
                 <div key={i} className="flex flex-col items-center border-r last:border-0 border-pits-edge/50">
                    <span className="text-[8px] font-black text-pits-dim tracking-tighter uppercase mb-0.5">{p.l.split(' ')[0]}</span>
                    <span className={`text-[13px] font-black ${getARColor(p.v)}`}>{p.v > 0 ? p.v.toFixed(1) : '-'}</span>
                 </div>
               ))}
            </div>
          </div>
        ))}
        {evaluations.length === 0 && Array.from({length: 3}).map((_, i) => (
           <div key={i} className="bg-pits-surface-elevated border border-dashed border-pits-edge p-3 rounded-xl flex flex-col items-center justify-center min-h-[70px]">
              <div className="text-[8px] font-bold text-pits-dim uppercase tracking-widest">{t('N/A')}</div>
           </div>
        ))}
      </div>

      {/* COMPACT SEARCH & FILTERS */}
      <div className="bg-pits-panel px-4 py-3 rounded-xl shadow-lg flex flex-col md:flex-row gap-2 items-center shrink-0">
           <div className="relative flex-1 w-full">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pits-dim" size={16} />
             <input 
               type="text" 
               placeholder={t('Search by athlete or coach...')}
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-lg font-medium text-pits-text placeholder-gray-500 focus:border-pits-red outline-none shadow-sm text-[11px]"
             />
           </div>
           
           <div className="flex gap-2 w-full md:w-auto">
             <select
               value={filterCoach}
               onChange={(e) => { setFilterCoach(e.target.value); setCurrentPage(1); }}
               className="flex-1 md:flex-none bg-pits-surface-muted border border-pits-edge rounded-lg px-2 py-2 text-[10px] font-bold text-pits-text outline-none focus:border-pits-red cursor-pointer"
             >
               <option value="all" className="text-black">All Coaches</option>
               {coaches.map(c => (
                 <option key={c.id} value={c.id} className="text-black">{c.full_name}</option>
               ))}
             </select>

             <div className="flex items-center gap-1 bg-pits-ink/5 border border-pits-edge rounded-lg p-1">
                <button
                  onClick={() => { setFilterRating(null); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${
                    filterRating === null ? 'bg-pits-surface-elevated text-pits-text' : 'text-pits-dim hover:text-pits-text'
                  }`}
                >
                  {t('All')}
                </button>
                {[5, 4, 3].map((r) => (
                  <button
                    key={r}
                    onClick={() => { setFilterRating(r); setCurrentPage(1); }}
                    className={`px-2 py-1 rounded-md text-[9px] font-black flex items-center gap-1 transition-all ${
                      filterRating === r ? 'bg-pits-surface-elevated text-pits-text font-black' : 'text-pits-dim hover:text-pits-text font-bold'
                    }`}
                  >
                    {r}{r === 3 ? '-' : ''}<Star size={9} className={filterRating === r ? 'fill-current text-pits-primary' : ''} />
                  </button>
                ))}
             </div>
           </div>
      </div>

      {/* FEEDBACK LIST */}
      <div className="flex-1 bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm overflow-hidden flex flex-col">
        <div className="p-3 bg-pits-surface-muted border-b border-pits-edge flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-pits-text text-[10px] uppercase tracking-widest italic">
              {t('All Feedback')}
            </h3>
            <span className="bg-pits-panel text-pits-text text-[9px] px-1.5 py-0.5 rounded-md font-black">{totalCount}</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-wider text-pits-dim">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pits-error" /> {t('Critical')}</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pits-primary-soft0" /> {t('Neutral')}</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pits-success" /> {t('Excellent')}</span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center text-pits-dim">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pits-red"></div>
            </div>
          ) : feedback.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-pits-dim p-12">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p className="font-bold text-sm uppercase italic tracking-widest">{t('No feedback found.')}</p>
            </div>
          ) : (
            <div className="divide-y divide-pits-edge">
              {feedback.map((item) => (
                <div key={item.id} className={`p-6 hover:bg-pits-surface-elevated transition-colors ${item.rating <= 3 ? 'bg-pits-primary-soft/20' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-full bg-pits-surface-muted border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                          {item.athlete?.avatar_url ? (
                            <img src={item.athlete.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User size={28} className="text-pits-dim" />
                          )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-md bg-pits-surface-elevated`}>
                           <span className={`text-[11px] font-black ${getARColor(item.rating)}`}>{item.rating}</span>
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-black text-pits-text uppercase italic tracking-tighter text-xl leading-none">
                            {item.athlete?.full_name || t('Anonymous')}
                          </h4>
                          <span className="text-[9px] font-black text-pits-dim border border-pits-edge px-2 py-0.5 rounded uppercase tracking-tighter">
                            {t('Athlete')}
                          </span>
                        </div>
                        <div className="mb-3">
                           {renderStars(item.rating)}
                        </div>
                        <p className="text-pits-text font-medium leading-relaxed max-w-3xl text-sm antialiased">
                          {item.comment ? `"${item.comment}"` : <span className="text-pits-dim italic text-[11px]">{t('Quantitative assessment only')}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end justify-between self-stretch shrink-0 gap-4">
                      <div className="flex flex-col gap-1.5 md:items-end">
                        <div className="flex items-center gap-2 text-[11px] font-black text-pits-text bg-pits-surface-muted px-3 py-1.5 rounded-lg">
                          <User size={12} className="text-pits-red" />
                          <span className="text-pits-dim uppercase tracking-tighter">{t('Coach:')}</span>
                          <span className="uppercase italic">{item.coach?.full_name || t('N/A')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-black text-pits-text bg-pits-surface-muted px-3 py-1.5 rounded-lg">
                          <Calendar size={12} className="text-pits-red" />
                          <span className="uppercase italic">
                            {item.class?.class_type || t('Class')} • {item.class?.start_time ? new Date(item.class.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : t('N/A')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-auto">
                        {item.athlete?.phone ? (
                          <a 
                            href={`https://wa.me/${item.athlete.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase italic tracking-wider transition-all shadow-sm ${
                              item.rating <= 3 
                              ? 'bg-pits-error text-pits-text hover:bg-pits-primary-dark' 
                              : 'bg-pits-surface-elevated border border-pits-edge text-pits-text hover:bg-pits-primary hover:text-pits-dark-text hover:border-pits-primary'
                            }`}
                          >
                            <Phone size={14} />
                            {t('Contact Athlete')}
                          </a>
                        ) : (
                          <button 
                            onClick={() => toast(`Contact ${item.athlete?.full_name || t('Athlete')} directly (No phone on file)`, 'warning')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase italic tracking-wider transition-all shadow-sm bg-pits-surface-muted text-pits-dim border border-pits-edge cursor-not-allowed"
                          >
                            <Phone size={14} />
                            {t('Contact Athlete')}
                          </button>
                        )}
                        
                        <span className="text-[10px] font-bold text-pits-dim uppercase tracking-widest ml-2">
                          {new Date(item.created_at).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER PAGINATION */}
        <div className="p-4 bg-pits-surface-muted border-t border-pits-edge flex items-center justify-between">
          <p className="text-[10px] font-black text-pits-dim uppercase tracking-widest italic">
            {t('Showing {{count}} of {{total}} entries', { count: feedback.length, total: totalCount })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              className="p-2 bg-pits-surface-elevated border border-pits-edge rounded-lg hover:bg-pits-primary-dark hover:text-pits-text text-pits-text transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage <= 3 ? i + 1 : (currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i);
                if (pageNum <= 0 || pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-xs font-black transition-all ${
                      currentPage === pageNum 
                        ? 'bg-pits-primary text-pits-dark-text shadow-lg rotate-1' 
                        : 'bg-pits-surface-elevated border border-pits-edge text-pits-dim hover:border-black hover:text-pits-text'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || loading}
              className="p-2 bg-pits-surface-elevated border border-pits-edge rounded-lg hover:bg-pits-primary-dark hover:text-pits-text text-pits-text transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
      `}</style>
    </div>
  );
}
