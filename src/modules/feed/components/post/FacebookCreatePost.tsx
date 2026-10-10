import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { ImagePlus, Video, X, Loader2, MapPin, Sparkles, Wand2, SmilePlus, AlignLeft, Heart, Check, Mic, Radio, Coins } from 'lucide-react';
import { FILE_LIMITS, getVideoDuration } from '@/utils/imageCompression';
import { UploadQueue, UploadItem, createUploadQueue } from '@/utils/uploadQueue';
import { buildMediaPayload, resolveCompletedMedia } from '@/utils/uploadPayload';
import { EmojiPicker } from '../comment/EmojiPicker';
import { FriendTagDialog } from '../dialog/FriendTagDialog';
import type { TaggedFriend } from '../../types';
import { LocationCheckin } from '../dialog/LocationCheckin';
import { PrivacySelector } from './PrivacySelector';
import { FeelingActivityDialog } from '../dialog/FeelingActivityDialog';
import type { FeelingActivity } from '../../types';
import { MediaUploadPreview } from './MediaUploadPreview';
import { useLanguage } from '@/i18n/LanguageContext';
import { StartLiveDialog } from '@/modules/live/components/StartLiveDialog';
import { trackFunGameAction } from '@/features/fun-play/trackFunGameAction';
import { useIsMobile } from '@/hooks/use-mobile';

interface FacebookCreatePostProps {
  onPostCreated: () => void | Promise<void>;
}

const MAX_CONTENT_LENGTH = 20000;
const MAX_FILES_PER_POST = FILE_LIMITS.MAX_FILES_PER_POST || 100;
const INSPIRATION_CHIPS = [
  { label: 'Biết ơn', icon: '💚', text: 'Hôm nay mình biết ơn vì ' },
  { label: 'Truyền cảm hứng', icon: '🌈', text: 'Một điều tích cực mình muốn lan tỏa hôm nay là ' },
  { label: 'Thành công hôm nay', icon: '🚀', text: 'Thành công nhỏ hôm nay của mình: ' },
  { label: 'Khoảnh khắc đẹp', icon: '📸', text: 'Khoảnh khắc FUN & RICH hôm nay: ' },
  { label: 'Gửi yêu thương', icon: '🎁', text: 'Gửi một chút yêu thương đến ' },
];

const PLACEHOLDERS = [
  'Bạn muốn chia sẻ điều tích cực gì hôm nay?',
  'Hôm nay bạn biết ơn điều gì?',
  'Chia sẻ khoảnh khắc FUN & RICH của bạn...',
];

const postSchema = z.object({
  content: z.string().max(MAX_CONTENT_LENGTH, `Nội dung tối đa ${MAX_CONTENT_LENGTH.toLocaleString()} ký tự`),
});

const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.(8);
  }
};

interface ComposerTextareaProps {
  profile: any;
  value: string;
  placeholder: string;
  disabled: boolean;
  maxLength: number;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onEmojiSelect: (emoji: string) => void;
}

