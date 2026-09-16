import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Camera,
  CameraOff,
  ChevronDown,
  Clapperboard,
  Eye,
  Image,
  Loader2,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  Music,
  Palette,
  PanelLeft,
  PhoneOff,
  QrCode,
  Radio,
  Settings,
  Sparkles,
  StickyNote,
  RadioTower,
  UserPlus,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLocalStudioPreview } from '../hooks/useLocalStudioPreview';
import { useLiveRtc } from '../hooks/useLiveRtc';
import { LiveChatPanel } from '../components/LiveChatPanel';
import { FloatingReactions } from '../components/FloatingReactions';
import { useLiveSession } from '../useLiveSession';
import {
  sendWebcamLiveHeartbeat,
  sendWebcamLiveHeartbeatBeacon,
  startWebcamCloudRecording,
  startWebcamLiveSession,
  stopWebcamLiveSession,
  type LiveHeartbeatClientState,
  type LiveHeartbeatDeviceType,
  type RecordingStatus,
  type WebcamLiveStartResult,
} from '../liveService';
import {
  getRestreamConnection,
  getRestreamLiveStatus,
  getRestreamSetupStatus,
  refreshRestreamChannels,
  RestreamApiError,
  startRestreamMultistream,
  startRestreamOAuth,
  disconnectRestream,
  type MultistreamDestination,
  type RestreamChannel,
  type RestreamConnection,
} from '../restreamService';

type StudioAspect = 'landscape' | 'portrait';
type StudioScene = 'Welcome' | 'Camera' | 'BRB' | 'Demo';
type StudioTool = 'Guest' | 'Graphics' | 'Captions' | 'QR Codes' | 'Notes' | 'Chat' | 'Music' | 'Theme' | 'Help';
type StudioLayoutMode = 'spacious' | 'normal' | 'compact' | 'ultraCompact';
type StudioLiveState = 'preview' | 'starting' | 'live' | 'reconnecting' | 'ending' | 'ended' | 'error';
type ElementSize = { width: number; height: number };

const CoffeeIcon: LucideIcon = Clapperboard;

const SCENES: Array<{ name: StudioScene; hint: string; icon: LucideIcon }> = [
  { name: 'Welcome', hint: 'Intro nhẹ nhàng', icon: Sparkles },
  { name: 'Camera', hint: 'Webcam chính', icon: Video },
  { name: 'BRB', hint: 'Tạm nghỉ', icon: CoffeeIcon },
  { name: 'Demo', hint: 'Chia sẻ nội dung', icon: MonitorUp },
];

const TOOLS: Array<{ name: StudioTool; icon: LucideIcon; hint: string }> = [
  { name: 'Guest', icon: UserPlus, hint: 'Invite guest se duoc hoan thien trong ban tiep theo.' },
  { name: 'Captions', icon: StickyNote, hint: 'Captions se duoc hoan thien trong ban tiep theo.' },
  { name: 'Chat', icon: MessageCircle, hint: 'Bình luận sẽ hiện ở đây khi LIVE.' },
  { name: 'Graphics', icon: Image, hint: 'Overlay, lower-third và sticker sẽ có ở bản sau.' },
  { name: 'QR Codes', icon: QrCode, hint: 'Tạo QR mời xem live hoặc mở gian hàng.' },
  { name: 'Notes', icon: StickyNote, hint: 'Ghi chú riêng cho host khi dẫn live.' },
  { name: 'Music', icon: Music, hint: 'Nhạc nền và âm lượng sẽ được thêm sau.' },
  { name: 'Theme', icon: Palette, hint: 'Màu, font và style khung live.' },
  { name: 'Help', icon: Sparkles, hint: 'Mẹo setup ánh sáng, camera và âm thanh.' },
];

function useStudioLayoutMode() {
  const ref = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 1280, height: 720 });

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      });
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const mode: StudioLayoutMode = useMemo(() => {
    const { width, height } = size;
    if (width < 760 || height < 540) return 'ultraCompact';
    if (width < 1060 || height < 660) return 'compact';
    if (width < 1380 || height < 780) return 'normal';
    return 'spacious';
  }, [size]);

  return { ref, mode, size };
}

function StudioTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const frameRef = useRef<number | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const update = (next: ElementSize) => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => setSize(next));
    };

    update({ width: node.clientWidth, height: node.clientHeight });
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      update({ width, height });
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return { ref, size };
}

function mediaTrackFromAgoraTrack(track: unknown): MediaStreamTrack | null {
  const candidate = track as { getMediaStreamTrack?: () => MediaStreamTrack };
  try {
    return candidate?.getMediaStreamTrack?.() ?? null;
  } catch {
    return null;
  }
}

