import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Eye, Home, Loader2, Mic, MicOff, PhoneOff, Radio, RefreshCw, UserPlus, Video, VideoOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import {
  sendWebcamLiveHeartbeatBeacon,
  sendWebcamLiveHeartbeat,
  startWebcamCloudRecording,
  startWebcamLiveSession,
  stopWebcamLiveSession,
  updateLiveViewerCount,
  type LiveHeartbeatClientState,
  type LiveHeartbeatDeviceType,
  type RecordingStatus,
  type WebcamLiveStartResult,
} from '../liveService';
import { useLiveSession } from '../useLiveSession';
import { useLiveRtc } from '../hooks/useLiveRtc';
import { LiveChatPanel } from '../components/LiveChatPanel';
import { FloatingReactions } from '../components/FloatingReactions';
import {
  createBrowserFallbackRecorder,
  type BrowserFallbackRecorder,
  type BrowserFallbackState,
} from '../recording/browserFallbackRecorder';
import {
  controlLiveGuest,
  inviteLiveGuest,
  useLiveGuestSession,
  useLiveViewerPresence,
} from '../hooks/useLiveGuestInvite';

type BootState = 'idle' | 'auth' | 'creating' | 'loading' | 'starting' | 'ready' | 'error';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function toUserError(error: unknown): string {
  const anyErr = error as { message?: unknown; name?: unknown };
  const message = String(anyErr?.message || '');
  const name = String(anyErr?.name || '');
  if (name === 'NotAllowedError') return 'Bạn chưa cấp quyền camera/micro.';
  if (name === 'NotFoundError') return 'Không tìm thấy thiết bị camera/micro.';
  if (message.toLowerCase().includes('timeout')) return 'Kết nối quá chậm, vui lòng thử lại.';
  return message || 'Không thể bắt đầu phát trực tiếp.';
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

const REC_BADGE: Partial<Record<RecordingStatus, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }>> = {
  idle: { label: 'Sẵn sàng', variant: 'secondary' },
  starting: { label: 'Đang kết nối...', variant: 'secondary' },
  recording: { label: 'Đang phát trực tiếp', variant: 'destructive' },
  stopping: { label: 'Đang kết thúc live...', variant: 'secondary' },
  processing: { label: 'Đang xử lý replay...', variant: 'secondary' },
  ready: { label: 'Replay đã sẵn sàng', variant: 'default' },
  failed: { label: 'Lỗi ghi hình', variant: 'outline' },
};

