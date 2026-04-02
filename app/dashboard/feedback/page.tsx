'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Star, User, Calendar, MessageSquare, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../../components/LanguageContext';

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
  };
  coach: {
    full_name: string;
  };
  class: {
    class_type: string;
    start_time: string;
  };
}

const ITEMS_PER_PAGE = 10;

export default function FeedbackPage() {
  const { lang, t } = useLanguage();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    fetchFeedback();
    fetchStats();
  }, [currentPage, filterRating]); // Re-fetch on page or rating filter change

  // We handle search with a small delay to avoid too many requests
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
    // Only fetch general stats once or when filter changes if needed
    // For now just basic avg
    const { data, error } = await supabase
      .from('coach_feedback')
      .select('rating');
    
    if (!error && data) {
      const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
      setAvgRating(sum / (data.length || 1));
    }
  };

  const fetchFeedback = async () => {
    setLoading(true);
    
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('coach_feedback')
      .select(`
        *,
        athlete:profiles!user_id(full_name, avatar_url),
        coach:profiles!coach_id(full_name),
        class:classes!class_id(class_type, start_time)
      `, { count: 'exact' });

    // Apply Rating Filter
    if (filterRating !== null) {
      query = query.eq('rating', filterRating);
    }

    // Apply Search Filter (Note: Supabase doesn't easily support cross-table search in a single query
    // so we'll limit search to the comment field on the server, or fetch more.
    // For a truly premium experience across all fields, an RPC or View would be better.
    // Here we'll search the comment field on the server.)
    if (searchTerm) {
      query = query.ilike('comment', `%${searchTerm}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      setFeedback(data as any);
      setTotalCount(count || 0);
    } else if (error) {
      console.error('Error fetching feedback:', error);
    }
    setLoading(false);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={`${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-pits-text uppercase italic tracking-tighter">
            {t('Coach Feedback')}
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            {t('Review ratings and comments from athletes.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* SEARCH */}
          <div className="relative flex-1 md:flex-none md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder={t('Search comments...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-700 focus:border-pits-red outline-none shadow-sm text-sm"
            />
          </div>

          {/* RATING FILTER */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => { setFilterRating(null); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                filterRating === null ? 'bg-white text-pits-text shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t('All')}
            </button>
            {[5, 4, 3, 2, 1].map((r) => (
              <button
                key={r}
                onClick={() => { setFilterRating(r); setCurrentPage(1); }}
                className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                  filterRating === r ? 'bg-white text-pits-text shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {r}<Star size={12} className={filterRating === r ? 'fill-yellow-400 text-yellow-400' : ''} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FEEDBACK LIST */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-pits-dim text-xs uppercase tracking-wider">
            {t('All Feedback')} ({totalCount})
          </h3>
          <div className="flex items-center gap-4 text-xs font-bold text-pits-dim">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              <span>{t('Avg Rating')}: {avgRating.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pits-red"></div>
            </div>
          ) : feedback.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 p-12">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p className="font-medium">{t('No feedback found.')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {feedback.map((item) => (
                <div key={item.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* LEFT: Athlete and Rating */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                        {item.athlete?.avatar_url ? (
                          <img src={item.athlete.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={24} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-black text-pits-text uppercase italic tracking-tighter text-lg leading-none">
                            {item.athlete?.full_name || t('Anonymous')}
                          </h4>
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                            {t('Athlete')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          {renderStars(item.rating)}
                          <span className="text-xs font-black text-pits-text">{item.rating}/5</span>
                        </div>
                        <p className="text-pits-text font-medium leading-relaxed max-w-2xl">
                          "{item.comment || t('No comment provided.')}"
                        </p>
                      </div>
                    </div>

                    {/* RIGHT: Context (Coach, Class, Date) */}
                    <div className="flex flex-col gap-2 md:items-end shrink-0">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                        <User size={14} className="text-pits-red" />
                        <span className="text-gray-400 uppercase tracking-tight">{t('Coach:')}</span>
                        <span className="text-pits-text uppercase italic">{item.coach?.full_name || t('N/A')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                        <Calendar size={14} className="text-pits-red" />
                        <span className="text-pits-text uppercase italic">
                          {item.class?.class_type || t('Class')} • {item.class?.start_time ? new Date(item.class.start_time).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('N/A')}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        {new Date(item.created_at).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {t('Showing {{count}} of {{total}} entries', { count: feedback.length, total: totalCount })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                
                if (pageNum <= 0 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                      currentPage === pageNum 
                        ? 'bg-pits-red text-white shadow-md' 
                        : 'bg-white border border-gray-200 text-gray-400 hover:border-pits-red hover:text-pits-red'
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
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