const ComposerTextarea = ({
  profile,
  value,
  placeholder,
  disabled,
  maxLength,
  textareaRef,
  onChange,
  onEmojiSelect,
}: ComposerTextareaProps) => (
  <div className="flex gap-3">
    <Avatar className="mt-1 h-10 w-10 shrink-0 border-2 border-background shadow-md ring-2 ring-primary/15">
      <AvatarImage src={profile.avatar_url} sizeHint="sm" alt={profile.username || 'User avatar'} />
      <AvatarFallback className="bg-primary text-primary-foreground">
        {profile.username?.[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1 rounded-2xl border border-border/60 bg-background/90 p-1 shadow-sm transition-all duration-200 focus-within:border-primary/60 focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]">
      <Textarea
        ref={textareaRef}
        aria-label="Nội dung bài viết"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[132px] resize-none overflow-hidden border-0 bg-transparent pr-12 text-base leading-relaxed placeholder:text-muted-foreground/80 focus-visible:ring-0 sm:text-lg"
        disabled={disabled}
      />
      <div className="flex items-center justify-between px-3 pb-2">
        <EmojiPicker onEmojiSelect={onEmojiSelect} />
        <span className={`text-xs transition-colors ${
          value.length > maxLength ? 'font-semibold text-destructive' :
          value.length > maxLength * 0.9 ? 'font-medium text-amber-500' :
          value.length > maxLength * 0.8 ? 'text-amber-600/80' : 'text-muted-foreground'
        }`}>
          {value.length.toLocaleString()}/{maxLength.toLocaleString()}
        </span>
      </div>
    </div>
  </div>
);

interface EmotionTagSelectorProps {
  selectedTag: string | null;
  disabled: boolean;
  onSelect: (chip: (typeof INSPIRATION_CHIPS)[number]) => void;
}

const EmotionTagSelector = ({ selectedTag, disabled, onSelect }: EmotionTagSelectorProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between px-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cảm hứng tích cực</span>
      <span className="text-xs text-muted-foreground">Chọn một vibe</span>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {INSPIRATION_CHIPS.map((chip) => {
        const isActive = selectedTag === chip.label;
        return (
          <button
            key={chip.label}
            type="button"
            onClick={() => {
              triggerHaptic();
              onSelect(chip);
            }}
            disabled={disabled}
            aria-pressed={isActive}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              isActive
                ? 'border-primary/50 bg-primary/15 text-primary shadow-primary/10'
                : 'border-border bg-background hover:border-primary/30 hover:bg-primary/10'
            }`}
          >
            <span>{chip.icon}</span>
            <span>{chip.label}</span>
            {isActive && <Check className="h-3.5 w-3.5" />}
          </button>
        );
      })}
    </div>
  </div>
);

interface AiWritingAssistantProps {
  open: boolean;
  isMobile: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: string) => void;
}

const AI_ACTIONS = [
  { label: 'Viết tiếp nội dung', icon: Wand2 },
  { label: 'Làm câu chữ hay hơn', icon: Sparkles },
  { label: 'Viết bài biết ơn', icon: Heart },
  { label: 'Tạo caption truyền cảm hứng', icon: SmilePlus },
  { label: 'Tạo hashtag', icon: AlignLeft },
  { label: 'Rút gọn bài viết', icon: AlignLeft },
];

const AiActionList = ({ onAction }: { onAction: (action: string) => void }) => (
  <div className="grid gap-2">
    {AI_ACTIONS.map(({ label, icon: Icon }) => (
      <button
        key={label}
        type="button"
        onClick={() => {
          triggerHaptic();
          onAction(label);
        }}
        className="flex min-h-11 items-center gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-left text-sm font-medium transition-all hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </button>
    ))}
  </div>
);

const AiWritingAssistant = ({ open, isMobile, disabled, onOpenChange, onAction }: AiWritingAssistantProps) => {
  const trigger = (
    <Button
      type="button"
      variant="outline"
      className="h-11 rounded-full border-primary/25 bg-gradient-to-r from-primary/10 via-accent/10 to-accent/10 px-4 text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      disabled={disabled}
      onClick={() => {
        triggerHaptic();
        onOpenChange(true);
      }}
    >
      <Sparkles className="mr-2 h-4 w-4" />
      AI hỗ trợ viết bài
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {trigger}
        <DrawerContent className="rounded-t-3xl border-border/70 px-4 pb-5">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI hỗ trợ viết bài
            </DrawerTitle>
            <DrawerDescription>Gợi ý câu chữ tích cực, nhẹ nhàng và đúng tinh thần FUN.</DrawerDescription>
          </DrawerHeader>
          <AiActionList onAction={onAction} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 rounded-2xl border-primary/10 bg-popover/95 p-3 shadow-xl shadow-primary/10 backdrop-blur">
        <div className="mb-3 rounded-xl bg-primary/10 p-3">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            AI hỗ trợ viết bài
          </div>
          <p className="mt-1 text-xs text-muted-foreground">UI sẵn sàng, chưa kết nối API AI.</p>
        </div>
        <AiActionList onAction={onAction} />
      </PopoverContent>
    </Popover>
  );
};

const LightScoreBadge = () => (
  <TooltipProvider delayDuration={120}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Light Score eligible
        </button>
      </TooltipTrigger>
      <TooltipContent>Bài viết tích cực có thể nhận Light Score.</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

interface ComposerActionBarProps {
  disabled: boolean;
  hasFeeling: boolean;
  hasLocation: boolean;
  onMedia: () => void;
  onFeeling: () => void;
  onCheckIn: () => void;
  onLive: () => void;
  onAi: () => void;
  onSoon: (label: string) => void;
}

const ComposerActionBar = ({
  disabled,
  hasFeeling,
  hasLocation,
  onMedia,
  onFeeling,
  onCheckIn,
  onLive,
  onAi,
  onSoon,
}: ComposerActionBarProps) => {
  const actions = [
    { label: 'Ảnh/Video', icon: ImagePlus, color: 'text-primary', active: false, onClick: onMedia },
    { label: 'Cảm xúc', icon: SmilePlus, color: 'text-amber-500', active: hasFeeling, onClick: onFeeling },
    { label: 'Check-in', icon: MapPin, color: 'text-rose-500', active: hasLocation, onClick: onCheckIn },
    { label: 'Voice', icon: Mic, color: 'text-violet-500', active: false, onClick: () => onSoon('Voice') },
    { label: 'Live', icon: Radio, color: 'text-red-500', active: false, onClick: onLive },
    { label: 'AI', icon: Sparkles, color: 'text-primary', active: false, onClick: onAi },
    { label: 'Tặng Coin', icon: Coins, color: 'text-yellow-500', active: false, onClick: () => onSoon('Tặng Coin') },
  ];

  return (
    <div className="rounded-2xl border border-border/70 bg-background/90 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Thêm vào bài viết</span>
        <span className="text-xs text-muted-foreground">Chạm để thêm nhanh</span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {actions.map(({ label, icon: Icon, color, active, onClick }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            aria-label={label}
            onClick={() => {
              triggerHaptic();
              onClick();
            }}
            className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-medium transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              active ? 'border-primary/40 bg-primary/10' : 'border-transparent bg-muted/45 hover:bg-muted'
            }`}
          >
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="max-w-full truncate">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const FacebookCreatePost = ({ onPostCreated }: FacebookCreatePostProps) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [showStartLiveDialog, setShowStartLiveDialog] = useState(false);
  const [content, setContent] = useState('');
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [privacy, setPrivacy] = useState('public');
  const [isDragging, setIsDragging] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  
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
  
  // Refs for hidden file inputs (direct trigger on click) - must be before any returns
  const photoVideoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
      const isUploading = uploadQueueRef.current?.isUploading();
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'Vui lòng không đóng trình duyệt khi đang tải lên!';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const loadProfile = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(data);
    };

    const initializeProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadProfile(session.user.id);
      }
    };

    void initializeProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => {
          void loadProfile(session.user.id);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 260)}px`;
  }, [content, isDialogOpen]);

  useEffect(() => {
    if (!isDialogOpen) return;

    const handlePaste = (event: ClipboardEvent) => {
      const clipboardItems = Array.from(event.clipboardData?.items || []);
      const imageFiles = clipboardItems
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));

      if (imageFiles.length === 0) return;

      event.preventDefault();
      setShowMediaUpload(true);

      const dataTransfer = new DataTransfer();
      imageFiles.forEach((file) => dataTransfer.items.add(file));
      handleFileSelect(dataTransfer.files);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isDialogOpen]);

  const handleFileSelect = async (files: FileList | null, accessToken?: string) => {
    if (!files || !uploadQueueRef.current) return;

    const acceptedFiles: File[] = [];

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
          acceptedFiles.push(file);
        } catch (error) {
          toast.error(`Không thể đọc video "${file.name}"`);
        }
      } else {
        acceptedFiles.push(file);
      }
    }

    if (acceptedFiles.length > 0) {
      const { added, rejected } = await uploadQueueRef.current.addFiles(acceptedFiles, accessToken);

      if (added.length > 0) {
        setShowMediaUpload(true);
        console.log('[CreatePost] Added', added.length, 'files to queue');
      }

      rejected.forEach(({ file, reason }) => {
        toast.error(`${file.name}: ${reason}`);
      });
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

  const handleInspirationChip = (chip: (typeof INSPIRATION_CHIPS)[number]) => {
    setContent((prev) => {
      const separator = prev.trim().length > 0 && !prev.endsWith('\n') ? '\n' : '';
      return `${prev}${separator}${chip.icon} ${chip.text}`;
    });
    setSelectedChip(chip.label);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleAIAssist = (action: string) => {
    triggerHaptic();
    toast.info(`${action}: UI sẵn sàng, chưa kết nối API AI.`);
    setIsAiPanelOpen(false);
  };

  const handleSoonAction = (label: string) => {
    triggerHaptic();
    toast.info(`${label}: Sắp có trên FUN Profile.`);
  };

  // Submit step state for detailed feedback
  const [submitStep, setSubmitStep] = useState<'idle' | 'auth' | 'prepare_media' | 'saving' | 'done'>('idle');
  const submitAbortRef = useRef<AbortController | null>(null);
  const hasPendingMedia = uploadItems.some(item => item.status === 'queued' || item.status === 'uploading');
  const hasFailedMedia = uploadItems.some(item => item.status === 'failed');

  const getSubmitButtonText = () => {
    if (hasPendingMedia) return 'Đang xử lý...';
    if (hasFailedMedia) return 'Kiểm tra media';
    switch (submitStep) {
      case 'auth': return 'Đang xác thực...';
      case 'prepare_media': return 'Đang chuẩn bị media...';
      case 'saving': return 'Đang lưu bài viết...';
      default: return loading ? 'Đang đăng...' : 'Đăng bài';
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
    const queueMedia = uploadQueueRef.current?.getCompletedUrls() || [];
    const completedMedia = resolveCompletedMedia(uploadItems, queueMedia);
    const pendingUploads = uploadItems.filter(item => item.status === 'uploading' || item.status === 'queued');
    
    console.log('[CreatePost] === SUBMIT START ===', {
      contentLength: content.length,
      completedMediaCount: completedMedia.length,
      pendingUploadsCount: pendingUploads.length,
    });
    
    // Check if there are still uploads in progress
    if (pendingUploads.length > 0) {
      toast.error(`Vui lòng đợi ${pendingUploads.length} file upload xong`);
      return;
    }

    if (uploadItems.length > 0 && completedMedia.length === 0) {
      toast.error('Vui lòng đợi media upload hoàn tất trước khi đăng bài');
      return;
    }
    
    if (!content.trim() && completedMedia.length === 0) {
      toast.error('Vui lòng thêm nội dung hoặc media');
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
      const { mediaUrls, imageUrl, videoUrl } = buildMediaPayload(completedMedia);

      console.log('[CreatePost] uploadItems:', uploadItems);
      console.log('[CreatePost] completedMedia:', completedMedia);
      console.log('[CreatePost] mediaUrls:', mediaUrls);
      console.log('[CreatePost] image_url:', imageUrl);
      
      if (abortController.signal.aborted) throw new Error('Đã huỷ');

      // For backward compatibility
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
          image_url: imageUrl,
          video_url: videoUrl,
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

      // Wait for the active feed query to load the newly-created post before
      // closing the composer, otherwise the UI can keep showing stale posts.
      await onPostCreated();

      // Cleanup upload queue
      uploadQueueRef.current?.cancelAll();
      
      setContent('');
      setSelectedChip(null);
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
      toast.success(language === 'vi' ? 'Bài viết đã được đăng thành công' : t('postPublished'));
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Đã huỷ') {
        console.log('[CreatePost] Aborted');
        // Don't show error for user-initiated cancel
      } else {
        console.error('[CreatePost] Error:', error.message, error);
        toast.error(error.message || 'Không thể đăng bài');
      }
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
              <ImagePlus className="w-6 h-6 text-primary" />
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
              <ImagePlus className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
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
                {feeling ? feeling.text : 'Cảm xúc/hoạt động'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Create Post Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="h-[calc(100dvh-16px)] w-[calc(100vw-16px)] p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-[580px] overflow-hidden flex flex-col rounded-3xl sm:rounded-2xl border border-white/20 bg-card/95 shadow-2xl shadow-primary/10 backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          <DialogHeader className="relative shrink-0 border-b border-border/70 bg-gradient-to-r from-primary/10 via-accent/10 to-accent/10 px-4 py-4">
            <DialogTitle className="text-center text-xl font-bold tracking-tight">Tạo bài viết</DialogTitle>
            <p className="mt-1 text-center text-xs text-muted-foreground">Chia sẻ năng lượng tích cực cùng FUN.RICH</p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {/* Audience */}
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-muted/35 p-3 ring-1 ring-border/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{profile.username}</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                  {feeling && (
                    <span>
                      đang cảm thấy{' '}
                      <button
                        type="button"
                        onClick={() => setShowFeelingDialog(true)}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {feeling.emoji} {feeling.text}
                      </button>
                    </span>
                  )}
                  {taggedFriends.length > 0 && (
                    <span>
                      cùng với{' '}
                      <button
                        type="button"
                        onClick={() => setShowFriendTagDialog(true)}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {taggedFriends.length === 1
                          ? (taggedFriends[0].full_name || taggedFriends[0].username)
                          : `${taggedFriends[0].full_name || taggedFriends[0].username} và ${taggedFriends.length - 1} người khác`}
                      </button>
                    </span>
                  )}
                  {location && (
                    <span>
                      tại{' '}
                      <button
                        type="button"
                        onClick={() => setShowLocationDialog(true)}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {location}
                      </button>
                    </span>
                  )}
                </div>
              </div>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="shrink-0">
                      <PrivacySelector value={privacy} onChange={setPrivacy} disabled={loading} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Mọi người đều có thể xem bài viết này</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-4">
              <ComposerTextarea
                profile={profile}
                value={content}
                placeholder={PLACEHOLDERS[content.length % PLACEHOLDERS.length]}
                disabled={loading}
                maxLength={MAX_CONTENT_LENGTH}
                textareaRef={textareaRef}
                onChange={setContent}
                onEmojiSelect={handleEmojiSelect}
              />

              <EmotionTagSelector
                selectedTag={selectedChip}
                disabled={loading}
                onSelect={handleInspirationChip}
              />

              <div className="flex flex-wrap items-center gap-3">
                <AiWritingAssistant
                  open={isAiPanelOpen}
                  isMobile={isMobile}
                  disabled={loading}
                  onOpenChange={setIsAiPanelOpen}
                  onAction={handleAIAssist}
                />
                <LightScoreBadge />
              </div>
            </div>
            {/* Media Upload Area */}
            {showMediaUpload && (
              <div
                className={`relative mt-4 rounded-2xl border-2 border-dashed p-4 transition-all duration-200 ${
                  isDragging ? 'scale-[1.01] border-primary bg-primary/10 shadow-lg shadow-primary/10' : 'border-border bg-muted/20'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {uploadItems.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                      <ImagePlus className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium mb-1">Thêm ảnh/video</p>
                    <p className="text-sm text-muted-foreground mb-4">Kéo và thả vào đây hoặc chọn từ thiết bị</p>
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
                      className="rounded-full"
                    >
                      <ImagePlus className="w-4 h-4 mr-2" />
                      Chọn ảnh/video
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <MediaUploadPreview
                      items={uploadItems}
                      onRemove={removeMedia}
                      onRetry={retryMedia}
                      onReorder={reorderMedia}
                      disabled={loading}
                    />

                    {uploadItems.length < MAX_FILES_PER_POST && (
                      <div className="flex flex-wrap items-center gap-2">
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
                          className="rounded-full border-primary/30 bg-background/80 hover:bg-primary/10"
                        >
                          <ImagePlus className="w-4 h-4 mr-2" />
                          + Thêm ảnh/video
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {uploadItems.length}/{MAX_FILES_PER_POST}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {uploadItems.length === 0 && (
                  <button
                    onClick={() => setShowMediaUpload(false)}
                    aria-label="Đóng khu vực upload"
                    className="absolute top-2 right-2 w-8 h-8 bg-secondary hover:bg-muted rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <div className="mt-4">
              <ComposerActionBar
                disabled={loading}
                hasFeeling={Boolean(feeling)}
                hasLocation={Boolean(location)}
                onMedia={() => setShowMediaUpload(true)}
                onFeeling={() => setShowFeelingDialog(true)}
                onCheckIn={() => setShowLocationDialog(true)}
                onLive={handleLiveVideoClick}
                onAi={() => setIsAiPanelOpen(true)}
                onSoon={handleSoonAction}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="shrink-0 border-t border-border/70 bg-card/95 p-4 shadow-[0_-10px_30px_hsl(var(--background)/0.65)]">
            <div className="flex gap-2">
              {loading && (
                <Button
                  variant="outline"
                  onClick={handleCancelSubmit}
                  className="shrink-0 rounded-full"
                >
                  Huỷ
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={loading || hasPendingMedia || hasFailedMedia || content.length > MAX_CONTENT_LENGTH || (!content.trim() && uploadItems.length === 0)}
                className="h-11 flex-1 rounded-full bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 disabled:shadow-none"
              >
                {(loading || hasPendingMedia) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
