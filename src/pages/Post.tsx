import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { FacebookPostCard } from '@/components/feed/FacebookPostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';

const Post = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
      }
    };

    fetchSession();
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (username, avatar_url, full_name),
          reactions (id, user_id, type),
          comments (id)
        `)
        .eq('id', postId)
        .is('deleted_at', null)
        .single();

      if (error) {
        // Error fetching post - silent fail
      } else {
        setPost(data);
      }
      setLoading(false);
    };

    fetchPost();
  }, [postId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] pb-20 lg:pb-0">
        <FacebookNavbar />
        <main className="pt-14">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] pb-20 lg:pb-0">
        <FacebookNavbar />
        <main className="pt-14">
          <div className="max-w-2xl mx-auto px-4 py-20">
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-5xl">😕</span>
              </div>
              <h2 className="text-2xl font-bold mb-3">Bài viết không tồn tại</h2>
              <p className="text-muted-foreground mb-6">
                Bài viết này có thể đã bị xóa hoặc bạn không có quyền xem.
              </p>
              <Button onClick={() => navigate('/')} className="bg-primary hover:bg-primary/90">
                <Home className="w-4 h-4 mr-2" />
                Về trang chủ
              </Button>
            </div>
          </div>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-20 lg:pb-0">
      <FacebookNavbar />
      <main className="pt-14">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4 hover:bg-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>

          {/* Post Card */}
          <FacebookPostCard
            post={post}
            currentUserId={currentUserId}
            onPostDeleted={() => navigate('/')}
          />

          {/* Related Posts Section */}
          <div className="mt-6 bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-lg mb-4">Bài viết liên quan</h3>
            <div className="text-center py-8 text-muted-foreground">
              <p>Chức năng đang phát triển</p>
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
};

export default Post;
