import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ImagePlus, Video, X, Loader2, UserPlus, MapPin, MoreHorizontal, Clapperboard, CheckCircle } from 'lucide-react';
import { FILE_LIMITS, getVideoDuration } from '@/utils/imageCompression';
import { UploadQueue, UploadItem, createUploadQueue } from '@/utils/uploadQueue';
import { EmojiPicker } from './EmojiPicker';
import { VideoUploadProgress, VideoUploadState } from './VideoUploadProgress';
import { VideoUploaderUppy } from './VideoUploaderUppy';
import { FriendTagDialog, TaggedFriend } from './FriendTagDialog';
import { LocationCheckin } from './LocationCheckin';
import { PrivacySelector } from './PrivacySelector';
import { FeelingActivityDialog, FeelingActivity } from './FeelingActivityDialog';
import { MediaUploadPreview } from './MediaUploadPreview';
import { useLanguage } from '@/i18n/LanguageContext';
import { StartLiveDialog } from '@/modules/live/components/StartLiveDialog';
import { trackFunGameAction } from '@/features/fun-play/trackFunGameAction';

interface FacebookCreatePostProps {
  onPostCreated: () => void;
}

const MAX_CONTENT_LENGTH = 20000;
const MAX_FILES_PER_POST = FILE_LIMITS.MAX_FILES_PER_POST || 100;

const postSchema = z.object({
  content: z.string().max(MAX_CONTENT_LENGTH, `Nội dung tối đa ${MAX_CONTENT_LENGTH.toLocaleString()} ký tự`),
});

