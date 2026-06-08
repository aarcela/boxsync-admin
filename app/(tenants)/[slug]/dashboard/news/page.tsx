'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Megaphone, Bell } from 'lucide-react';
import CreateNewsModal from '@/components/AddNewsModal';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';

interface NewsItem {
  id: string;
  title: string;
  body: string | null;
  tag: 'ALERT' | 'INFO' | 'EVENT';
  created_at: string;
}

export default function NewsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNews(data as NewsItem[]);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchNews();
  }, []);

  if (!mounted) return null;

  const deleteNews = async (id: string) => {
    if (!window.confirm(t('Remove this announcement?'))) return;

    try {
      const { error } = await supabase
        .from('news')
        .update({ is_active: false })
        .eq('id', id);
        
      if (error) throw error;
      
      toast(t('Announcement removed'), 'success');
      fetchNews();
    } catch (error) {
      console.error('Error deleting news:', error);
      toast(t('Could not remove news item.'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            {t('News & Alerts')}
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            {t('Broadcast updates to the athlete mobile app.')}
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center px-4 py-3 bg-pits-primary text-pits-dark-text rounded-lg font-bold uppercase text-xs tracking-widest shadow-lg shadow-pits-primary/20 hover:bg-pits-primary-dark transition-all"
        >
          <Plus size={18} className="mr-2" />
          {t('Post Update')}
        </button>
      </div>

      {/* List */}
      <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-pits-dim">{t('Loading feed...')}</div>
        ) : news.length === 0 ? (
          <div className="p-12 text-center text-pits-dim flex flex-col items-center">
            <Bell size={48} className="mb-4 text-pits-dim" />
            <p>{t('No active announcements.')}</p>
          </div>
        ) : (
          <div className="divide-y divide-pits-edge">
            {news.map((item) => (
              <div key={item.id} className="p-4 hover:bg-pits-surface-muted transition-colors flex items-center justify-between group">
                
                <div className="flex items-center gap-4">
                  <div className={`
                    w-12 h-12 rounded-lg flex items-center justify-center
                    ${item.tag === 'ALERT' ? 'bg-pits-primary-soft text-pits-error' : 
                      item.tag === 'EVENT' ? 'bg-pits-surface-muted text-pits-primary' : 
                      'bg-pits-surface-muted text-pits-text'}
                  `}>
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded
                        ${item.tag === 'ALERT' ? 'bg-pits-primary-soft text-pits-error' : 
                          item.tag === 'EVENT' ? 'bg-pits-surface-muted text-pits-text' : 
                          'bg-pits-surface-muted text-pits-text'}
                      `}>
                        {t(item.tag)}
                      </span>
                      <span className="text-xs text-pits-dim font-bold">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-bold text-pits-text">{item.title}</h4>
                    {item.body && (
                      <p className="text-sm text-pits-dim mt-1 leading-relaxed">{item.body}</p>
                    )}
                  </div>
                </div>

                <button 
                  id={`delete-news-${item.id}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteNews(item.id);
                  }}
                  className="p-3 text-pits-error bg-pits-primary-soft hover:bg-pits-edge rounded-xl transition-all relative z-[100] cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                  title={t('Remove')}
                >
                  <Trash2 size={20} />
                </button>

              </div>
            ))}
          </div>
        )}
      </div>

      <CreateNewsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchNews}
      />

    </div>
  );
}