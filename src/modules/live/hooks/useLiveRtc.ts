import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';
import { createAgoraRtcClient, secondsUntilExpiry } from '@/lib/agoraRtc';
import { getRtcToken } from '../api/agora';
import type { RtcTokenResult } from '../api/agora';

type LiveRole = 'host' | 'audience' | 'guest';
type RemoteLiveUser = {
  uid: string;
  hasAudio: boolean;
  hasVideo: boolean;
};

interface UseLiveRtcOptions {
  sessionId?: string;
  role: LiveRole;
  enabled?: boolean;
  initialRtcToken?: RtcTokenResult | null;
  inviteId?: string | null;
  allowedRemoteUids?: Array<string | number> | null;
  showRemoteUsersWithoutMedia?: boolean;
  onViewerCountChange?: (count: number) => void;
  onRemoteOffline?: () => void;
}

const MAX_REJOIN_ATTEMPTS = 5;
const LOCAL_VIDEO_WARNING = 'Camera chưa hiển thị, vui lòng bật lại camera hoặc chọn thiết bị khác.';

function mapRtcError(error: unknown): string {
  const anyErr = error as any;
  const name = String(anyErr?.name || '');
  const msg = String(anyErr?.message || '');
  if (name === 'NotAllowedError') return 'Bạn chưa cấp quyền camera/micro.';
  if (name === 'NotFoundError') return 'Không tìm thấy thiết bị camera/micro.';
  if (msg.toLowerCase().includes('network')) return 'Mạng không ổn định, đang thử kết nối lại...';
  if (msg.toLowerCase().includes('timeout')) return 'Kết nối quá chậm, vui lòng thử lại.';
  return msg || 'Kết nối LIVE thất bại.';
}