export const FacebookCreatePost = ({ onPostCreated }: FacebookCreatePostProps) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showStartLiveDialog, setShowStartLiveDialog] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [privacy, setPrivacy] = useState('public');
  const [isDragging, setIsDragging] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [videoUploadState, setVideoUploadState] = useState<VideoUploadState>('idle');
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [currentVideoName, setCurrentVideoName] = useState('');
  const [currentVideoId, setCurrentVideoId] = useState<string | undefined>(undefined);
  
  // Upload queue state for parallel uploads
  const uploadQueueRef = useRef<UploadQueue | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  
  // Friend tagging state
  const [showFriendTagDialog, setShowFriendTagDialog] = useState(false);
  const [taggedFriends, setTaggedFriends] = useState<TaggedFriend[]>([]);
  
  // Location check-in state
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  
  // Feeling/Activity state
  const [showFeelingDialog, setShowFeelingDialog] = useState(false);
  const [feeling, setFeeling] = useState<FeelingActivity | null>(null);
  
  // Uppy video upload state
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [uppyVideoResult, setUppyVideoResult] = useState<{ uid: string; url: string; thumbnailUrl: string; localThumbnail?: string } | null>(null);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  
  // Enhanced upload progress state
  const [uploadDetails, setUploadDetails] = useState({
    bytesUploaded: 0,
    bytesTotal: 0,
    uploadSpeed: 0,
    eta: 0,
    processingState: undefined as string | undefined,
    processingProgress: undefined as number | undefined,
  });

  // Refs for hidden file inputs (direct trigger on click) - must be before any returns
  const photoVideoInputRef = useRef<HTMLInputElement>(null);

  // Initialize upload queue
  useEffect(() => {
    const queue = createUploadQueue({
      maxConcurrent: 4,
      maxFiles: MAX_FILES_PER_POST,
      onProgress: (item) => {
        // Update handled via subscribe
      },
      onComplete: (item) => {
        console.log('[UploadQueue] Item completed:', item.id);
      },
      onError: (item, error) => {
        console.error('[UploadQueue] Item failed:', item.id, error);
        toast.error(`Upload thất bại: ${item.file.name}`);
      },
      onQueueComplete: (items) => {
        console.log('[UploadQueue] All uploads complete:', items.length);
      },
    });

    uploadQueueRef.current = queue;

    // Subscribe to updates
    const unsubscribe = queue.subscribe((items) => {
      setUploadItems([...items]);
    });

    return () => {
      unsubscribe();
      queue.destroy();
    };
  }, []);

  // Prevent accidental tab close during upload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isUploading = uploadQueueRef.current?.isUploading() || videoUploadState === 'uploading' || videoUploadState === 'processing';
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'Đang tải lên. Bạn có chắc muốn rời đi?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [videoUploadState]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, []);

  const handleFileSelect = async (files: FileList | null, accessToken?: string) => {
    if (!files || !uploadQueueRef.current) return;

    const imageFiles: File[] = [];
    const videoFiles: File[] = [];

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        toast.error(`File "${file.name}" không được hỗ trợ`);
        continue;
      }

      if (isImage && file.size > FILE_LIMITS.IMAGE_MAX_SIZE) {
        toast.error(`Ảnh "${file.name}" phải nhỏ hơn 100MB`);
        continue;
      }

      if (isVideo && file.size > FILE_LIMITS.VIDEO_MAX_SIZE) {
        toast.error(`Video "${file.name}" phải nhỏ hơn 10GB`);
        continue;
      }

      if (isVideo) {
        try {
          const duration = await getVideoDuration(file);
          if (duration > FILE_LIMITS.VIDEO_MAX_DURATION) {
            toast.error(`Video "${file.name}" phải ngắn hơn 120 phút`);
            continue;
          }
          videoFiles.push(file);
        } catch (error) {
          toast.error(`Không thể đọc video "${file.name}"`);
        }
      } else {
        imageFiles.push(file);
      }
    }

    // Handle video via Uppy (one at a time for now)
    if (videoFiles.length > 0) {
      const videoFile = videoFiles[0];
      setPendingVideoFile(videoFile);
      setCurrentVideoName(videoFile.name);
      setIsVideoUploading(true);
      setShowMediaUpload(true);
      if (videoFiles.length > 1) {
        toast.info(`Chỉ có thể upload 1 video mỗi lần. ${videoFiles.length - 1} video khác bị bỏ qua.`);
      }
    }

    // Add images to upload queue
    if (imageFiles.length > 0) {
      const { added, rejected } = await uploadQueueRef.current.addFiles(imageFiles, accessToken);
      
      if (added.length > 0) {
        setShowMediaUpload(true);
        console.log('[CreatePost] Added', added.length, 'files to queue');
      }
      
      if (rejected.length > 0) {
        rejected.forEach(({ file, reason }) => {
          toast.error(`${file.name}: ${reason}`);
        });
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, []);

  const removeMedia = (id: string) => {
    uploadQueueRef.current?.removeItem(id);
  };

  const retryMedia = (id: string) => {
    uploadQueueRef.current?.retryUpload(id);
  };

  const reorderMedia = (fromIndex: number, toIndex: number) => {
    uploadQueueRef.current?.reorderItems(fromIndex, toIndex);
  };

  const handleEmojiSelect = (emoji: string) => {
    setContent((prev) => prev + emoji);
  };

  // Submit step state for detailed feedback
  const [submitStep, setSubmitStep] = useState<'idle' | 'auth' | 'prepare_media' | 'saving' | 'done'>('idle');
  const submitAbortRef = useRef<AbortController | null>(null);

  const getSubmitButtonText = () => {
    if (isVideoUploading) return 'Đang upload video...';
    switch (submitStep) {
      case 'auth': return 'Đang xác thực...';
      case 'prepare_media': return 'Đang chuẩn bị media...';
      case 'saving': return 'Đang lưu bài viết...';
      default: return loading ? 'Đang đăng...' : 'Đăng';
    }
  };

  const handleCancelSubmit = () => {
    if (submitAbortRef.current) {
      submitAbortRef.current.abort();
    }
    setLoading(false);
    setSubmitStep('idle');
    toast.info('Đã huỷ đăng bài');
  };

  const handleSubmit = async () => {
    // Get completed image URLs from the upload queue
    const completedMedia = uploadQueueRef.current?.getCompletedUrls() || [];
    const pendingUploads = uploadItems.filter(item => item.status === 'uploading' || item.status === 'queued');
    
    console.log('[CreatePost] === SUBMIT START ===', {
      contentLength: content.length,
      completedMediaCount: completedMedia.length,
      pendingUploadsCount: pendingUploads.length,
      hasUppyVideo: !!uppyVideoResult,
      isVideoUploading,
    });
    
    // Check if there are still uploads in progress
    if (pendingUploads.length > 0) {
      toast.error(`Vui lòng đợi ${pendingUploads.length} file upload xong`);
      return;
    }
    
    if (!content.trim() && completedMedia.length === 0 && !uppyVideoResult) {
      toast.error('Vui lòng thêm nội dung hoặc media');
      return;
    }

    // Check if video is still uploading
    if (isVideoUploading) {
      toast.error('Vui lòng đợi video upload xong');
      return;
    }

    // Check content length before validation
    if (content.length > MAX_CONTENT_LENGTH) {
      toast.error(`Nội dung quá dài (${content.length.toLocaleString()}/${MAX_CONTENT_LENGTH.toLocaleString()} ký tự)`);
      return;
    }

    // Validate content length
    const validation = postSchema.safeParse({ content: content.trim() });
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    // Create abort controller for this submit
    const abortController = new AbortController();
    submitAbortRef.current = abortController;
    
    // Watchdog timeout - auto cancel after 90 seconds
    const watchdogTimeout = setTimeout(() => {
      console.error('[CreatePost] Watchdog timeout triggered (90s)');
      abortController.abort();
      setLoading(false);
      setSubmitStep('idle');
      toast.error('Đăng bài bị timeout, vui lòng thử lại');
    }, 90000);

    setLoading(true);
    setSubmitStep('auth');
    console.log('[CreatePost] Step: auth - Getting session...');
    
    try {
      // Check if aborted
      if (abortController.signal.aborted) throw new Error('Đã huỷ');
      
      // Get session with 15 second timeout
      const authStartTime = Date.now();
      let session;
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('getSession timeout (15s)')), 15000)
          )
        ]);
        session = sessionResult.data.session;
        console.log('[CreatePost] getSession completed in', Date.now() - authStartTime, 'ms');
      } catch (authError: any) {
        console.error('[CreatePost] getSession error:', authError.message);
        // Try refresh session as fallback
        console.log('[CreatePost] Trying refreshSession...');
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (!refreshData.session) {
          throw new Error('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại');
        }
        session = refreshData.session;
        console.log('[CreatePost] refreshSession succeeded');
      }
      
      if (!session) {
        console.log('[CreatePost] No session found, trying refresh...');
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (!refreshData.session) {
          throw new Error('Chưa đăng nhập');
        }
        session = refreshData.session;
      }

      console.log('[CreatePost] Auth OK, user:', session.user.id.substring(0, 8) + '...');
      setSubmitStep('prepare_media');
      console.log('[CreatePost] Step: prepare_media');
      
      if (abortController.signal.aborted) throw new Error('Đã huỷ');
      
      // Collect all media URLs (already uploaded via queue)
      const mediaUrls: Array<{ url: string; type: 'image' | 'video' }> = [];
      
      // Add Uppy-uploaded video first if exists
      if (uppyVideoResult) {
        mediaUrls.push({
          url: uppyVideoResult.url,
          type: 'video',
        });
        console.log('[CreatePost] Added video URL:', uppyVideoResult.url);
      }
      
      // Add completed images from queue
      for (const media of completedMedia) {
        mediaUrls.push(media);
      }

      console.log('[CreatePost] Media URLs prepared:', mediaUrls.length);
      
      if (abortController.signal.aborted) throw new Error('Đã huỷ');

      // For backward compatibility
      const firstImage = mediaUrls.find((m) => m.type === 'image');
      const firstVideo = mediaUrls.find((m) => m.type === 'video');

      console.log('[CreatePost] Step: saving - Calling edge function...');
      setSubmitStep('saving');

      // Call edge function with timeout
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          content: content.trim() || '',
          media_urls: mediaUrls,
          image_url: firstImage?.url || null,
          video_url: firstVideo?.url || null,
          location: location,
          tagged_user_ids: taggedFriends.map(f => f.id),
          visibility: privacy,
        }),
        signal: abortController.signal,
      });

      console.log('[CreatePost] Edge function response status:', response.status);

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('[CreatePost] Failed to parse response JSON:', jsonError);
        // If status OK but can't parse JSON, assume success
        if (response.ok) {
          console.log('[CreatePost] Assuming success despite JSON parse error');
          result = { ok: true };
        } else {
          throw new Error('Lỗi kết nối với server');
        }
      }
      
      if (!response.ok) {
        console.error('[CreatePost] Edge function error:', result);
        throw new Error(result.error || 'Không thể lưu bài viết');
      }

      console.log('[CreatePost] Success!', result);
      setSubmitStep('done');

      // Reset video upload state AFTER successful insert
      setVideoUploadState('idle');
      setVideoUploadProgress(0);
      setCurrentVideoId(undefined);
      setPendingVideoFile(null);
      setUppyVideoResult(null);

      // Cleanup upload queue
      uploadQueueRef.current?.cancelAll();
      
      setContent('');
      setTaggedFriends([]);
      setLocation(null);
      setPrivacy('public'); // Reset privacy to default
      setFeeling(null); // Reset feeling
      setIsDialogOpen(false);
      setShowMediaUpload(false);
      trackFunGameAction('create_post_1', {
        source: 'feed_create_post',
        has_media: mediaUrls.length > 0,
        visibility: privacy,
      });
      toast.success(t('postPublished'));
      onPostCreated();
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Đã huỷ') {
        console.log('[CreatePost] Aborted');
        // Don't show error for user-initiated cancel
      } else {
        console.error('[CreatePost] Error:', error.message, error);
        toast.error(error.message || 'Không thể đăng bài');
      }
      setVideoUploadState('idle');
    } finally {
      clearTimeout(watchdogTimeout);
      setLoading(false);
      setSubmitStep('idle');
      submitAbortRef.current = null;
    }
  };

  // Handler for feeling selection - MUST be before any returns
  const handleFeelingSelect = (selectedFeeling: FeelingActivity) => {
    setFeeling(selectedFeeling);
    setIsDialogOpen(true); // Open post dialog after selecting feeling
  };

  // Direct file picker for Photo/Video button (Facebook behavior)
  const handlePhotoVideoClick = () => {
    photoVideoInputRef.current?.click();
  };

  // Direct file picker for Live Video button
  const handleLiveVideoClick = () => {
    setShowStartLiveDialog(true);
  };

  // Handle direct file select from main card buttons
  const handleDirectFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // Open dialog and show media area
    setIsDialogOpen(true);
    setShowMediaUpload(true);
    
    // Process files
    await handleFileSelect(files);
  };

  // Guest mode: Show placeholder card with login prompt
  if (!profile) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-3 sm:p-4 mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 ring-2 ring-primary/20">
            <AvatarFallback className="bg-muted text-muted-foreground">G</AvatarFallback>
          </Avatar>
          <button
            onClick={() => {
              toast.error('Vui lòng đăng nhập để đăng bài', {
                action: { label: 'Đăng nhập', onClick: () => navigate('/auth') }
              });
            }}
            className="flex-1 text-left px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-full text-muted-foreground text-[15px] transition-colors"
          >
            Bạn đang nghĩ gì thế?
          </button>
        </div>

        <div className="border-t border-border mt-3 pt-2">
          <div className="flex items-center">
            <button
              onClick={() => {
                toast.error('Vui lòng đăng nhập để đăng bài', {
                  action: { label: 'Đăng nhập', onClick: () => navigate('/auth') }
                });
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-muted rounded-lg transition-colors group"
            >
              <Video className="w-6 h-6 text-destructive" />
              <span className="font-medium text-muted-foreground text-sm hidden sm:inline">Video trực tiếp</span>
            </button>
            <button
              onClick={() => {
                toast.error('Vui lòng đăng nhập để đăng bài', {
                  action: { label: 'Đăng nhập', onClick: () => navigate('/auth') }
                });
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-muted rounded-lg transition-colors group"
            >
              <ImagePlus className="w-6 h-6 text-[#45BD62]" />
              <span className="font-medium text-muted-foreground text-sm hidden sm:inline">Ảnh/video</span>
            </button>
            <button
              onClick={() => {
                toast.error('Vui lòng đăng nhập để đăng bài', {
                  action: { label: 'Đăng nhập', onClick: () => navigate('/auth') }
                });
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-muted rounded-lg transition-colors group"
            >
              <span className="text-xl sm:text-2xl">😊</span>
              <span className="font-medium text-muted-foreground text-sm hidden sm:inline">Cảm xúc</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hidden file inputs for direct trigger */}
      <input
        ref={photoVideoInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(e) => handleDirectFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Create Post Card - Facebook Style Layout */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-3 sm:p-4 mb-4">
        {/* Row 1: Avatar + Input */}
        <div className="flex items-center gap-3">
          <Avatar
            className="w-10 h-10 cursor-pointer ring-2 ring-primary/20 shrink-0"
            onClick={() => navigate(`/profile/${profile.id}`)}
          >
            <AvatarImage 
              src={profile.avatar_url} 
              sizeHint="sm"
              alt={profile.username || 'User avatar'}
            />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {profile.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          {/* Pure text input button - Facebook style */}
          <button
            onClick={() => setIsDialogOpen(true)}
            className="flex-1 text-left px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-full text-muted-foreground text-[15px] transition-colors"
          >
            {language === 'vi' 
              ? `${profile.username} ơi, bạn đang nghĩ gì thế?`
              : `What's on your mind, ${profile.username}?`
            }
          </button>
        </div>

        {/* Row 2: Action buttons with border-top - Facebook style */}
        <div className="border-t border-border mt-3 pt-2">
          <div className="flex items-center">
            {/* Video trực tiếp - Opens camera/video capture directly */}
            <button
              onClick={handleLiveVideoClick}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-muted rounded-lg transition-colors group"
            >
              <Video className="w-6 h-6 text-red-500 group-hover:scale-110 transition-transform" />
              <span className="font-medium text-muted-foreground text-sm hidden sm:inline">Video trực tiếp</span>
            </button>
            
            {/* Ảnh/video - Opens file picker DIRECTLY (Facebook behavior) */}
            <button
              onClick={handlePhotoVideoClick}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-muted rounded-lg transition-colors group"
            >
              <ImagePlus className="w-6 h-6 text-[#45BD62] group-hover:scale-110 transition-transform" />
              <span className="font-medium text-muted-foreground text-sm hidden sm:inline">Ảnh/video</span>
            </button>
            
            {/* Cảm xúc/hoạt động - Opens Feeling Dialog */}
            <button
              onClick={() => setShowFeelingDialog(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-muted rounded-lg transition-colors group"
            >
              <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">
                {feeling ? feeling.emoji : '😊'}
              </span>
              <span className="font-medium text-muted-foreground text-sm hidden sm:inline">
                {feeling ? feeling.label : 'Cảm xúc/hoạt động'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Create Post Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="p-4 border-b border-border shrink-0">
            <DialogTitle className="text-center text-xl font-bold">Tạo bài viết</DialogTitle>
          </DialogHeader>

          <div className="p-4 flex-1 overflow-y-auto">
            {/* User Info & Privacy */}
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-10 h-10 ring-2 ring-primary/20">
                <AvatarImage 
                  src={profile.avatar_url} 
                  sizeHint="sm"
                  alt={profile.username || 'User avatar'}
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {profile.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-semibold">{profile.username}</span>
                  {feeling && (
                    <span className="text-muted-foreground text-sm">
                      {' '}đang cảm thấy{' '}
                      <button
                        onClick={() => setShowFeelingDialog(true)}
                        className="text-foreground font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        {feeling.emoji} {feeling.label}
                      </button>
                    </span>
                  )}
                  {taggedFriends.length > 0 && (
                    <span className="text-muted-foreground text-sm">
                      {' '}cùng với{' '}
                      <button
                        onClick={() => setShowFriendTagDialog(true)}
                        className="text-foreground font-semibold hover:underline"
                      >
                        {taggedFriends.length === 1 
                          ? (taggedFriends[0].full_name || taggedFriends[0].username)
                          : `${taggedFriends[0].full_name || taggedFriends[0].username} và ${taggedFriends.length - 1} người khác`
                        }
                      </button>
                    </span>
                  )}
                  {location && (
                    <span className="text-muted-foreground text-sm">
                      {' '}tại{' '}
                      <button
                        onClick={() => setShowLocationDialog(true)}
                        className="text-foreground font-semibold hover:underline"
                      >
                        {location}
                      </button>
                    </span>
                  )}
                </div>
                <PrivacySelector 
                  value={privacy} 
                  onChange={setPrivacy} 
                  disabled={loading}
                />
              </div>
            </div>

            {/* Content Input with Emoji */}
            <div className="relative">
              <Textarea
                placeholder={`${profile.username} ơi, bạn đang nghĩ gì thế?`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px] resize-none border-0 focus-visible:ring-0 text-lg placeholder:text-muted-foreground pr-10"
                disabled={loading}
              />
              <div className="absolute bottom-2 right-2">
                <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              </div>
              {/* Character Counter */}
              <div className={`text-xs text-right mt-1 pr-1 ${
                content.length > MAX_CONTENT_LENGTH ? 'text-destructive font-semibold' :
                content.length > MAX_CONTENT_LENGTH * 0.9 ? 'text-yellow-500' :
                content.length > MAX_CONTENT_LENGTH * 0.8 ? 'text-yellow-600/70' : 'text-muted-foreground'
              }`}>
                {content.length.toLocaleString()}/{MAX_CONTENT_LENGTH.toLocaleString()}
              </div>
            </div>

            {/* Media Upload Area */}
            {showMediaUpload && (
              <div
                className={`mt-4 border-2 border-dashed rounded-lg p-4 transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Uppy Video Uploader - Always show when there's a pending video */}
                {pendingVideoFile && (
                  <div className="mb-3">
                    <VideoUploaderUppy
                      selectedFile={pendingVideoFile}
                      onUploadComplete={(result) => {
                        setUppyVideoResult(result);
                        setIsVideoUploading(false);
                        setPendingVideoFile(null);
                      }}
                      onUploadError={() => {
                        setIsVideoUploading(false);
                        setPendingVideoFile(null);
                      }}
                      onUploadStart={() => setIsVideoUploading(true)}
                      onRemove={() => {
                        setPendingVideoFile(null);
                        setUppyVideoResult(null);
                        setIsVideoUploading(false);
                      }}
                      disabled={loading}
                    />
                  </div>
                )}

                {/* Show uploaded video result with thumbnail */}
                {uppyVideoResult && !pendingVideoFile && (
                  <div className="mb-3 relative rounded-lg overflow-hidden border border-green-500/50 bg-muted h-48">
                    {/* Prioritize local thumbnail, then Cloudflare, then fallback */}
                    {uppyVideoResult.localThumbnail ? (
                      <img 
                        src={uppyVideoResult.localThumbnail}
                        alt="Video preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        // Delete the video from Cloudflare Stream to prevent orphans
                        setUppyVideoResult(null);
                      }}
                      className="absolute top-2 right-2 h-8 w-8 bg-black/50 hover:bg-black/70 text-white rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded px-2 py-1">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white text-xs font-medium">Sẵn sàng đăng</span>
                    </div>
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 rounded px-2 py-1">
                      <Video className="w-4 h-4 text-white" />
                      <span className="text-white text-xs">Video</span>
                    </div>
                  </div>
                )}

                {uploadItems.length === 0 && !pendingVideoFile && !uppyVideoResult ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                      <ImagePlus className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium mb-1">Thêm ảnh/video</p>
                    <p className="text-sm text-muted-foreground mb-4">hoặc kéo và thả (tối đa {MAX_FILES_PER_POST} file)</p>
                    <Input
                      id="media-upload"
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={(e) => handleFileSelect(e.target.files)}
                      className="hidden"
                      disabled={loading}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => document.getElementById('media-upload')?.click()}
                      disabled={loading}
                    >
                      Chọn từ thiết bị
                    </Button>
                  </div>
                ) : uploadItems.length > 0 ? (
                  <div className="space-y-3">
                    {/* Media Preview Grid with Progress */}
                    <MediaUploadPreview
                      items={uploadItems}
                      onRemove={removeMedia}
                      onRetry={retryMedia}
                      onReorder={reorderMedia}
                      disabled={loading}
                      maxItems={MAX_FILES_PER_POST}
                    />

                    {/* Add More Button */}
                    {uploadItems.length < MAX_FILES_PER_POST && (
                      <div className="flex items-center gap-2">
                        <Input
                          id="add-more-media"
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          onChange={(e) => handleFileSelect(e.target.files)}
                          className="hidden"
                          disabled={loading}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('add-more-media')?.click()}
                          disabled={loading}
                        >
                          <ImagePlus className="w-4 h-4 mr-2" />
                          Thêm ảnh/video
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {uploadItems.length}/{MAX_FILES_PER_POST}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Close Upload Area */}
                {uploadItems.length === 0 && !pendingVideoFile && !uppyVideoResult && (
                  <button
                    onClick={() => setShowMediaUpload(false)}
                    className="absolute top-2 right-2 w-7 h-7 bg-secondary hover:bg-muted rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Add to Post - Facebook style colored icons */}
            <div className="mt-4 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Thêm vào bài viết của bạn</span>
                <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
                  {/* Media - Green */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowMediaUpload(true);
                    }}
                    className="w-9 h-9 min-w-[36px] rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
                    disabled={loading}
                    title="Ảnh/Video"
                  >
                    <ImagePlus className="w-6 h-6" style={{ color: '#45BD62' }} />
                  </button>
                  
                  {/* Tag Friends - Blue */}
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowFriendTagDialog(true);
                    }}
                    className={`w-9 h-9 min-w-[36px] rounded-full hover:bg-secondary flex items-center justify-center transition-colors ${
                      taggedFriends.length > 0 ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                    }`}
                    disabled={loading}
                    title="Gắn thẻ bạn bè"
                  >
                    <UserPlus className="w-6 h-6" style={{ color: '#1877F2' }} />
                  </button>
                  
                  {/* Emoji - Yellow */}
                  <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  
                  {/* Check-in - Red */}
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowLocationDialog(true);
                    }}
                    className={`w-9 h-9 min-w-[36px] rounded-full hover:bg-secondary flex items-center justify-center transition-colors ${
                      location ? 'bg-red-100 dark:bg-red-900/30' : ''
                    }`}
                    disabled={loading}
                    title="Check in"
                  >
                    <MapPin className="w-6 h-6" style={{ color: '#E74852' }} />
                  </button>
                  
                  {/* GIF - Teal */}
                  <button 
                    className="w-9 h-9 min-w-[36px] rounded-full hover:bg-secondary flex items-center justify-center transition-colors opacity-50 cursor-not-allowed"
                    disabled
                    title="GIF (Sắp có)"
                  >
                    <Clapperboard className="w-6 h-6" style={{ color: '#3BC7BD' }} />
                  </button>
                  
                  {/* More Options */}
                  <button 
                    className="w-9 h-9 min-w-[36px] rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
                    disabled={loading}
                    title="Thêm"
                  >
                    <MoreHorizontal className="w-6 h-6 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="p-4 border-t border-border shrink-0">
            <div className="flex gap-2">
              {loading && (
                <Button
                  variant="outline"
                  onClick={handleCancelSubmit}
                  className="shrink-0"
                >
                  Huỷ
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={loading || isVideoUploading || content.length > MAX_CONTENT_LENGTH || (!content.trim() && uploadItems.length === 0 && !uppyVideoResult)}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {(loading || isVideoUploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {getSubmitButtonText()}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Friend Tag Dialog */}
      <FriendTagDialog
        isOpen={showFriendTagDialog}
        onClose={() => setShowFriendTagDialog(false)}
        currentUserId={profile?.id || ''}
        selectedFriends={taggedFriends}
        onTagFriends={setTaggedFriends}
      />

      {/* Location Check-in Dialog */}
      <LocationCheckin
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        currentLocation={location}
        onSelectLocation={setLocation}
      />

      {/* Feeling/Activity Dialog */}
      <FeelingActivityDialog
        isOpen={showFeelingDialog}
        onClose={() => setShowFeelingDialog(false)}
        onSelect={handleFeelingSelect}
      />

      <StartLiveDialog open={showStartLiveDialog} onOpenChange={setShowStartLiveDialog} />
    </>
  );
};