export default function LiveHostPage() {
  const navigate = useNavigate();
  const { liveSessionId } = useParams<{ liveSessionId: string }>();
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [bootState, setBootState] = useState<BootState>('idle');
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingStatus>('idle');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [fallbackState, setFallbackState] = useState<BrowserFallbackState>('idle');
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [watchdogNotice, setWatchdogNotice] = useState<string | null>(null);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const startedRef = useRef(false);
  const initialRtcRef = useRef<WebcamLiveStartResult | null>(null);
  const fallbackRecorderRef = useRef<BrowserFallbackRecorder | null>(null);
  const heartbeatStateRef = useRef<LiveHeartbeatClientState>('live');
  const lastSentViewerCountRef = useRef<number | null>(null);
  const viewerCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveSessionId = liveSessionId || createdSessionId || undefined;
  const sessionQuery = useLiveSession(effectiveSessionId);
  const session = sessionQuery.data;
  const isHost = useMemo(() => !!session && !!userId && session.host_user_id === userId, [session, userId]);
  const { guestSession } = useLiveGuestSession(effectiveSessionId);
  const activeGuest = guestSession && ['invited', 'accepted', 'joined', 'disconnected'].includes(guestSession.status) ? guestSession : null;
  const allowedGuestRemoteUids = useMemo(
    () => activeGuest && ['accepted', 'joined'].includes(activeGuest.status) && activeGuest.agora_uid ? [activeGuest.agora_uid] : [],
    [activeGuest?.agora_uid, activeGuest?.status],
  );

  const {
    setLocalContainerRef,
    setRemoteContainerRef,
    remoteUsers,
    isJoined,
    isMuted,
    isCameraOff,
    hasLocalVideoPreview,
    localVideoWarning,
    statusText,
    start,
    leave,
    toggleMute,
    toggleCamera,
    getLocalTracks,
  } = useLiveRtc({
    sessionId: effectiveSessionId,
    role: 'host',
    enabled: !!effectiveSessionId && ['live', 'reconnecting', 'disconnected'].includes(String(session?.status || '')),
    allowedRemoteUids: allowedGuestRemoteUids,
    initialRtcToken: initialRtcRef.current
      ? {
          appId: initialRtcRef.current.appId,
          token: initialRtcRef.current.token,
          uid: initialRtcRef.current.uid,
          channel: initialRtcRef.current.channel,
          expiresAt: initialRtcRef.current.expiresAt,
        }
      : null,
    onViewerCountChange: async (count) => {
      if (!effectiveSessionId) return;
      if (lastSentViewerCountRef.current === count) return;
      if (viewerCountTimerRef.current) clearTimeout(viewerCountTimerRef.current);
      viewerCountTimerRef.current = setTimeout(async () => {
        if (!effectiveSessionId || lastSentViewerCountRef.current === count) return;
        lastSentViewerCountRef.current = count;
        await updateLiveViewerCount(effectiveSessionId, count);
      }, 400);
    },
  });

  const { viewers, isLoading: viewersLoading } = useLiveViewerPresence(effectiveSessionId, isHost && invitePanelOpen);
  const inviteCandidates = viewers.filter((viewer) => viewer.user_id !== userId);

  const sendHostHeartbeat = useCallback(async (
    clientState: LiveHeartbeatClientState = heartbeatStateRef.current,
    media?: { hasAudio: boolean; hasVideo: boolean; mediaActive: boolean },
  ) => {
    if (!effectiveSessionId || !session) return null;
    const result = await sendWebcamLiveHeartbeat({
      sessionId: effectiveSessionId,
      userId,
      agoraChannelName: session.agora_channel || session.channel_name,
      clientState,
      deviceType: getDeviceType(),
      sourceType: getDeviceType() === 'mobile' ? 'mobile' : 'webcam',
      timestamp: new Date().toISOString(),
      mediaActive: media?.mediaActive,
      hasAudio: media?.hasAudio,
      hasVideo: media?.hasVideo,
    });
    if (result?.ended) {
      setWatchdogNotice('Phiên LIVE trước đã kết thúc do mất kết nối. Bạn có thể bắt đầu LIVE mới.');
      fallbackRecorderRef.current?.stop().catch(() => undefined);
      fallbackRecorderRef.current = null;
      await leave();
    } else if (clientState === 'reconnecting') {
      setWatchdogNotice('Đang khôi phục phiên LIVE…');
    } else if (clientState === 'live') {
      setWatchdogNotice(null);
    }
    return result;
  }, [effectiveSessionId, leave, session, userId]);

  const runBootstrap = useCallback(async () => {
    setBootError(null);
    setBootState('auth');
    setCreatedSessionId(null);

    const authResult = await withTimeout(supabase.auth.getSession(), 8000, 'auth timeout');
    const currentUserId = authResult.data.session?.user?.id;
    if (!currentUserId) throw new Error('Bạn cần đăng nhập để phát trực tiếp.');
    setUserId(currentUserId);

    if (liveSessionId) {
      setBootState('loading');
      return;
    }

    setBootState('creating');
    const created = await withTimeout(
      startWebcamLiveSession({ privacy: 'public' }),
      20000,
      'create live session timeout',
    );
    initialRtcRef.current = created;
    setCreatedSessionId(created.sessionId);
    setBootState('loading');
    navigate(`/live/${created.sessionId}/host`, { replace: true });
  }, [liveSessionId, navigate]);

  useEffect(() => {
    let active = true;
    runBootstrap().catch((error) => {
      if (!active) return;
      setBootState('error');
      setBootError(toUserError(error));
    });
    return () => {
      active = false;
    };
  }, [retryNonce, runBootstrap]);

  useEffect(() => {
    if (typeof session?.viewer_count === 'number') {
      lastSentViewerCountRef.current = session.viewer_count;
    }
  }, [session?.viewer_count]);

  useEffect(() => {
    if (!effectiveSessionId || sessionQuery.isLoading) return;
    if (sessionQuery.isError) {
      setBootState('error');
      setBootError('Không tải được phiên LIVE. Vui lòng thử lại.');
      return;
    }
    if (!session) {
      setBootState('error');
      setBootError('Không tìm thấy phiên LIVE.');
      return;
    }
    if (bootState !== 'starting') setBootState('ready');
  }, [bootState, effectiveSessionId, session, sessionQuery.isError, sessionQuery.isLoading]);

  useEffect(() => {
    if (!session || !isHost || !['live', 'reconnecting', 'disconnected'].includes(String(session.status)) || startedRef.current) return;
    startedRef.current = true;
    setBootState('starting');
    setRecordingState('starting');

    start()
      .then(async () => {
        setBootState('ready');
        setRecordingState('starting');
        setRecordingError(null);
        const localTracks = getLocalTracks();
        const audioTrack = mediaTrackFromAgoraTrack(localTracks.audio);
        const videoTrack = mediaTrackFromAgoraTrack(localTracks.video);
        const mediaTracks = [audioTrack, videoTrack].filter(Boolean) as MediaStreamTrack[];
        const hasAudio = !!audioTrack;
        const hasVideo = !!videoTrack;
        await sendHostHeartbeat('live', { hasAudio, hasVideo, mediaActive: hasAudio || hasVideo }).catch(() => undefined);
        const initialRtc = initialRtcRef.current;
        const shouldUseFallback =
          !!initialRtc &&
          (initialRtc.recordingAvailable === false ||
            initialRtc.fallbackRecordingRecommended ||
            initialRtc.fallbackProvider === 'browser');
        if (shouldUseFallback && !fallbackRecorderRef.current && effectiveSessionId) {
          const localTracks = getLocalTracks();
          const mediaTracks = [
            mediaTrackFromAgoraTrack(localTracks.audio),
            mediaTrackFromAgoraTrack(localTracks.video),
          ].filter(Boolean) as MediaStreamTrack[];
          const fallbackRecorder = createBrowserFallbackRecorder({
            liveSessionId: effectiveSessionId,
            postId: session.post_id ?? null,
            tracks: mediaTracks,
            onStateChange: (state) => {
              setFallbackState(state);
              if (state === 'recording') setFallbackNotice('Đang ghi replay dự phòng từ trình duyệt.');
              if (state === 'uploaded') setFallbackNotice('Replay dự phòng đã được upload thành công.');
            },
            onError: (error) => {
              console.warn('[LiveHostPage] browser fallback recording failed:', error);
              setFallbackNotice('Livestream vẫn tiếp tục, nhưng replay có thể không được lưu.');
              toast.warning('Livestream vẫn tiếp tục, nhưng replay có thể không được lưu.');
            },
          });
          fallbackRecorderRef.current = fallbackRecorder;
          setFallbackNotice('Livestream vẫn đang phát trực tiếp, nhưng hệ thống ghi replay chính đang quá tải. FUN Profile sẽ thử ghi dự phòng từ trình duyệt của bạn. Vui lòng không tắt tab cho đến khi kết thúc live.');
          await fallbackRecorder.start();
        }
        if (!fallbackRecorderRef.current) {
          try {
            const recording = await startWebcamCloudRecording({
              sessionId: effectiveSessionId!,
              channelName: session.agora_channel || session.channel_name,
              hasAudio,
              hasVideo,
            });
            if (recording.recordingAvailable === false || recording.fallbackRecordingRecommended || recording.fallbackProvider === 'browser') {
              const fallbackRecorder = createBrowserFallbackRecorder({
                liveSessionId: effectiveSessionId!,
                postId: session.post_id ?? null,
                tracks: mediaTracks,
                onStateChange: (state) => {
                  setFallbackState(state);
                  if (state === 'recording') setFallbackNotice('Đang ghi replay dự phòng từ trình duyệt.');
                  if (state === 'uploaded') setFallbackNotice('Replay dự phòng đã được upload thành công.');
                },
                onError: (error) => {
                  console.warn('[LiveHostPage] browser fallback recording failed:', error);
                  setFallbackNotice('Livestream vẫn tiếp tục, nhưng replay có thể không được lưu.');
                  toast.warning('Livestream vẫn tiếp tục, nhưng replay có thể không được lưu.');
                },
              });
              fallbackRecorderRef.current = fallbackRecorder;
              setRecordingState('failed');
              setRecordingError(null);
              setFallbackNotice('Livestream vẫn đang phát trực tiếp, nhưng hệ thống ghi replay chính đang quá tải. FUN Profile sẽ thử ghi dự phòng từ trình duyệt của bạn. Vui lòng không tắt tab cho đến khi kết thúc live.');
              await fallbackRecorder.start();
            } else {
              setRecordingState('recording');
              setFallbackNotice(null);
            }
          } catch (error) {
            console.warn('[LiveHostPage] Agora Cloud Recording start failed, starting browser fallback:', error);
            if (fallbackRecorderRef.current) {
              setFallbackNotice('Livestream vẫn tiếp tục, nhưng replay có thể không được lưu.');
              return;
            }
            const fallbackRecorder = createBrowserFallbackRecorder({
              liveSessionId: effectiveSessionId!,
              postId: session.post_id ?? null,
              tracks: mediaTracks,
              onStateChange: (state) => {
                setFallbackState(state);
                if (state === 'recording') setFallbackNotice('Đang ghi replay dự phòng từ trình duyệt.');
                if (state === 'uploaded') setFallbackNotice('Replay dự phòng đã được upload thành công.');
              },
              onError: (fallbackError) => {
                console.warn('[LiveHostPage] browser fallback recording failed:', fallbackError);
                setFallbackNotice('Livestream vẫn tiếp tục, nhưng replay có thể không được lưu.');
                toast.warning('Livestream vẫn tiếp tục, nhưng replay có thể không được lưu.');
              },
            });
            fallbackRecorderRef.current = fallbackRecorder;
            setRecordingState('failed');
            setRecordingError(null);
            setFallbackNotice('Livestream vẫn đang phát trực tiếp, nhưng hệ thống ghi replay chính đang quá tải. FUN Profile sẽ thử ghi dự phòng từ trình duyệt của bạn. Vui lòng không tắt tab cho đến khi kết thúc live.');
            await fallbackRecorder.start();
          }
        }
      })
      .catch((error) => {
        startedRef.current = false;
        const message = toUserError(error);
        setBootState('error');
        setBootError(message);
        setRecordingState('failed');
        setRecordingError(message);
        toast.error(message);
      });
  }, [effectiveSessionId, getLocalTracks, isHost, sendHostHeartbeat, session, start]);

  useEffect(() => {
    if (!effectiveSessionId || !isHost || !isJoined || !['live', 'reconnecting', 'disconnected'].includes(String(session?.status || ''))) return;
    heartbeatStateRef.current = navigator.onLine === false ? 'reconnecting' : 'live';
    sendHostHeartbeat(heartbeatStateRef.current).catch(() => undefined);
    const timer = window.setInterval(() => {
      const state = navigator.onLine === false ? 'reconnecting' : heartbeatStateRef.current;
      sendHostHeartbeat(state).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [effectiveSessionId, isHost, isJoined, sendHostHeartbeat, session?.status]);

  useEffect(() => {
    if (!effectiveSessionId || !isHost || !session) return;

    const sendLifecycleHeartbeat = (clientState: LiveHeartbeatClientState) => {
      heartbeatStateRef.current = clientState;
      void sendWebcamLiveHeartbeatBeacon({
        sessionId: effectiveSessionId,
        userId,
        agoraChannelName: session.agora_channel || session.channel_name,
        clientState,
        deviceType: getDeviceType(),
        sourceType: getDeviceType() === 'mobile' ? 'mobile' : 'webcam',
        timestamp: new Date().toISOString(),
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendLifecycleHeartbeat('background');
      } else {
        setWatchdogNotice('Đang khôi phục phiên LIVE…');
        heartbeatStateRef.current = navigator.onLine === false ? 'reconnecting' : 'live';
        sendHostHeartbeat(heartbeatStateRef.current).catch(() => undefined);
      }
    };
    const handlePageHide = () => sendLifecycleHeartbeat('closing');
    const handleBeforeUnload = () => sendLifecycleHeartbeat('closing');
    const handleOffline = () => {
      heartbeatStateRef.current = 'reconnecting';
      setWatchdogNotice('Đang khôi phục phiên LIVE…');
      sendHostHeartbeat('reconnecting').catch(() => undefined);
    };
    const handleOnline = () => {
      heartbeatStateRef.current = 'live';
      sendHostHeartbeat('live').catch(() => undefined);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [effectiveSessionId, isHost, sendHostHeartbeat, session, userId]);

  useEffect(() => {
    if (session?.status && !['live', 'reconnecting', 'disconnected'].includes(String(session.status))) {
      fallbackRecorderRef.current?.stop().catch(() => undefined);
      fallbackRecorderRef.current = null;
      leave().catch(() => undefined);
    }
  }, [leave, session?.status]);

  useEffect(() => {
    return () => {
      if (viewerCountTimerRef.current) clearTimeout(viewerCountTimerRef.current);
      fallbackRecorderRef.current?.stop().catch(() => undefined);
      fallbackRecorderRef.current = null;
      leave().catch(() => undefined);
    };
  }, [leave]);

  const handleEndLive = async () => {
    if (!effectiveSessionId) return;
    if (viewerCountTimerRef.current) {
      clearTimeout(viewerCountTimerRef.current);
      viewerCountTimerRef.current = null;
    }

    setRecordingState('stopping');
    try {
      if (fallbackRecorderRef.current) {
        await fallbackRecorderRef.current.stop();
        fallbackRecorderRef.current = null;
      }
      await stopWebcamLiveSession(effectiveSessionId);
      setRecordingState('processing');
      toast.success('Live đã kết thúc - replay đang được xử lý.');
      await leave();
      navigate(`/live/${effectiveSessionId}`);
    } catch (error) {
      const message = toUserError(error);
      setRecordingState('failed');
      setRecordingError(message);
      toast.error(message);
    }
  };

  const handleInviteGuest = async (guestUserId: string) => {
    if (!effectiveSessionId) return;
    try {
      await inviteLiveGuest(effectiveSessionId, guestUserId);
      setInvitePanelOpen(false);
      toast.success('Đã gửi lời mời cùng live.');
    } catch (error) {
      toast.error(toUserError(error));
    }
  };

  const handleGuestAction = async (action: 'cancel' | 'remove' | 'mute' | 'unmute') => {
    if (!activeGuest) return;
    try {
      await controlLiveGuest(activeGuest.id, action);
      toast.success(action === 'mute' ? 'Đã tắt mic guest.' : action === 'unmute' ? 'Đã bật lại mic guest.' : 'Đã cập nhật guest.');
    } catch (error) {
      toast.error(toUserError(error));
    }
  };

  const handleRetry = () => {
    startedRef.current = false;
    initialRtcRef.current = null;
    setBootError(null);
    setBootState('idle');
    setRetryNonce((x) => x + 1);
  };

  const isEnding = ['stopping', 'processing'].includes(recordingState);
  const showLoader = ['auth', 'creating', 'loading', 'starting'].includes(bootState) || (!!effectiveSessionId && sessionQuery.isLoading);

  if (showLoader) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>
            {bootState === 'creating'
              ? 'Đang tạo phiên LIVE...'
              : bootState === 'starting'
                ? 'Đang kết nối...'
                : 'Đang tải...'}
          </span>
        </div>
      </div>
    );
  }

  if (bootState === 'error') {
    return (
      <div className="min-h-screen bg-background">
        <FacebookNavbar />
        <div className="pt-20 px-4 max-w-xl mx-auto">
          <Card className="p-6 space-y-4">
            <div className="font-semibold text-lg">Không thể bắt đầu LIVE</div>
            <div className="text-sm text-muted-foreground">{bootError || 'Đã xảy ra lỗi không xác định.'}</div>
            <div className="flex items-center gap-2">
              <Button onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Thử lại
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                <Home className="h-4 w-4 mr-2" />
                Quay về trang chủ
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 space-y-3">
          <div>Không tìm thấy phiên LIVE.</div>
          <Button onClick={handleRetry}>Thử lại</Button>
        </Card>
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="min-h-screen bg-background">
        <FacebookNavbar />
        <div className="pt-20 px-4 max-w-3xl mx-auto">
          <Card className="p-6 text-center space-y-4">
            <p className="font-semibold">Bạn không phải host của phiên live này.</p>
            <Button onClick={() => navigate(`/live/${session.id}`)}>Chuyển sang chế độ xem</Button>
          </Card>
        </div>
      </div>
    );
  }

  const recBadge = REC_BADGE[recordingState] || { label: recordingState.toUpperCase(), variant: 'secondary' as const };

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      <main className="pt-16 px-3 md:px-6 pb-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <h1 className="text-xl md:text-2xl font-bold">{session.title || 'Live Stream'}</h1>
                <div className="text-sm text-muted-foreground">Channel: {session.agora_channel || session.channel_name}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={['live', 'reconnecting', 'disconnected'].includes(String(session.status)) && isJoined ? 'destructive' : 'secondary'} className="gap-1">
                  <Radio className="h-3.5 w-3.5" />
                  {!['live', 'reconnecting', 'disconnected'].includes(String(session.status))
                    ? 'ENDED'
                    : session.status === 'reconnecting' || session.status === 'disconnected'
                      ? 'RECONNECTING'
                      : isJoined ? 'LIVE' : 'CONNECTING'}
                </Badge>
                <Badge variant={recBadge.variant}>{recBadge.label}</Badge>
                {fallbackState !== 'idle' && (
                  <Badge variant={fallbackState === 'failed' ? 'outline' : 'secondary'}>
                    {fallbackState === 'failed' ? 'Fallback lỗi' : 'Fallback browser'}
                  </Badge>
                )}
                <Badge variant="secondary" className="gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {session.viewer_count || 0}
                </Badge>
              </div>
            </div>

            {recordingError ? (
              <Card className="p-3 text-sm border-destructive/30 text-destructive">
                Ghi hình: {recordingError}
              </Card>
            ) : null}

            {fallbackNotice ? (
              <Card className="p-3 text-sm border-amber-300/70 text-amber-800 bg-amber-50 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{fallbackNotice}</span>
              </Card>
            ) : null}

            {watchdogNotice ? (
              <Card className="p-3 text-sm border-primary/30 text-primary flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {watchdogNotice}
              </Card>
            ) : null}

            {recordingState === 'processing' && (
              <Card className="p-3 text-sm border-primary/30 text-primary flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xử lý replay...
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="aspect-video bg-black relative">
                <div className={remoteUsers.length > 0 ? 'h-full w-full grid grid-cols-1 md:grid-cols-2' : 'h-full w-full'}>
                  <div className="relative w-full h-full min-h-[240px] bg-black overflow-hidden">
                    <div ref={setLocalContainerRef} className="absolute inset-0" />
                    {isJoined && (!hasLocalVideoPreview || localVideoWarning) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-4 text-center text-sm text-white/90">
                        {isCameraOff
                          ? 'Camera đang tắt.'
                          : localVideoWarning || 'Camera chưa hiển thị, vui lòng bật lại camera hoặc chọn thiết bị khác.'}
                      </div>
                    )}
                    <Badge className="absolute left-2 top-2 z-10" variant="secondary">Host</Badge>
                  </div>
                  {remoteUsers.slice(0, 1).map((remote) => (
                    <div key={remote.uid} className="relative w-full h-full min-h-[240px] bg-black overflow-hidden">
                      <div ref={setRemoteContainerRef(remote.uid)} className="absolute inset-0" />
                      {!remote.hasVideo && (
                        <div className="absolute inset-0 flex items-center justify-center text-white/80 bg-black">
                          Guest đang tắt camera
                        </div>
                      )}
                      <Badge className="absolute left-2 top-2 z-10" variant="secondary">
                        {activeGuest?.guest_profile?.full_name || activeGuest?.guest_profile?.username || 'Guest'}
                      </Badge>
                    </div>
                  ))}
                </div>
                {!isJoined && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/90 bg-black/50">
                    {statusText}
                  </div>
                )}
                {effectiveSessionId && <FloatingReactions sessionId={effectiveSessionId} />}
              </div>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setInvitePanelOpen((open) => !open)} disabled={!isJoined || isEnding || !!activeGuest}>
                <UserPlus className="h-4 w-4 mr-2" />
                Mời bạn trò chuyện
              </Button>
              <Button variant="outline" onClick={toggleMute} disabled={!isJoined || isEnding}>
                {isMuted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                {isMuted ? 'Bật mic' : 'Tắt mic'}
              </Button>
              <Button variant="outline" onClick={toggleCamera} disabled={!isJoined || isEnding}>
                {isCameraOff ? <VideoOff className="h-4 w-4 mr-2" /> : <Video className="h-4 w-4 mr-2" />}
                {isCameraOff ? 'Bật camera' : 'Tắt camera'}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isEnding}>
                {isEnding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PhoneOff className="h-4 w-4 mr-2" />}
                {recordingState === 'processing' ? 'Đang xử lý replay...' : recordingState === 'stopping' ? 'Đang kết thúc live...' : 'Kết thúc live'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bạn có chắc muốn kết thúc LIVE không?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Viewers sẽ thấy livestream đã kết thúc. Replay sẽ được xử lý sau khi hệ thống dừng recording an toàn.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Tiếp tục LIVE</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndLive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Kết thúc LIVE
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {invitePanelOpen && (
              <Card className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">Viewer đang xem live</div>
                  <Button variant="ghost" size="icon" onClick={() => setInvitePanelOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {viewersLoading ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải viewer...
                  </div>
                ) : inviteCandidates.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Chưa có viewer đăng nhập nào đang xem live.</div>
                ) : (
                  <div className="space-y-2">
                    {inviteCandidates.map((viewer) => (
                      <div key={viewer.user_id} className="flex items-center justify-between gap-3 rounded border p-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={viewer.profile?.avatar_url || ''} />
                            <AvatarFallback>{(viewer.profile?.username || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{viewer.profile?.full_name || viewer.profile?.username || 'Viewer'}</div>
                            <div className="text-xs text-muted-foreground">Đang xem</div>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleInviteGuest(viewer.user_id)}>
                          Mời
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {activeGuest && (
              <Card className="p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={activeGuest.guest_profile?.avatar_url || ''} />
                    <AvatarFallback>{(activeGuest.guest_profile?.username || 'G').charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{activeGuest.guest_profile?.full_name || activeGuest.guest_profile?.username || 'Guest'}</div>
                    <div className="text-xs text-muted-foreground">Trạng thái: {activeGuest.status}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeGuest.status === 'invited' && (
                    <Button variant="outline" size="sm" onClick={() => handleGuestAction('cancel')}>Hủy lời mời</Button>
                  )}
                  {activeGuest.status === 'joined' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleGuestAction(activeGuest.muted_by_host ? 'unmute' : 'mute')}>
                        {activeGuest.muted_by_host ? 'Bật mic guest' : 'Tắt mic guest'}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleGuestAction('remove')}>Remove guest</Button>
                    </>
                  )}
                </div>
              </Card>
            )}
          </section>

          {effectiveSessionId && <LiveChatPanel sessionId={effectiveSessionId} className="h-[70vh] lg:h-[calc(100vh-120px)]" />}
        </div>
      </main>
    </div>
  );
}