export function useLiveRtc({
  sessionId,
  role,
  enabled = true,
  initialRtcToken = null,
  inviteId = null,
  allowedRemoteUids = null,
  showRemoteUsersWithoutMedia = false,
  onViewerCountChange,
  onRemoteOffline,
}: UseLiveRtcOptions) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const remoteAudioRef = useRef<any>(null);
  const tokenExpiresAtRef = useRef<number | null>(null);
  const rejoinAttemptsRef = useRef(0);
  const renewFailuresRef = useRef(0);
  const rejoinTimerRef = useRef<number | null>(null);
  const isLeavingRef = useRef(false);
  const startedRef = useRef(false);
  const isStartingRef = useRef(false);
  const localVideoHealthCleanupRef = useRef<(() => void) | null>(null);

  const localContainerRef = useRef<HTMLDivElement | null>(null);
  const [localContainerVersion, setLocalContainerVersion] = useState(0);
  const remoteContainerMapRef = useRef(new Map<string, HTMLDivElement>());

  const setLocalContainerRef = useCallback((node: HTMLDivElement | null) => {
    localContainerRef.current = node;
    setLocalContainerVersion((version) => version + 1);
  }, []);
  const remoteContainerRef = useRef<HTMLDivElement | null>(null);

  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasLocalVideoPreview, setHasLocalVideoPreview] = useState(false);
  const [localVideoWarning, setLocalVideoWarning] = useState<string | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteLiveUser[]>([]);
  const hasRemoteUidFilter = allowedRemoteUids !== null;
  const allowedRemoteUidSet = useMemo(() => {
    return new Set((allowedRemoteUids || []).map((uid) => String(uid)));
  }, [allowedRemoteUids]);
  const [statusText, setStatusText] = useState('Đang kết nối...');

  // Viewer count is now tracked via database, not Agora remoteUsers
  const emitViewerCount = useCallback((_client: IAgoraRTCClient) => {
    // no-op: viewer count managed by increment/decrement in LiveAudiencePage
  }, []);

  const clearRejoinTimer = () => {
    if (rejoinTimerRef.current) {
      window.clearTimeout(rejoinTimerRef.current);
      rejoinTimerRef.current = null;
    }
  };

  const getNativeVideoTrack = useCallback(() => {
    const track = localVideoRef.current as unknown as { getMediaStreamTrack?: () => MediaStreamTrack };
    try {
      return track?.getMediaStreamTrack?.() ?? null;
    } catch {
      return null;
    }
  }, []);

  const inspectLocalVideoTrack = useCallback(() => {
    const nativeTrack = getNativeVideoTrack();
    if (!nativeTrack) return LOCAL_VIDEO_WARNING;
    if (nativeTrack.readyState === 'ended') return LOCAL_VIDEO_WARNING;
    if (nativeTrack.muted) return LOCAL_VIDEO_WARNING;
    return null;
  }, [getNativeVideoTrack]);

  const lastPlayedContainerRef = useRef<HTMLDivElement | null>(null);

  const playLocalVideo = useCallback(() => {
    const videoTrack = localVideoRef.current;
    const container = localContainerRef.current;
    if (!videoTrack || !container) {
      setHasLocalVideoPreview(false);
      return false;
    }

    try {
      // Only stop if switching to a different container; otherwise re-play in-place.
      if (lastPlayedContainerRef.current && lastPlayedContainerRef.current !== container) {
        try { videoTrack.stop(); } catch { /* noop */ }
      }
      videoTrack.play(container, { fit: 'contain', mirror: true } as any);
      lastPlayedContainerRef.current = container;

      // Verify Agora actually injected a <video> child & container has size; retry up to 3x.
      const verify = (attempt = 0) => {
        const cont = localContainerRef.current;
        if (!cont || !localVideoRef.current) return;
        const hasVideoEl = !!cont.querySelector('video');
        const { clientWidth, clientHeight } = cont;
        console.log('[useLiveRtc] playLocalVideo verify', { attempt, hasVideoEl, clientWidth, clientHeight });
        if ((!hasVideoEl || clientWidth === 0 || clientHeight === 0) && attempt < 3) {
          setTimeout(() => {
            try { localVideoRef.current?.play(cont, { fit: 'contain', mirror: true } as any); } catch { /* noop */ }
            verify(attempt + 1);
          }, 200);
        }
      };
      requestAnimationFrame(() => verify(0));

      const warning = inspectLocalVideoTrack();
      setLocalVideoWarning(warning);
      setHasLocalVideoPreview(!warning);
      return !warning;
    } catch (error) {
      console.warn('[useLiveRtc] local video preview play failed:', error);
      setLocalVideoWarning(LOCAL_VIDEO_WARNING);
      setHasLocalVideoPreview(false);
      return false;
    }
  }, [inspectLocalVideoTrack]);

  const bindLocalVideoHealth = useCallback(() => {
    localVideoHealthCleanupRef.current?.();
    localVideoHealthCleanupRef.current = null;

    const nativeTrack = getNativeVideoTrack();
    if (!nativeTrack) {
      setLocalVideoWarning(LOCAL_VIDEO_WARNING);
      setHasLocalVideoPreview(false);
      return;
    }

    const markProblem = () => {
      setLocalVideoWarning(LOCAL_VIDEO_WARNING);
      setHasLocalVideoPreview(false);
    };
    const markHealthy = () => {
      setLocalVideoWarning(null);
      playLocalVideo();
    };

    nativeTrack.addEventListener('ended', markProblem);
    nativeTrack.addEventListener('mute', markProblem);
    nativeTrack.addEventListener('unmute', markHealthy);
    localVideoHealthCleanupRef.current = () => {
      nativeTrack.removeEventListener('ended', markProblem);
      nativeTrack.removeEventListener('mute', markProblem);
      nativeTrack.removeEventListener('unmute', markHealthy);
    };
  }, [getNativeVideoTrack, playLocalVideo]);

  const setRemoteContainerRef = useCallback((uid: string | number) => (node: HTMLDivElement | null) => {
    const key = String(uid);
    if (node) {
      remoteContainerMapRef.current.set(key, node);
      const user = clientRef.current?.remoteUsers.find((candidate) => String(candidate.uid) === key);
      const hasMedia = !!user && (!!user.audioTrack || !!user.videoTrack || !!user.hasAudio || !!user.hasVideo);
      const allowed = !hasRemoteUidFilter || allowedRemoteUidSet.has(key);
      if (user?.videoTrack && allowed && (showRemoteUsersWithoutMedia || hasMedia)) user.videoTrack.play(node);
    } else {
      remoteContainerMapRef.current.delete(key);
    }
  }, [allowedRemoteUidSet, hasRemoteUidFilter, showRemoteUsersWithoutMedia]);

  const shouldDisplayRemoteUser = useCallback((user: IAgoraRTCRemoteUser) => {
    const hasMedia = !!user.audioTrack || !!user.videoTrack || !!user.hasAudio || !!user.hasVideo;
    if (!showRemoteUsersWithoutMedia && !hasMedia) return false;
    if (hasRemoteUidFilter && !allowedRemoteUidSet.has(String(user.uid))) return false;
    return true;
  }, [allowedRemoteUidSet, hasRemoteUidFilter, showRemoteUsersWithoutMedia]);

  const syncRemoteUsers = useCallback((client: IAgoraRTCClient) => {
    const users = client.remoteUsers
      .filter(shouldDisplayRemoteUser)
      .map((user) => ({
        uid: String(user.uid),
        hasAudio: !!user.audioTrack || !!user.hasAudio,
        hasVideo: !!user.videoTrack || !!user.hasVideo,
      }));
    setRemoteUsers(users);
    setHasRemoteVideo(users.some((user) => user.hasVideo));
  }, [shouldDisplayRemoteUser]);

  const playRemote = useCallback((user: IAgoraRTCRemoteUser) => {
    if (!shouldDisplayRemoteUser(user)) {
      if (clientRef.current) syncRemoteUsers(clientRef.current);
      return;
    }
    const container = remoteContainerMapRef.current.get(String(user.uid)) || remoteContainerRef.current;
    if (user.videoTrack && container) {
      user.videoTrack.play(container);
      setHasRemoteVideo(true);
    }
    if (user.audioTrack) {
      remoteAudioRef.current = user.audioTrack;
      user.audioTrack.play();
    }
    if (clientRef.current) syncRemoteUsers(clientRef.current);
  }, [shouldDisplayRemoteUser, syncRemoteUsers]);

  const refreshToken = useCallback(async () => {
    if (!sessionId || !clientRef.current) return;
    const tokenData = await getRtcToken({ sessionId, role, inviteId: inviteId || undefined });
    tokenExpiresAtRef.current = tokenData.expiresAt;
    await clientRef.current.renewToken(tokenData.token);
    renewFailuresRef.current = 0;
  }, [inviteId, role, sessionId]);

  const leave = useCallback(async () => {
    isLeavingRef.current = true;
    clearRejoinTimer();
    renewFailuresRef.current = 0;
    rejoinAttemptsRef.current = 0;

    localVideoHealthCleanupRef.current?.();
    localVideoHealthCleanupRef.current = null;
    if (clientRef.current) {
      const tracks = [localAudioRef.current, localVideoRef.current].filter(Boolean) as Array<IMicrophoneAudioTrack | ICameraVideoTrack>;
      if (tracks.length > 0) {
        await clientRef.current.unpublish(tracks).catch((error) => {
          console.warn('[useLiveRtc] agora_rtc_unpublish failed:', error);
        });
      }
      console.log('[useLiveRtc] agora_rtc_leave');
    }
    localAudioRef.current?.close();
    localVideoRef.current?.close();
    localAudioRef.current = null;
    localVideoRef.current = null;
    lastPlayedContainerRef.current = null;
    remoteAudioRef.current?.stop?.();
    remoteAudioRef.current = null;
    setHasRemoteVideo(false);
    setHasLocalVideoPreview(false);
    setLocalVideoWarning(null);
    setRemoteUsers([]);
    setIsJoined(false);
    startedRef.current = false;
    isStartingRef.current = false;

    if (clientRef.current) {
      clientRef.current.removeAllListeners();
      await clientRef.current.leave();
      clientRef.current = null;
    }
  }, []);

  const rejoinWithBackoff = useCallback(async () => {
    if (!sessionId || !clientRef.current || isLeavingRef.current) return;
    if (rejoinAttemptsRef.current >= MAX_REJOIN_ATTEMPTS) {
      setStatusText('Kết nối thất bại, thử tải lại.');
      return;
    }

    rejoinAttemptsRef.current += 1;
    const attempt = rejoinAttemptsRef.current;
    const delay = Math.min(1000 * 2 ** (attempt - 1), 12000);
    clearRejoinTimer();

    rejoinTimerRef.current = window.setTimeout(async () => {
      try {
        const tokenData = await getRtcToken({ sessionId, role, inviteId: inviteId || undefined });
        tokenExpiresAtRef.current = tokenData.expiresAt;
        await clientRef.current?.leave();
        await clientRef.current?.join(tokenData.appId, tokenData.channel, tokenData.token, tokenData.uid);

        if ((role === 'host' || role === 'guest') && localAudioRef.current) {
          if (localVideoRef.current) {
            await clientRef.current?.publish([localAudioRef.current, localVideoRef.current]);
            playLocalVideo();
          } else {
            await clientRef.current?.publish(localAudioRef.current);
          }
          if (clientRef.current) emitViewerCount(clientRef.current);
        }

        rejoinAttemptsRef.current = 0;
        setStatusText(role === 'audience' ? 'Đang chờ host...' : 'Đang phát trực tiếp');
        setIsJoined(true);
      } catch (error) {
        setStatusText(mapRtcError(error));
        rejoinWithBackoff().catch(() => undefined);
      }
    }, delay);
  }, [emitViewerCount, inviteId, playLocalVideo, role, sessionId]);

  const setupClient = useCallback(() => {
    if (clientRef.current) return clientRef.current;

    const client = createAgoraRtcClient('rtc');
    clientRef.current = client;

    client.on('user-joined', () => {
      emitViewerCount(client);
      syncRemoteUsers(client);
    });

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      playRemote(user);
      emitViewerCount(client);
      syncRemoteUsers(client);
    });

    client.on('user-unpublished', () => {
      syncRemoteUsers(client);
      if (role === 'audience') {
        setStatusText('Host tạm dừng phát...');
        onRemoteOffline?.();
      }
    });

    client.on('user-left', () => {
      emitViewerCount(client);
      syncRemoteUsers(client);
      if (role === 'audience' && client.remoteUsers.length === 0) {
        setHasRemoteVideo(false);
        setStatusText('Host đã rời phiên live');
        onRemoteOffline?.();
      }
    });

    client.on('connection-state-change', (curState, _prevState, reason) => {
      if (curState === 'DISCONNECTED' && reason !== 'LEAVE' && !isLeavingRef.current) {
        setStatusText('Mạng không ổn định, đang thử kết nối lại...');
        rejoinWithBackoff().catch(() => undefined);
      }
    });

    client.on('token-privilege-will-expire', () => {
      refreshToken().catch(() => {
        renewFailuresRef.current += 1;
        if (renewFailuresRef.current >= 2) {
          setStatusText('Đang cấp lại token...');
          rejoinWithBackoff().catch(() => undefined);
        }
      });
    });

    client.on('token-privilege-did-expire', () => {
      refreshToken().catch(() => {
        renewFailuresRef.current += 1;
        setStatusText('Token hết hạn, đang kết nối lại...');
        rejoinWithBackoff().catch(() => undefined);
      });
    });

    return client;
  }, [emitViewerCount, onRemoteOffline, playRemote, refreshToken, rejoinWithBackoff, role, syncRemoteUsers]);

  const start = useCallback(async () => {
    if (!sessionId || !enabled) return;
    if (startedRef.current || isStartingRef.current) return;
    isStartingRef.current = true;
    isLeavingRef.current = false;
    setStatusText('Đang kết nối...');

    try {
      const tokenData = initialRtcToken && role === 'host'
        ? initialRtcToken
        : await getRtcToken({ sessionId, role, inviteId: inviteId || undefined });
      tokenExpiresAtRef.current = tokenData.expiresAt;
      const client = setupClient();

      // Defensive: ensure client is in a clean state before re-joining.
      const state = (client as any).connectionState as string | undefined;
      if (state && state !== 'DISCONNECTED') {
        console.warn('[useLiveRtc] client already in state', state, '→ leaving before re-join');
        try { await client.leave(); } catch { /* noop */ }
      }

      await client.join(tokenData.appId, tokenData.channel, tokenData.token, tokenData.uid);
      emitViewerCount(client);

      if (role === 'host' || role === 'guest') {
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          { AEC: true, ANS: true, AGC: true } as any,
          {},
        );
        localAudioRef.current = audioTrack;
        localVideoRef.current = videoTrack;
        bindLocalVideoHealth();
        // Defer so React has time to commit container ref before Agora paints.
        setTimeout(() => playLocalVideo(), 0);
        await client.publish([audioTrack, videoTrack]);
        setStatusText('Đang phát trực tiếp');
      } else {
        setStatusText('Đang chờ host...');
        for (const user of client.remoteUsers) {
          if (user.hasVideo) await client.subscribe(user, 'video');
          if (user.hasAudio) await client.subscribe(user, 'audio');
          playRemote(user);
        }
      }

      setIsJoined(true);
      startedRef.current = true;
      rejoinAttemptsRef.current = 0;
      renewFailuresRef.current = 0;
    } catch (error) {
      setStatusText(mapRtcError(error));
      try { await leave(); } catch { /* noop */ }
      throw error;
    } finally {
      isStartingRef.current = false;
    }
  }, [bindLocalVideoHealth, emitViewerCount, enabled, initialRtcToken, inviteId, leave, playLocalVideo, playRemote, role, sessionId, setupClient]);

  const toggleMute = useCallback(async () => {
    if (!localAudioRef.current) return;
    const next = !isMuted;
    await localAudioRef.current.setEnabled(!next);
    setIsMuted(next);
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    if (!localVideoRef.current) return;
    const next = !isCameraOff;
    await localVideoRef.current.setEnabled(!next);
    setIsCameraOff(next);
    if (next) {
      setHasLocalVideoPreview(false);
      setLocalVideoWarning(null);
    } else {
      bindLocalVideoHealth();
      playLocalVideo();
    }
  }, [bindLocalVideoHealth, isCameraOff, playLocalVideo]);

  const setLocalAudioEnabled = useCallback(async (enabled: boolean) => {
    if (!localAudioRef.current) return;
    await localAudioRef.current.setEnabled(enabled);
    setIsMuted(!enabled);
  }, []);

  const toggleRemoteAudio = useCallback(() => {
    if (!remoteAudioRef.current) return;
    if (isMuted) {
      remoteAudioRef.current.play();
      setIsMuted(false);
    } else {
      remoteAudioRef.current.stop();
      setIsMuted(true);
    }
  }, [isMuted]);

  useEffect(() => {
    if (!tokenExpiresAtRef.current || !isJoined) return;
    const secondsLeft = secondsUntilExpiry(tokenExpiresAtRef.current);
    if (secondsLeft > 90) return;
    refreshToken().catch(() => {
      rejoinWithBackoff().catch(() => undefined);
    });
  }, [isJoined, refreshToken, rejoinWithBackoff]);

  useEffect(() => {
    if (localContainerVersion > 0 && localVideoRef.current && localContainerRef.current && !isCameraOff) {
      playLocalVideo();
    }
  }, [isCameraOff, isJoined, localContainerVersion, playLocalVideo]);

  useEffect(() => {
    if (clientRef.current) syncRemoteUsers(clientRef.current);
  }, [syncRemoteUsers]);

  useEffect(() => {
    return () => {
      leave().catch(() => undefined);
    };
  }, [leave]);

  const getLocalTracks = useCallback(() => ({
    audio: localAudioRef.current,
    video: localVideoRef.current,
  }), []);

  return {
    setLocalContainerRef,
    setRemoteContainerRef,
    remoteContainerRef,
    remoteUsers,
    isJoined,
    isMuted,
    isCameraOff,
    hasLocalVideoPreview,
    localVideoWarning,
    hasRemoteVideo,
    statusText,
    start,
    leave,
    toggleMute,
    toggleCamera,
    setLocalAudioEnabled,
    toggleRemoteAudio,
    getLocalTracks,
  };
}
