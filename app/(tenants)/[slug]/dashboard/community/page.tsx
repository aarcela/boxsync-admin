'use client';

import { useState, useEffect } from 'react';
import { communityService, Post, PostType } from '@/lib/services/communityService';
import { formatDate } from '@/lib/utils/format-date';
import { useLanguage } from '@/components/LanguageContext';
import { 
  Trash2, 
  MessageSquare, 
  Heart, 
  User as UserIcon,
  Filter,
  RefreshCw,
  Eye,
  Trophy,
  Dumbbell,
  Megaphone,
  TrendingUp
} from 'lucide-react';
import Image from 'next/image';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';

export default function CommunityPage() {
  const { t, lang } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterType, setFilterType] = useState<PostType | 'all'>('all');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPosts = async (reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 0 : page;
      const data = await communityService.getPosts(currentPage);
      
      if (reset) {
        setPosts(data);
        setPage(1);
      } else {
        setPosts(prev => [...prev, ...data]);
        setPage(prev => prev + 1);
      }
      
      setHasMore(data.length === 20);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast(t('Error loading posts'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(true);
  }, []);

  const handleDelete = async () => {
    if (!isDeleting) return;

    try {
      await communityService.deletePost(isDeleting);
      setPosts(prev => prev.filter(p => p.id !== isDeleting));
      toast(t('Post deleted successfully'), 'success');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast(t('Error deleting post'), 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const getPostIcon = (type: PostType) => {
    switch (type) {
      case 'achievement': return <Trophy className="text-pits-primary" size={16} />;
      case 'wod_share': return <Dumbbell className="text-pits-primary" size={16} />;
      case 'announcement': return <Megaphone className="text-pits-red" size={16} />;
      default: return <MessageSquare className="text-pits-dim" size={16} />;
    }
  };

  const filteredPosts = filterType === 'all' 
    ? posts 
    : posts.filter(p => p.type === filterType);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            {t('Community Control')}
          </h1>
          <p className="text-sm text-pits-dim font-medium">
            {t('Manage and moderate user posts from the community feed')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={14} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="pl-9 pr-4 py-2 bg-pits-surface-elevated border border-pits-edge rounded-xl text-sm font-bold text-pits-text appearance-none focus:outline-none focus:ring-2 focus:ring-pits-red/20 focus:border-pits-red transition-all"
            >
              <option value="all">{t('All Types')}</option>
              <option value="general">{t('General')}</option>
              <option value="achievement">{t('Achievement')}</option>
              <option value="wod_share">{t('WOD Share')}</option>
              <option value="announcement">{t('Announcement')}</option>
            </select>
          </div>
          
          <button
            onClick={() => fetchPosts(true)}
            disabled={loading}
            className="p-2 bg-pits-surface-elevated border border-pits-edge rounded-xl text-pits-text hover:text-pits-red hover:border-pits-red transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-pits-surface-elevated p-4 rounded-2xl border border-pits-edge shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-pits-red/10 rounded-xl flex items-center justify-center text-pits-red">
            <MessageSquare size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-pits-dim uppercase tracking-wider">{t('Total Posts')}</p>
            <p className="text-2xl font-black text-pits-text">{posts.length}</p>
          </div>
        </div>
        <div className="bg-pits-surface-elevated p-4 rounded-2xl border border-pits-edge shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-pits-surface-muted rounded-xl flex items-center justify-center text-pits-primary">
            <Heart size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-pits-dim uppercase tracking-wider">{t('Total Likes')}</p>
            <p className="text-2xl font-black text-pits-text">
              {posts.reduce((acc, p) => acc + (p.likes_count || 0), 0)}
            </p>
          </div>
        </div>
        <div className="bg-pits-surface-elevated p-4 rounded-2xl border border-pits-edge shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-pits-primary-soft rounded-xl flex items-center justify-center text-pits-primary">
            <Trophy size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-pits-dim uppercase tracking-wider">{t('Achievements')}</p>
            <p className="text-2xl font-black text-pits-text">
              {posts.filter(p => p.type === 'achievement').length}
            </p>
          </div>
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden">
        {/* One card per post: reads like the feed and works at any width. */}
        <ul className="divide-y divide-pits-edge">
          {filteredPosts.map((post) => (
            <li key={post.id} className="flex gap-3 px-4 py-4 sm:px-5">
              <div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden bg-pits-surface-muted border border-pits-edge">
                {post.profiles?.avatar_url ? (
                  <Image src={post.profiles.avatar_url} alt="" fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-pits-dim">
                    <UserIcon size={18} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold text-pits-text">
                    {post.profiles?.full_name || t('Unknown Athlete')}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-pits-surface-muted px-2 py-0.5 text-[11px] font-semibold text-pits-dim">
                    {getPostIcon(post.type)}
                    {t(post.type)}
                  </span>
                  <span className="text-xs text-pits-dim">{formatDate(post.created_at, lang)}</span>
                </div>
                <p className="mt-1 text-sm text-pits-text line-clamp-3 leading-relaxed">{post.content}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-pits-dim">
                  <span className="inline-flex items-center gap-1">
                    <Heart size={14} className={post.likes_count > 0 ? 'text-pits-primary fill-pits-primary' : ''} />
                    {post.likes_count || 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare size={14} className={post.comments_count > 0 ? 'text-pits-primary fill-pits-primary' : ''} />
                    {post.comments_count || 0}
                  </span>
                  {post.type === 'wod_share' && post.metadata?.score ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-pits-text">
                      <TrendingUp size={12} />
                      {t('Score')}: {post.metadata.score}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                {post.media_url && (
                  <a
                    href={post.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-10 h-10 rounded-lg text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted"
                    aria-label={t('View Media')}
                    title={t('View Media')}
                  >
                    <Eye size={18} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setIsDeleting(post.id)}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-pits-dim hover:text-pits-danger hover:bg-pits-danger-soft"
                  aria-label={t('Delete Post')}
                  title={t('Delete Post')}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {filteredPosts.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="w-14 h-14 bg-pits-surface-muted rounded-full flex items-center justify-center text-pits-dim">
              <MessageSquare size={28} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-pits-text">{t('No posts found')}</p>
              <p className="text-sm text-pits-dim">{t('Try changing your filter or check back later')}</p>
            </div>
          </div>
        )}

        {hasMore && (
          <div className="p-6 border-t border-pits-edge flex justify-center">
            <button
              onClick={() => fetchPosts()}
              disabled={loading}
              className="px-6 py-2.5 bg-pits-primary text-pits-dark-text rounded-xl text-sm font-black uppercase tracking-widest hover:bg-pits-primary hover:text-pits-dark-text transition-all disabled:opacity-50 disabled:hover:bg-pits-black flex items-center gap-2"
            >
              {loading && <RefreshCw size={16} className="animate-spin" />}
              {loading ? t('Loading...') : t('Load More Posts')}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!isDeleting}
        onCancel={() => setIsDeleting(null)}
        onConfirm={handleDelete}
        title={t('Delete Post')}
        message={t('Are you sure you want to delete this post? This action cannot be undone.')}
        variant="danger"
      />
    </div>
  );
}
