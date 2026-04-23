'use client';

import { useState, useEffect } from 'react';
import { communityService, Post, PostType } from '@/lib/services/communityService';
import { useLanguage } from '@/components/LanguageContext';
import { 
  Trash2, 
  MessageSquare, 
  Heart, 
  Calendar, 
  User as UserIcon,
  Filter,
  RefreshCw,
  Eye,
  Image as ImageIcon,
  Trophy,
  Dumbbell,
  Megaphone,
  TrendingUp
} from 'lucide-react';
import Image from 'next/image';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';

export default function CommunityPage() {
  const { t } = useLanguage();
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
      case 'achievement': return <Trophy className="text-yellow-500" size={16} />;
      case 'wod_share': return <Dumbbell className="text-blue-500" size={16} />;
      case 'announcement': return <Megaphone className="text-pits-red" size={16} />;
      default: return <MessageSquare className="text-gray-500" size={16} />;
    }
  };

  const filteredPosts = filterType === 'all' 
    ? posts 
    : posts.filter(p => p.type === filterType);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-pits-black uppercase tracking-tight">
            {t('Community Control')}
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            {t('Manage and moderate user posts from the community feed')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-pits-red/20 focus:border-pits-red transition-all"
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
            className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-pits-red hover:border-pits-red transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-pits-red/10 rounded-xl flex items-center justify-center text-pits-red">
            <MessageSquare size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('Total Posts')}</p>
            <p className="text-2xl font-black text-pits-black">{posts.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
            <Heart size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('Total Likes')}</p>
            <p className="text-2xl font-black text-pits-black">
              {posts.reduce((acc, p) => acc + (p.likes_count || 0), 0)}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-500">
            <Trophy size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('Achievements')}</p>
            <p className="text-2xl font-black text-pits-black">
              {posts.filter(p => p.type === 'achievement').length}
            </p>
          </div>
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('User')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('Content')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('Type')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('Stats')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('Date')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="group hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-sm">
                        {post.profiles?.avatar_url ? (
                          <Image 
                            src={post.profiles.avatar_url} 
                            alt={post.profiles.full_name || ''} 
                            fill 
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <UserIcon size={20} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-pits-black">
                          {post.profiles?.full_name || t('Unknown Athlete')}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                          ID: {post.user_id.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs md:max-w-md">
                      <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
                        {post.content}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {post.type === 'wod_share' && post.metadata?.score && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-pits-red/10 text-pits-red rounded-md font-black text-[10px] uppercase tracking-wider">
                            <TrendingUp size={10} />
                            {t('Score')}: {post.metadata.score}
                          </div>
                        )}
                        {post.media_url && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md font-bold text-[10px] uppercase tracking-wider">
                            <ImageIcon size={10} />
                            {t('Attached Media')}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full w-fit">
                      {getPostIcon(post.type)}
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-tight">
                        {t(post.type)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-4 text-gray-400">
                      <div className="flex items-center gap-1">
                        <Heart size={14} className={post.likes_count > 0 ? 'text-pink-500 fill-pink-500' : ''} />
                        <span className="text-xs font-bold">{post.likes_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare size={14} className={post.comments_count > 0 ? 'text-blue-500 fill-blue-500' : ''} />
                        <span className="text-xs font-bold">{post.comments_count || 0}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Calendar size={14} />
                      <span className="text-xs font-medium">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {post.media_url && (
                        <a 
                          href={post.media_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-pits-red hover:bg-pits-red/5 rounded-lg transition-all"
                          title={t('View Media')}
                        >
                          <Eye size={18} />
                        </a>
                      )}
                      <button
                        onClick={() => setIsDeleting(post.id)}
                        className="p-2 text-gray-400 hover:text-pits-red hover:bg-pits-red/5 rounded-lg transition-all"
                        title={t('Delete Post')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredPosts.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                        <MessageSquare size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-black text-pits-black uppercase tracking-tight">{t('No posts found')}</p>
                        <p className="text-sm text-gray-400 font-medium">{t('Try changing your filter or check back later')}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="p-6 border-t border-gray-50 flex justify-center">
            <button
              onClick={() => fetchPosts()}
              disabled={loading}
              className="px-6 py-2.5 bg-pits-black text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-pits-red transition-all disabled:opacity-50 disabled:hover:bg-pits-black flex items-center gap-2"
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