function getDeviceType(): LiveHeartbeatDeviceType {
  if (typeof navigator === 'undefined') return 'desktop';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

function formatLiveDuration(startedAt: number | null) {
  if (!startedAt) return '00:00:00';
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${rest}`;
}

function IconControlButton({
  icon: Icon,
  label,
  compact,
  className,
  ...props
}: ComponentProps<typeof Button> & { icon: LucideIcon; label: string; compact: boolean }) {
  return (
    <StudioTooltip label={label}>
      <Button
        {...props}
        aria-label={label}
        variant={props.variant || 'outline'}
        className={cn(
          'h-10 shrink-0 border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white',
          compact ? 'w-10 px-0' : 'px-3',
          className,
        )}
      >
        <Icon className={cn('h-4 w-4', !compact && 'mr-2')} />
        {!compact && <span>{label}</span>}
      </Button>
    </StudioTooltip>
  );
}

export default function LiveWebcamStudioPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const shell = useStudioLayoutMode();
  const stageWrap = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [selectedScene, setSelectedScene] = useState<StudioScene>('Camera');
  const [selectedTool, setSelectedTool] = useState<StudioTool>('Chat');
  const [activeRightPanel, setActiveRightPanel] = useState<StudioTool | null>(null);
  const [aspect, setAspect] = useState<StudioAspect>('landscape');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [studioState, setStudioState] = useState<StudioLiveState>('preview');
  const [studioError, setStudioError] = useState<string | null>(null);
  const [liveStartedAt, setLiveStartedAt] = useState<number | null>(null);
  const [durationTick, setDurationTick] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingStatus>('idle');
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const [restreamConnection, setRestreamConnection] = useState<RestreamConnection>({ connected: false });
  const [restreamChannels, setRestreamChannels] = useState<RestreamChannel[]>([]);
  const [selectedRestreamChannels, setSelectedRestreamChannels] = useState<string[]>([]);
  const [restreamLoading, setRestreamLoading] = useState(false);
  const [restreamNotice, setRestreamNotice] = useState<string | null>(null);
  const [multistreamDestinations, setMultistreamDestinations] = useState<MultistreamDestination[]>([]);
  const [sceneDrawerOpen, setSceneDrawerOpen] = useState(false);
  const [toolDrawerOpen, setToolDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const initialRtcRef = useRef<WebcamLiveStartResult | null>(null);
  const startedRtcRef = useRef(false);
  const heartbeatStateRef = useRef<LiveHeartbeatClientState>('live');

  const preview = useLocalStudioPreview();
  const liveSessionQuery = useLiveSession(currentSessionId || undefined);
  const liveSession = liveSessionQuery.data;
  const isCompact = shell.mode === 'compact' || shell.mode === 'ultraCompact';
  const isUltraCompact = shell.mode === 'ultraCompact';
  const isConstrained = shell.mode === 'compact' || shell.mode === 'ultraCompact' || shell.size.height < 690;
  const showPanelText = !isFullscreen && (shell.mode === 'spacious' || shell.mode === 'normal') && shell.size.height >= 620;
  const showSidePanels = !isFullscreen && !isUltraCompact;
  const rightPanelTool = activeRightPanel ?? selectedTool;
  const selectedToolMeta = useMemo(() => TOOLS.find((tool) => tool.name === rightPanelTool) || TOOLS[0], [rightPanelTool]);
  const ToolIcon = selectedToolMeta.icon;
  const isLiveRuntime = studioState === 'live' || studioState === 'reconnecting' || studioState === 'ending';
  const isStarting = studioState === 'starting';
  const isEnding = studioState === 'ending';
  const isEnded = studioState === 'ended';
  const canGoLive = preview.cameraEnabled && preview.hasVideo && studioState === 'preview';
  const liveDuration = useMemo(() => {
    void durationTick;
    return formatLiveDuration(liveStartedAt);
  }, [durationTick, liveStartedAt]);
  const visibleRestreamChannels = useMemo(
    () => restreamChannels.filter((channel) => ['facebook', 'youtube', 'twitch'].includes(channel.platform)),
    [restreamChannels],
  );

  // Stage sizing: pure CSS containment (height-bound + aspect-ratio + max-w-full)
  // means the browser keeps the correct 16:9 / 9:16 ratio without JS measurement,
  // so the preview never crops when zoomed 100/125/150% or on smaller viewports.


  const {
    setLocalContainerRef,
    isJoined,
    isMuted,
    isCameraOff,
    hasLocalVideoPreview,
    localVideoWarning,
    statusText,
    start: startRtc,
    leave: leaveRtc,
    toggleMute,
    toggleCamera,
    getLocalTracks,
  } = useLiveRtc({
    sessionId: currentSessionId || undefined,
    role: 'host',
    enabled: !!currentSessionId && ['live', 'reconnecting', 'disconnected'].includes(String(liveSession?.status || '')),
    initialRtcToken: initialRtcRef.current
      ? {
          appId: initialRtcRef.current.appId,
          token: initialRtcRef.current.token,
          uid: initialRtcRef.current.uid,
          channel: initialRtcRef.current.channel,
          expiresAt: initialRtcRef.current.expiresAt,
        }
      : null,
  });
  const isReconnecting = isLiveRuntime && (!isJoined || /reconnect|network|mang|ket noi|khôi phá»¥c|gián/i.test(statusText));

  const workspaceColumns = useMemo(() => {
    if (!showSidePanels) return 'minmax(0, 1fr)';
    if (shell.mode === 'compact') return '64px minmax(0, 1fr) 56px';
    if (shell.mode === 'normal') return 'clamp(96px, 11vw, 168px) minmax(0, 1fr) 64px';
    return 'clamp(150px, 12vw, 220px) minmax(0, 1fr) clamp(64px, 5vw, 80px)';
  }, [shell.mode, showSidePanels]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session?.user) {
        toast.error('Bạn cần đăng nhập để phát trực tiếp.');
        navigate('/auth', { replace: true });
        return;
      }
      setUserId(data.session.user.id);
      setAuthChecked(true);
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  const loadRestream = useCallback(async (refresh = false) => {
    setRestreamLoading(true);
    setRestreamNotice(null);
    try {
      if (refresh) {
        await refreshRestreamChannels();
        const latest = await getRestreamConnection();
        if (!latest.connection.connected) {
          setRestreamConnection({ connected: false });
          setRestreamChannels([]);
          setSelectedRestreamChannels([]);
          return;
        }
        setRestreamConnection(latest.connection);
        setRestreamChannels(latest.channels || []);
      } else {
        const result = await getRestreamConnection();
        setRestreamConnection(result.connection);
        setRestreamChannels(result.channels || []);
        if (result.warning && result.warning_code !== 'not_connected') {
          setRestreamNotice(result.warning);
        }
      }
    } catch (error) {
      if (error instanceof RestreamApiError && error.code === 'not_connected') {
        setRestreamConnection({ connected: false });
        setRestreamChannels([]);
        setSelectedRestreamChannels([]);
        return;
      }
      setRestreamNotice(error instanceof Error ? error.message : 'Restream status unavailable.');
    } finally {
      setRestreamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    loadRestream().catch(() => undefined);
  }, [authChecked, loadRestream]);

  useEffect(() => {
    if (!authChecked) return;
    const params = new URLSearchParams(location.search);
    const restream = params.get('restream');
    if (restream === 'connected') {
      toast.success('Restream da ket noi. Dang tai danh sach kenh...');
      loadRestream(true).catch(() => undefined);
      return;
    }
    if (restream === 'error') {
      setRestreamNotice('Restream OAuth chua thanh cong. Admin hay kiem tra Redirect URI va Supabase secrets.');
    }
  }, [authChecked, loadRestream, location.search]);

  useEffect(() => {
    setSelectedRestreamChannels((current) => current.filter((id) => visibleRestreamChannels.some((channel) => channel.restream_channel_id === id)));
  }, [visibleRestreamChannels]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleGoLive = async () => {
    if (studioState !== 'preview') return;
    setStudioState('starting');
    setStudioError(null);

    try {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        throw new Error('Vui long nhap tieu de live truoc khi GO LIVE.');
      }

      let stream = preview.stream;
      if (!preview.hasVideo && preview.cameraEnabled) {
        stream = await preview.startPreview();
      }

      const hasCamera = !!stream?.getVideoTracks().some((track) => track.readyState === 'live');
      if (!hasCamera) {
        throw new Error('Bật camera để bắt đầu LIVE bằng webcam.');
      }

      const created = await startWebcamLiveSession({
        privacy: 'public',
        title: trimmedTitle,
      });

      initialRtcRef.current = created;
      startedRtcRef.current = false;
      setCurrentSessionId(created.sessionId);
      setLiveStartedAt(Date.now());
      setStudioState('live');
      setActiveRightPanel(null);
      toast.success('Đang đưa bạn vào phòng LIVE...');
      toast.success('LIVE da bat dau trong FUN Studio.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể bắt đầu LIVE.';
      toast.error(message);
      setStudioError(message);
      setStudioState('error');
    }
  };

  useEffect(() => {
    if (studioState !== 'live' || !currentSessionId || !liveSession || startedRtcRef.current) return;
    if (!['live', 'reconnecting', 'disconnected'].includes(String(liveSession.status))) return;

    startedRtcRef.current = true;
    startRtc()
      .then(async () => {
        const localTracks = getLocalTracks();
        const audioTrack = mediaTrackFromAgoraTrack(localTracks.audio);
        const videoTrack = mediaTrackFromAgoraTrack(localTracks.video);
        const hasAudio = !!audioTrack;
        const hasVideo = !!videoTrack;

        preview.stopStream();
        await sendWebcamLiveHeartbeat({
          sessionId: currentSessionId,
          userId,
          agoraChannelName: liveSession.agora_channel || liveSession.channel_name,
          clientState: 'live',
          deviceType: getDeviceType(),
          sourceType: 'webcam',
          mediaActive: hasAudio || hasVideo,
          hasAudio,
          hasVideo,
        }).catch(() => undefined);

        await startWebcamCloudRecording({
          sessionId: currentSessionId,
          channelName: liveSession.agora_channel || liveSession.channel_name,
          hasAudio,
          hasVideo,
        })
          .then((recording) => {
            if (recording.recordingAvailable === false || recording.fallbackRecordingRecommended) {
              setRecordingState('failed');
              setRecordingNotice('Livestream van dang phat, nhung recording chinh dang can fallback.');
            } else {
              setRecordingState('recording');
              setRecordingNotice(null);
            }
          })
          .catch(() => {
            setRecordingState('failed');
            setRecordingNotice('Livestream van dang phat, nhung recording chua khoi dong duoc.');
          });

        if (selectedRestreamChannels.length > 0) {
          setRestreamNotice('Đang khởi động Restream multistream...');
          await startRestreamMultistream({
            liveSessionId: currentSessionId,
            channelIds: selectedRestreamChannels,
          })
            .then((result) => {
              setMultistreamDestinations(result.destinations || []);
              setRestreamNotice('Restream multistream đang hoạt động.');
            })
            .catch((error) => {
              const message = error instanceof Error ? error.message : 'Restream multistream chưa khởi động được.';
              setRestreamNotice(message);
              toast.error(`Restream: ${message}`);
            });
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Khong the ket noi Agora LIVE.';
        startedRtcRef.current = false;
        setStudioError(message);
        setStudioState('error');
        toast.error(message);
      });
  }, [currentSessionId, getLocalTracks, liveSession, preview, selectedRestreamChannels, startRtc, studioState, userId]);

  useEffect(() => {
    if (!currentSessionId || !isLiveRuntime || selectedRestreamChannels.length === 0) return;
    const load = () => {
      if (document.hidden) return;
      getRestreamLiveStatus(currentSessionId)
        .then(setMultistreamDestinations)
        .catch(() => undefined);
    };
    load();
    // 30s (trước 15s) + bỏ qua khi tab ẩn.
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [currentSessionId, isLiveRuntime, selectedRestreamChannels.length]);

  useEffect(() => {
    if (studioState !== 'live' || !liveStartedAt) return;
    const timer = window.setInterval(() => setDurationTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(timer);
  }, [liveStartedAt, studioState]);

  useEffect(() => {
    if (studioState !== 'live' || !currentSessionId || !liveSession || !isJoined) return;
    const sendBeat = (clientState: LiveHeartbeatClientState = heartbeatStateRef.current) => {
      heartbeatStateRef.current = clientState;
      return sendWebcamLiveHeartbeat({
        sessionId: currentSessionId,
        userId,
        agoraChannelName: liveSession.agora_channel || liveSession.channel_name,
        clientState,
        deviceType: getDeviceType(),
        sourceType: 'webcam',
        timestamp: new Date().toISOString(),
      });
    };

    sendBeat('live').catch(() => undefined);
    // Heartbeat 25s (trước 10s). Bỏ qua khi tab ẩn để tiết kiệm Cloud balance.
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      sendBeat(navigator.onLine === false ? 'reconnecting' : 'live').catch(() => undefined);
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [currentSessionId, isJoined, liveSession, studioState, userId]);

  useEffect(() => {
    if (!currentSessionId || !liveSession || studioState === 'ended') return;
    if (['ended', 'processing', 'stopped'].includes(String(liveSession.status))) {
      setStudioState('ended');
      setRecordingState(liveSession.status === 'processing' ? 'processing' : 'stopped');
      leaveRtc().catch(() => undefined);
    }
  }, [currentSessionId, leaveRtc, liveSession, studioState]);

  useEffect(() => {
    if (!currentSessionId || !liveSession) return;

    const sendLifecycleHeartbeat = (clientState: LiveHeartbeatClientState) => {
      heartbeatStateRef.current = clientState;
      void sendWebcamLiveHeartbeatBeacon({
        sessionId: currentSessionId,
        userId,
        agoraChannelName: liveSession.agora_channel || liveSession.channel_name,
        clientState,
        deviceType: getDeviceType(),
        sourceType: 'webcam',
        timestamp: new Date().toISOString(),
      });
    };

    const handlePageHide = () => sendLifecycleHeartbeat('closing');
    const handleBeforeUnload = () => sendLifecycleHeartbeat('closing');
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') sendLifecycleHeartbeat('background');
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentSessionId, liveSession, userId]);

  useEffect(() => {
    return () => {
      leaveRtc().catch(() => undefined);
    };
  }, [leaveRtc]);

  const handleEndLive = async () => {
    if (!currentSessionId || isEnding) return;
    setStudioState('ending');
    setRecordingState('stopping');
    setStudioError(null);
    try {
      await stopWebcamLiveSession(currentSessionId);
      setRecordingState('processing');
      await leaveRtc();
      setStudioState('ended');
      toast.success('Live da ket thuc. Replay dang duoc xu ly.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Khong the ket thuc LIVE.';
      setStudioError(message);
      setStudioState('live');
      setRecordingState('failed');
      toast.error(message);
    }
  };

  const handleConnectRestream = async () => {
    setRestreamLoading(true);
    setRestreamNotice(null);
    try {
      const setup = await getRestreamSetupStatus();
      if (!setup.env.ok || !setup.database.ok) {
        const missing = setup.env.missing.length ? ` Missing env: ${setup.env.missing.join(', ')}.` : '';
        throw new RestreamApiError(
          `Admin can cau hinh Restream truoc.${missing}`,
          setup.database.ok ? 'missing_restream_env' : 'missing_migration',
          setup,
        );
      }
      const authUrl = await startRestreamOAuth('/live/new');
      window.location.assign(authUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể mở Restream OAuth.';
      setRestreamNotice(message);
      toast.error(message);
      setRestreamLoading(false);
    }
  };

  const handleDisconnectRestream = async () => {
    setRestreamLoading(true);
    setRestreamNotice(null);
    try {
      await disconnectRestream();
      setRestreamConnection({ connected: false });
      setRestreamChannels([]);
      setSelectedRestreamChannels([]);
      setMultistreamDestinations([]);
      toast.success('Đã ngắt kết nối Restream.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể ngắt kết nối Restream.';
      setRestreamNotice(message);
      toast.error(message);
    } finally {
      setRestreamLoading(false);
    }
  };

  const toggleRestreamChannel = (channelId: string) => {
    if (isLiveRuntime || isStarting) return;
    setSelectedRestreamChannels((current) =>
      current.includes(channelId)
        ? current.filter((id) => id !== channelId)
        : [...current, channelId],
    );
  };

  const toggleFullscreen = useCallback(() => {
    const node = canvasRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    node.requestFullscreen?.().catch(() => undefined);
  }, []);

  const SceneList = ({ compact = false }: { compact?: boolean }) => (
    <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
      {SCENES.map((scene) => {
        const Icon = scene.icon;
        return (
          <StudioTooltip key={scene.name} label={`${scene.name} - ${scene.hint}`}>
            <button
              type="button"
              onClick={() => {
                setSelectedScene(scene.name);
                setSceneDrawerOpen(false);
              }}
              className={cn(
                'w-full rounded-xl border text-left transition',
                compact ? 'p-2' : 'p-2.5',
                selectedScene === scene.name
                  ? 'border-emerald-300 bg-emerald-300/10 shadow-[0_0_0_1px_rgba(110,231,183,0.35)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25',
              )}
              aria-label={`Chọn scene ${scene.name}`}
            >
              <div className="grid aspect-video place-items-center rounded-lg bg-gradient-to-br from-slate-800 via-slate-950 to-emerald-950">
                <Icon className="h-5 w-5 text-white/70" />
              </div>
              {!compact && (
                <>
                  <div className="mt-2 text-sm font-medium">{scene.name}</div>
                  <div className="truncate text-xs text-white/45">{scene.hint}</div>
                </>
              )}
            </button>
          </StudioTooltip>
        );
      })}
    </div>
  );

  const ToolRail = () => (
    <div className="flex min-h-0 flex-col items-center gap-2 overflow-y-auto py-1">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <StudioTooltip key={tool.name} label={tool.name}>
            <button
              type="button"
              onClick={() => {
                setSelectedTool(tool.name);
                const nextPanel = activeRightPanel === tool.name ? null : tool.name;
                setActiveRightPanel(nextPanel);
                if (nextPanel && (isCompact || !showSidePanels)) setToolDrawerOpen(true);
              }}
              aria-label={tool.name}
              className={cn(
                'grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition',
                activeRightPanel === tool.name
                  ? 'border-emerald-300 bg-emerald-300/10 text-emerald-100'
                  : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          </StudioTooltip>
        );
      })}
    </div>
  );

  const ToolDetail = () => (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <ToolIcon className="h-4 w-4 text-emerald-300" />
        {rightPanelTool}
      </div>
      {rightPanelTool === 'Chat' && currentSessionId && isLiveRuntime ? (
        <LiveChatPanel sessionId={currentSessionId} className="min-h-0 flex-1 border-white/10 bg-black/20" />
      ) : (
        <p className="text-sm text-white/55">{selectedToolMeta.hint}</p>
      )}
    </div>
  );

  const MultistreamPanel = () => (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-white/75">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 font-medium text-white">
          <RadioTower className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="min-w-0 truncate">Multistream</span>
        </div>
        <Badge variant="outline" className="border-emerald-300/40 text-emerald-100">FUN.RICH on</Badge>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {!restreamConnection.connected ? (
          <Button
            size="sm"
            type="button"
            onClick={handleConnectRestream}
            disabled={restreamLoading || isLiveRuntime || isStarting}
            className="h-8 w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400 sm:w-auto"
          >
            {restreamLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Connect Restream
          </Button>
        ) : (
          <>
            <Badge className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/25">Restream connected</Badge>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => loadRestream(true)}
              disabled={restreamLoading || isLiveRuntime || isStarting}
              className="h-8 border-white/15 bg-white/[0.03] text-white hover:bg-white/10 hover:text-white"
            >
              {restreamLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Refresh
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={handleDisconnectRestream}
              disabled={restreamLoading || isLiveRuntime || isStarting}
              className="h-8 border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/10 hover:text-white"
            >
              Disconnect
            </Button>
          </>
        )}
      </div>

      {restreamConnection.connected && visibleRestreamChannels.length === 0 && (
        <p className="text-xs text-amber-100">
          Tài khoản Restream chưa có kênh Facebook / YouTube / Twitch. Bấm Refresh sau khi thêm kênh trên restream.io.
        </p>
      )}

      {visibleRestreamChannels.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {visibleRestreamChannels.map((channel) => {
            const checked = selectedRestreamChannels.includes(channel.restream_channel_id);
            const destination = multistreamDestinations.find((item) => item.restream_channel_id === channel.restream_channel_id);
            return (
              <button
                key={channel.restream_channel_id}
                type="button"
                onClick={() => toggleRestreamChannel(channel.restream_channel_id)}
                disabled={isLiveRuntime || isStarting}
                className={cn(
                  'min-h-[68px] rounded-md border p-2 text-left transition',
                  checked ? 'border-emerald-300 bg-emerald-300/10 text-emerald-50' : 'border-white/10 bg-black/15 text-white/70',
                  (isLiveRuntime || isStarting) && 'cursor-default opacity-80',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium capitalize">{channel.platform}</span>
                  <span className={cn('h-4 w-4 shrink-0 rounded border', checked ? 'border-emerald-200 bg-emerald-300' : 'border-white/30')} />
                </div>
                <div className="mt-1 truncate text-xs text-white/50">{channel.display_name || channel.channel_url || channel.restream_channel_id}</div>
                {destination && (
                  <div className={cn('mt-1 text-xs', destination.status === 'failed' ? 'text-red-200' : 'text-emerald-200')}>
                    {destination.status} / {destination.signal_status || 'inactive'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {restreamConnection.connected
        && visibleRestreamChannels.length > 0
        && selectedRestreamChannels.length === 0
        && !isLiveRuntime && (
        <p className="mt-2 text-xs text-white/55">
          Chọn ít nhất một destination trước khi GO LIVE, hoặc bỏ trống để chỉ phát trên FUN.RICH.
        </p>
      )}

      {restreamNotice && (
        <div className="mt-2 break-words rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-1.5 text-xs text-amber-100">
          {restreamNotice}
        </div>
      )}
    </div>
  );

  if (!authChecked) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-[#101114] text-white/70">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Đang mở FUN Studio...
        </div>
      </div>
    );
  }

  return (
    <div ref={shell.ref} className="h-[100dvh] w-full overflow-hidden bg-[#101114] text-white">
      <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <header className="z-10 flex h-[clamp(52px,7dvh,64px)] shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#15171c]/95 px-[clamp(12px,2vw,24px)]">
          <div className="flex min-w-0 items-center gap-3">
            {isUltraCompact && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Mở scenes"
                className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
                onClick={() => setSceneDrawerOpen(true)}
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400 text-emerald-950">
              <Clapperboard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight sm:text-base">{isLiveRuntime ? 'FUN Studio LIVE' : 'FUN Studio'}</h1>
              {!isCompact && (
                <p className="truncate text-xs text-white/55">Chuẩn bị webcam trước khi phát trực tiếp</p>
              )}
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            {!isUltraCompact && (
              <Badge className="hidden border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15 sm:inline-flex">
                Stream tốt
              </Badge>
            )}
            {isLiveRuntime && (
              <Badge className="hidden border-white/15 bg-white/10 text-white hover:bg-white/15 sm:inline-flex">
                720p
              </Badge>
            )}
            {isLiveRuntime && (
              <Badge className="hidden gap-1 border-white/15 bg-white/10 text-white hover:bg-white/15 sm:inline-flex">
                <Eye className="h-3.5 w-3.5" />
                {liveSession?.viewer_count || 0}
              </Badge>
            )}
            {isLiveRuntime && (
              <Badge className="hidden border-white/15 bg-white/10 font-mono text-white hover:bg-white/15 sm:inline-flex">
                {liveDuration}
              </Badge>
            )}
            <Badge
              className={cn(
                isLiveRuntime
                  ? 'border-red-300/40 bg-red-600 text-white hover:bg-red-500'
                  : isEnded
                    ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                    : 'border-amber-300/30 bg-amber-300/15 text-amber-100 hover:bg-amber-300/20',
              )}
            >
              {isLiveRuntime ? 'LIVE' : isEnded ? 'ENDED' : studioState === 'starting' ? 'STARTING' : 'Preview'}
            </Badge>
            <Button
              variant="ghost"
              className="shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => navigate('/')}
            >
              {isCompact ? <X className="h-4 w-4" /> : 'Thoát'}
            </Button>
          </div>
        </header>

        <main
          className="relative grid min-h-0 min-w-0 overflow-hidden"
          style={{ gridTemplateColumns: workspaceColumns }}
        >
          {showSidePanels && (
            <aside className="flex min-h-0 min-w-0 flex-col border-r border-white/10 bg-[#15171c] p-[clamp(8px,1.4vw,16px)]">
              {showPanelText ? (
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold text-white/85">Scenes</div>
                  <Button size="sm" variant="ghost" className="h-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white">
                    + Add
                  </Button>
                </div>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Scenes"
                  className="mb-2 h-9 w-full text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              )}
              <SceneList compact={!showPanelText} />
            </aside>
          )}

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#101114] p-[clamp(6px,1.2vw,16px)]">
            <div className={cn('mb-[clamp(6px,1vw,12px)] grid shrink-0 gap-2', !isConstrained && 'md:grid-cols-[minmax(0,1fr)_minmax(150px,220px)]')}>
              <div className="min-w-0 space-y-2">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Tiêu đề live"
                  className="h-10 border-white/10 bg-white/[0.06] text-white placeholder:text-white/35"
                />
                {!isConstrained && (
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Mô tả ngắn cho buổi live (tuỳ chọn)"
                    className="min-h-[56px] resize-none border-white/10 bg-white/[0.06] text-white placeholder:text-white/35"
                  />
                )}
                <MultistreamPanel />
              </div>
              {!isConstrained && (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/65">
                  <div className="mb-1 flex items-center gap-2 font-medium text-white">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                    Gợi ý nhỏ
                  </div>
                  Live dài hoặc nhiều người xem nên dùng OBS/RTMP để phát qua CDN ổn định hơn.
                </div>
              )}
            </div>

            <div className="mb-[clamp(8px,1vw,12px)] flex shrink-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Badge className="max-w-[42vw] truncate bg-white/10 text-white hover:bg-white/15">{selectedScene}</Badge>
                <Badge variant="outline" className="border-white/15 text-white/75">
                  {aspect === 'landscape' ? 'Landscape' : 'Portrait'}
                </Badge>
                {isLiveRuntime && (
                  <Badge variant="outline" className="border-white/15 text-white/75">
                    Recording: {recordingState}
                  </Badge>
                )}
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] p-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAspect('landscape')}
                  className={cn('h-8 rounded-full px-3 text-white/70 hover:bg-white/10 hover:text-white', aspect === 'landscape' && 'bg-white text-slate-950 hover:bg-white')}
                >
                  Landscape
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAspect('portrait')}
                  className={cn('h-8 rounded-full px-3 text-white/70 hover:bg-white/10 hover:text-white', aspect === 'portrait' && 'bg-white text-slate-950 hover:bg-white')}
                >
                  Portrait
                </Button>
              </div>
            </div>

            {(studioError || recordingNotice) && (
              <div className="mb-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                {studioError || recordingNotice}
              </div>
            )}

            <div ref={stageWrap.ref} className="grid min-h-0 flex-1 place-items-center overflow-hidden">
              <div
                ref={canvasRef}
                className={cn(
                  'group relative grid place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl',
                  'max-h-full max-w-full',
                  isFullscreen
                    ? 'h-screen w-screen rounded-none border-0'
                    : aspect === 'landscape'
                      ? 'aspect-video h-full w-auto'
                      : 'aspect-[9/16] h-full w-auto',
                )}
              >

                {isLiveRuntime ? (
                  <div className="relative h-full w-full bg-black">
                    <div ref={setLocalContainerRef} className="absolute inset-0" />
                    {currentSessionId && <FloatingReactions sessionId={currentSessionId} />}
                    {(!isJoined || !hasLocalVideoPreview || localVideoWarning) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-4 text-center text-sm text-white/90">
                        {isJoined
                          ? isCameraOff
                            ? 'Camera dang tat.'
                            : localVideoWarning || 'Camera chua hien thi, vui long kiem tra thiet bi.'
                          : statusText}
                      </div>
                    )}
                  </div>
                ) : preview.hasVideo && preview.cameraEnabled ? (
                  <video
                    ref={preview.attachVideoRef}
                    className="h-full w-full bg-black object-contain"
                    muted
                    playsInline
                    autoPlay
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-6 text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10">
                      <CameraOff className="h-8 w-8 text-white/70" />
                    </div>
                    <div>
                      <p className="font-semibold">Bật camera để xem trước livestream của bạn</p>
                      <p className="mt-1 text-sm text-white/50">{preview.error || 'Bạn có thể chuẩn bị scene, mic và layout trước khi GO LIVE.'}</p>
                    </div>
                  </div>
                )}

                <div className="absolute left-3 top-3 flex max-w-[calc(100%-5rem)] items-center gap-2">
                  <Badge className={cn('shrink-0', isLiveRuntime ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-amber-300 text-amber-950 hover:bg-amber-300')}>
                    {isLiveRuntime ? 'LIVE' : isEnded ? 'ENDED' : 'Preview'}
                  </Badge>
                  <Badge className="truncate bg-black/45 text-white hover:bg-black/55">{title.trim() || 'Live Stream'}</Badge>
                  {isLiveRuntime && (
                    <Badge className="bg-black/45 font-mono text-white hover:bg-black/55">{liveDuration}</Badge>
                  )}
                </div>
                <div className="absolute bottom-3 left-3 rounded-xl bg-black/45 px-3 py-2 text-sm text-white/80 backdrop-blur">
                  FUN Profile Studio
                </div>
                {isReconnecting && (
                  <div className="absolute left-1/2 top-14 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1.5 text-center text-xs font-medium text-amber-100 backdrop-blur">
                    Ket noi bi gian doan, dang ket noi lai...
                  </div>
                )}
                <StudioTooltip label={isFullscreen ? 'Thoát fullscreen' : 'Fullscreen preview'}>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={isFullscreen ? 'Thoát fullscreen' : 'Fullscreen preview'}
                    className="absolute right-3 top-3 h-9 w-9 bg-black/45 text-white hover:bg-black/65 hover:text-white"
                    onClick={toggleFullscreen}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </StudioTooltip>
              </div>
            </div>
          </section>

          {showSidePanels && (
            <aside className="flex min-h-0 min-w-0 flex-col items-center border-l border-white/10 bg-[#15171c] p-2">
              <ToolRail />
            </aside>
          )}
          {showSidePanels && activeRightPanel && (
            <aside
              className="absolute bottom-2 right-[72px] top-2 z-20 flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#15171c]/98 p-3 text-white shadow-2xl backdrop-blur"
              style={{ width: 'clamp(280px, 24vw, 380px)', maxWidth: 'calc(100% - 96px)' }}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 font-medium">
                  <ToolIcon className="h-4 w-4 text-emerald-300" />
                  <span className="truncate">{rightPanelTool}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Close tools panel"
                  className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => setActiveRightPanel(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ToolDetail />
              </div>
            </aside>
          )}
        </main>

        <footer className="shrink-0 overflow-hidden border-t border-white/10 bg-[#15171c] px-[clamp(8px,1.5vw,20px)] py-2">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain pb-1">
              <IconControlButton
                icon={(isLiveRuntime ? !isMuted : preview.micEnabled) ? Mic : MicOff}
                label={preview.micEnabled ? 'Tắt mic' : 'Bật mic'}
                compact={isCompact}
                onClick={() => {
                  if (isLiveRuntime) {
                    toggleMute().catch(() => undefined);
                    return;
                  }
                  preview.setMicEnabled(!preview.micEnabled);
                }}
                disabled={isEnding || isEnded || isStarting}
              />
              <IconControlButton
                icon={(isLiveRuntime ? !isCameraOff : preview.cameraEnabled) ? Camera : CameraOff}
                label={preview.cameraEnabled ? 'Tắt camera' : 'Bật camera'}
                compact={isCompact}
                onClick={() => {
                  if (isLiveRuntime) {
                    toggleCamera().catch(() => undefined);
                    return;
                  }
                  preview.setCameraEnabled(!preview.cameraEnabled);
                }}
                disabled={isEnding || isEnded || isStarting}
              />

              {!isUltraCompact && (
                <>
                  <label className="flex h-10 min-w-[132px] max-w-[170px] shrink items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 text-sm text-white/75">
                    <Video className="h-4 w-4 shrink-0" />
                    <select
                      aria-label="Chọn camera"
                      value={preview.selectedVideoDeviceId}
                      onChange={(event) => preview.setSelectedVideoDeviceId(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    >
                      {preview.videoDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white">
                          {device.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </label>

                  <label className="flex h-10 min-w-[132px] max-w-[170px] shrink items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 text-sm text-white/75">
                    <Mic className="h-4 w-4 shrink-0" />
                    <select
                      aria-label="Chọn microphone"
                      value={preview.selectedAudioDeviceId}
                      onChange={(event) => preview.setSelectedAudioDeviceId(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    >
                      {preview.audioDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white">
                          {device.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </label>
                </>
              )}

              {!isCompact && (
                <>
                  <IconControlButton icon={MonitorUp} label="Share screen" compact={false} disabled />
                  <IconControlButton icon={UserPlus} label="Invite guest" compact={false} disabled />
                  <IconControlButton icon={Settings} label="Settings" compact={false} disabled />
                </>
              )}

              {isCompact && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="More controls"
                      className="h-10 w-10 shrink-0 border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuItem disabled>Share screen</DropdownMenuItem>
                    <DropdownMenuItem disabled>Invite guest</DropdownMenuItem>
                    <DropdownMenuItem disabled>Settings</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSceneDrawerOpen(true)}>Scenes</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setToolDrawerOpen(true)}>Tools</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-1">
              <Button
                size="lg"
                onClick={
                  isLiveRuntime
                    ? () => {
                        if (window.confirm('Ket thuc LIVE?')) void handleEndLive();
                      }
                    : studioState === 'error'
                      ? () => setStudioState('preview')
                      : handleGoLive
                }
                disabled={isLiveRuntime ? isEnding : (!canGoLive && studioState !== 'error')}
                aria-label={isLiveRuntime ? 'END LIVE' : 'GO LIVE'}
                className={cn(
                  'h-11 shrink-0 bg-red-600 font-bold text-white shadow-lg shadow-red-950/40 hover:bg-red-500',
                  isCompact ? 'min-w-[112px] px-4' : 'min-w-[180px] px-8',
                )}
              >
                {isEnding || isStarting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {!isCompact && 'Đang GO LIVE...'}
                    {isCompact && 'LIVE...'}
                  </>
                ) : isLiveRuntime ? (
                  <>
                    <PhoneOff className="mr-2 h-5 w-5" />
                    END LIVE
                  </>
                ) : studioState === 'error' ? (
                  'RETRY'
                ) : isEnded ? (
                  'LIVE ENDED'
                ) : (
                  <>
                    <Radio className="mr-2 h-5 w-5" />
                    GO LIVE
                  </>
                )}
              </Button>
              {!canGoLive && !isStarting && !isLiveRuntime && studioState !== 'error' && (
                <p className="max-w-[180px] text-center text-xs text-white/50">
                  {preview.cameraEnabled ? 'Đang chờ camera sẵn sàng...' : 'Bật camera để bắt đầu LIVE.'}
                </p>
              )}
            </div>
          </div>
        </footer>
      </div>

      <Sheet open={sceneDrawerOpen} onOpenChange={setSceneDrawerOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-[320px] overflow-y-auto border-white/10 bg-[#15171c] text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Scenes</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <SceneList />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={toolDrawerOpen}
        onOpenChange={(open) => {
          setToolDrawerOpen(open);
          if (!open) setActiveRightPanel(null);
        }}
      >
        <SheetContent side="right" className="w-[86vw] max-w-[340px] overflow-y-auto border-white/10 bg-[#15171c] text-white">
          <SheetHeader>
            <SheetTitle className="text-white">{rightPanelTool}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => {
                      setSelectedTool(tool.name);
                      setActiveRightPanel(tool.name);
                    }}
                    className={cn(
                      'grid h-12 place-items-center rounded-xl border',
                      activeRightPanel === tool.name
                        ? 'border-emerald-300 bg-emerald-300/10 text-emerald-100'
                        : 'border-white/10 bg-white/[0.03] text-white/65',
                    )}
                    aria-label={tool.name}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <ToolDetail />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
