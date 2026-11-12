'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Megaphone, Bell } from 'lucide-react';
import CreateNewsModal from '@/components/AddNewsModal';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/utils/format-date';
import ConfirmDialog from '@/components/ConfirmDialog';
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
  const { t, lang } = useLanguage();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [toRemove, setToRemove] = useState<NewsItem | null>(null);

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
    setToRemove(null);
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
          <h1 className="page-title">
            {t('News & Alerts')}
          </h1>
          <p className="page-subtitle">{t('Broadcast updates to the athlete mobile app.')}</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-pits-primary text-pits-dark-text text-sm font-semibold shadow-sm hover:bg-pits-primary-dark"
        >
          <Plus size={16} />
          {t('Post Update')}
        </button>
      </div>

      {/* List */}
      <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-pits-dim">{t('Loading feed...')}</div>
        ) : news.length === 0 ? (
          <div className="p-12 text-center text-pits-dim flex flex-col items-center">
            <Bell size={32} className="mb-3 text-pits-dim" />
            <p className="text-sm">{t('No active announcements.')}</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-3 text-sm font-semibold text-pits-info hover:underline"
            >
              {t('Post Update')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-pits-edge">
            {news.map((item) => (
              <div key={item.id} className="p-4 hover:bg-pits-surface-muted/50 transition-colors flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
                    item.tag === 'ALERT' ? 'bg-pits-danger-soft text-pits-danger' :
                    item.tag === 'EVENT' ? 'bg-pits-info-soft text-pits-info' :
                    'bg-pits-surface-muted text-pits-text'
                  }`}>
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        item.tag === 'ALERT' ? 'bg-pits-danger-soft text-pits-danger' :
                        item.tag === 'EVENT' ? 'bg-pits-info-soft text-pits-info' :
                        'bg-pits-surface-muted text-pits-dim'
                      }`}>
                        {t(item.tag)}
                      </span>
                      <span className="text-xs text-pits-dim">
                        {formatDate(item.created_at, lang)}
                      </span>
                    </div>
                    <h4 className="font-bold text-pits-text">{item.title}</h4>
                    {item.body && (
                      <p className="text-sm text-pits-dim mt-1 leading-relaxed">{item.body}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setToRemove(item)}
                  aria-label={t('Remove')}
                  title={t('Remove')}
                  className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg text-pits-dim hover:text-pits-danger hover:bg-pits-danger-soft"
                >
                  <Trash2 size={18} />
                </button>

              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!toRemove}
        title={t('Remove')}
        message={t('Remove this announcement?')}
        confirmLabel={t('Remove')}
        variant="danger"
        onConfirm={() => toRemove && void deleteNews(toRemove.id)}
        onCancel={() => setToRemove(null)}
      />

      <CreateNewsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchNews}
      />

    </div>
  );
}