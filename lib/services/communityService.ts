import { supabase } from '../supabase';
import { Profile } from '../types/gym';

export type PostType = 'general' | 'achievement' | 'wod_share' | 'announcement';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  type: PostType;
  metadata: Record<string, any>;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
}

export interface CreatePostInput {
  content: string;
  type: PostType;
  mediaUri?: string | null;
  wodScore?: string | null;
}

export const communityService = {
  async getPosts(page: number = 0, pageSize: number = 20): Promise<Post[]> {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching posts:', error);
      return [];
    }

    return (data ?? []) as unknown as Post[];
  },

  async deletePost(postId: string): Promise<void> {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;
  },

  async createPost(input: CreatePostInput): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Build metadata
    const metadata: Record<string, any> = {};
    if (input.type === 'wod_share' && input.wodScore?.trim()) {
      metadata.score = input.wodScore.trim();
    }

    const { error } = await supabase.from('posts').insert({
      user_id:   user.id,
      content:   input.content.trim(),
      type:      input.type,
      media_url: input.mediaUri || null, // Assuming media is already uploaded or provided as URL in this context
      metadata,
    });

    if (error) throw error;
  },

  async uploadMedia(file: File, userId: string): Promise<string | null> {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `posts/${userId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('community')
        .upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage.from('community').getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      console.error('uploadMedia error:', err);
      return null;
    }
  },
};
