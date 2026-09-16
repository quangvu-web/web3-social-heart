import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Eye, Loader2, Mic, MicOff, Radio, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLiveSession } from '../useLiveSession';
import { useLiveRtc } from '../hooks/useLiveRtc';
import { useLiveReplay } from '../hooks/useLiveReplay';
import { incrementLiveViewerCount, decrementLiveViewerCount } from '../liveService';
import { LiveChatPanel } from '../components/LiveChatPanel';
import { FloatingReactions } from '../components/FloatingReactions';
import { RTMPPlayer } from '../components/RTMPPlayer';
import { supabase } from '@/integrations/supabase/client';
import {
  controlLiveGuest,
  respondLiveGuestInvite,
  sendLiveGuestHeartbeat,
  upsertViewerPresence,
  useIncomingLiveGuestInvite,
} from '../hooks/useLiveGuestInvite';

export default function LiveAudiencePage() {
  const navigate = useNavigate();
  const { liveSessionId } = useParams<{ liveSessionId: string }>();
  const { data: session, isLoading } = useLiveSession(liveSessionId);
  const [mobileTab, setMobileTab] = useState<'chat' | 'reactions'>('chat');
  const [userId, setUserId] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const isRtmp = session?.stream_provider === 'nginx_rtmp' || session?.stream_provider === 'cloudflare_stream' || session?.live_mode === 'rtmp' || session?.live_mode === 'rtmp_obs' || session?.source === 'rtmp';
  const rtmpHlsUrl = session?.hls_url || session?.hls_playback_url || session?.playback_url || (session?.stream_key ? `https://live.camly.co/hls/${session.stream_key}.m3u8` : null);
  const isEnded = !!session && !['live', 'waiting_for_obs', 'source_connected', 'ready_to_go_live'].includes(session.status);
  const { data: replay } = useLiveReplay(liveSessionId, isEnded);
  const replayUrl = replay?.status === 'ready'
    ? (replay.r2_video_url || replay.playback_mp4 || replay.playback_hls)
    : session?.status === 'ready'
      ? (session.replay_url || session.r2_video_url || session.playback_url)
      : null;
  const replayIsMp4 = !!replayUrl && /\.(mp4)(\?|$)/i.test(replayUrl);
  const isWatchingReplay = isEnded && !!replayUrl;
  const replayProcessing = isEnded && ['stopping', 'uploading', 'queued', 'processing', 'recording'].includes(String(replay?.status || session?.status || session?.recording_status || ''));

  const {
    remoteContainerRef,
    statusText,
    hasRemoteVideo,
    isMuted,
    start,
    leave,
    toggleRemoteAudio,
  } = useLiveRtc({
    sessionId: liveSessionId,
    role: 'audience',
    enabled: !!liveSessionId && session?.status === 'live' && !isRtmp,
  });
  const { invite, clear: clearInvite } = useIncomingLiveGuestInvite(userId);
  const guestRtc = useLiveRtc({
    sessionId: liveSessionId,
    role: 'guest',
    inviteId: invite?.id,
    enabled: !!liveSessionId && !!invite && session?.status === 'live' && !isRtmp,
  });
  const guestLeave = guestRtc.leave;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setUserId(authSession?.user?.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isRtmp) return;
    if (isGuestMode) return;
    if (!liveSessionId || !session || session.status !== 'live') return;
    start().catch(() => undefined);
  }, [isGuestMode, isRtmp, liveSessionId, session, start]);

  useEffect(() => {
    if (!liveSessionId || !userId || session?.status !== 'live' || isRtmp) return;
    const deviceType = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    upsertViewerPresence({ liveSessionId, userId, deviceType }).catch(() => undefined);
    const timer = window.setInterval(() => {
      upsertViewerPresence({ liveSessionId, userId, deviceType }).catch(() => undefined);
    }, 10_000);
    const markLeft = () => upsertViewerPresence({ liveSessionId, userId, clientState: 'left', deviceType }).catch(() => undefined);
    window.addEventListener('pagehide', markLeft);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', markLeft);
      markLeft();
    };
  }, [isRtmp, liveSessionId, session?.status, userId]);

  useEffect(() => {
    if (!isGuestMode || !invite || !guestRtc.isJoined) return;
    sendLiveGuestHeartbeat(invite.id, 'live').then((result) => {
      if (typeof result.muted_by_host === 'boolean') {
        guestRtc.setLocalAudioEnabled(!result.muted_by_host).catch(() => undefined);
      }
    }).catch(() => undefined);
    const timer = window.setInterval(() => {
      sendLiveGuestHeartbeat(invite.id, navigator.onLine === false ? 'reconnecting' : 'live')
        .then((result) => {
          if (typeof result.muted_by_host === 'boolean') {
            guestRtc.setLocalAudioEnabled(!result.muted_by_host).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [guestRtc, invite, isGuestMode]);

  useEffect(() => {
    if (!isGuestMode) return;
    const inactive = !invite || ['declined', 'removed', 'left', 'expired'].includes(invite.status);
    if (!inactive) return;
    guestRtc.leave().catch(() => undefined);
    setIsGuestMode(false);
    clearInvite();
    if (!isRtmp && liveSessionId && session?.status === 'live') {
      start().catch(() => undefined);
    }
  }, [clearInvite, guestRtc, invite, isGuestMode, isRtmp, liveSessionId, session?.status, start]);

  const handleAcceptInvite = async () => {
    if (!invite) return;
    await respondLiveGuestInvite(invite.id, 'accept');
    await leave();
    setIsGuestMode(true);
    await guestRtc.start();
    await sendLiveGuestHeartbeat(invite.id, 'live');
  };

  const handleDeclineInvite = async () => {
    if (!invite) return;
    await respondLiveGuestInvite(invite.id, 'decline');
    clearInvite();
  };

  const handleLeaveGuest = async () => {
    if (!invite) return;
    await sendLiveGuestHeartbeat(invite.id, 'closing').catch(() => undefined);
    await controlLiveGuest(invite.id, 'leave').catch(() => undefined);
    await guestRtc.leave();
    setIsGuestMode(false);
    clearInvite();
    start().catch(() => undefined);
  };

  // Track viewer count via database
  useEffect(() => {
    if (!liveSessionId || session?.status !== 'live') return;

    incrementLiveViewerCount(liveSessionId).catch(console.warn);

    const handleBeforeUnload = () => {
      decrementLiveViewerCount(liveSessionId).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      decrementLiveViewerCount(liveSessionId).catch(() => {});
    };
  }, [liveSessionId, session?.status]);

  useEffect(() => {
    if (isEnded) {
      leave().catch(() => undefined);
      guestLeave().catch(() => undefined);
      setIsGuestMode(false);
    }
  }, [guestLeave, isEnded, leave]);

  useEffect(() => {
    return () => {
      leave().catch(() => undefined);
      guestLeave().catch(() => undefined);
    };
  }, [guestLeave, leave]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">Live session not found.</Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      <main className="pt-16 px-3 md:px-6 pb-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={session.host_profile?.avatar_url || ''} />
                  <AvatarFallback>
                    {session.host_profile?.username?.charAt(0)?.toUpperCase() || 'H'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-sm">{session.host_profile?.full_name || session.host_profile?.username || 'Host'}</div>
                  <h1 className="text-lg md:text-xl font-bold">{session.title || 'Live Stream'}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={session.status === 'live' ? 'destructive' : 'secondary'} className="gap-1">
                  <Radio className="h-3.5 w-3.5" />
                  {session.status === 'live' ? 'LIVE' : isWatchingReplay ? 'REPLAY' : 'ENDED'}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {session.viewer_count || 0}
                </Badge>
                {isEnded && replay?.playback_mp4 && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    <a
                      href={replay.playback_mp4}
                      download={`live-${liveSessionId}.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4" />
                      Tải MP4
                    </a>
                  </Button>
                )}
                {isEnded && !replay?.playback_mp4 && isWatchingReplay && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="gap-1.5"
                    title="Cloudflare đang tạo file MP4, vui lòng quay lại sau vài phút"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tạo MP4...
                  </Button>
                )}
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="aspect-video bg-black relative">
                {isGuestMode ? (
                  <div className="h-full w-full grid grid-cols-1 md:grid-cols-2">
                    <div className="relative bg-black">
                      <div ref={guestRtc.remoteContainerRef} className="h-full w-full" />
                      {!guestRtc.hasRemoteVideo && (
                        <div className="absolute inset-0 flex items-center justify-center text-white/80 bg-black/60">
                          Đang chờ host...
                        </div>
                      )}
                      <Badge className="absolute left-2 top-2" variant="secondary">Host</Badge>
                    </div>
                    <div className="relative bg-black">
                      <div ref={guestRtc.setLocalContainerRef} className="h-full w-full" />
                      <Badge className="absolute left-2 top-2" variant="secondary">Bạn</Badge>
                    </div>
                  </div>
                ) : isEnded ? (
                  replayUrl ? (
                    replayIsMp4 ? (
                      <video
                        src={replayUrl}
                        className="h-full w-full object-contain bg-black"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <RTMPPlayer src={replayUrl} waitingLabel="" />
                    )
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 bg-black/70 gap-2 text-center px-4">
                      {replay?.status === 'failed' || session.recording_status === 'failed' ? (
                        <span>Không thể xử lý video. Live đã kết thúc.</span>
                      ) : replayProcessing ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span>Video replay đang được xử lý, vui lòng quay lại sau.</span>
                        </>
                      ) : (
                        <span>This live has ended.</span>
                      )}
                    </div>
                  )
                ) : isRtmp ? (
                  <RTMPPlayer
                    src={session.rtmp_status === 'live' || session.status === 'live' ? rtmpHlsUrl : null}
                    waitingLabel={session.status === 'waiting_for_obs' ? 'Dang cho OBS ket noi...' : 'Waiting for RTMP stream...'}
                  />
                ) : (
                  <>
                    <div ref={remoteContainerRef} className="h-full w-full" />
                    {!hasRemoteVideo && (
                      <div className="absolute inset-0 flex items-center justify-center text-white/90 bg-black/50 text-center px-4">
                        {statusText}
                      </div>
                    )}
                  </>
                )}

                {!isRtmp && !isEnded && !isGuestMode && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute bottom-3 left-3 z-10 bg-black/30 hover:bg-black/50 text-white rounded-full h-10 w-10"
                    onClick={toggleRemoteAudio}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                )}

                {isGuestMode && (
                  <div className="absolute bottom-3 left-3 z-10 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={guestRtc.toggleMute}>
                      {guestRtc.isMuted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                      {guestRtc.isMuted ? 'Bật mic' : 'Tắt mic'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={guestRtc.toggleCamera}>
                      {guestRtc.isCameraOff ? <VideoOff className="h-4 w-4 mr-2" /> : <Video className="h-4 w-4 mr-2" />}
                      {guestRtc.isCameraOff ? 'Bật camera' : 'Tắt camera'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleLeaveGuest}>
                      Rời trò chuyện
                    </Button>
                  </div>
                )}

                {liveSessionId && <FloatingReactions sessionId={liveSessionId} />}
              </div>
            </Card>

            {invite && invite.status === 'invited' && !isGuestMode && session.status === 'live' && (
              <Card className="p-4 border-primary/30 space-y-3">
                <div className="font-semibold">
                  {invite.host_profile?.full_name || invite.host_profile?.username || 'Host'} mời bạn tham gia livestream
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAcceptInvite}>Tham gia</Button>
                  <Button variant="outline" onClick={handleDeclineInvite}>Từ chối</Button>
                </div>
              </Card>
            )}

            <div className="lg:hidden border rounded-xl bg-card overflow-hidden">
              <div className="grid grid-cols-2 border-b">
                <button
                  className={`py-2 text-sm font-medium ${mobileTab === 'chat' ? 'bg-accent' : ''}`}
                  onClick={() => setMobileTab('chat')}
                >
                  Chat
                </button>
                <button
                  className={`py-2 text-sm font-medium ${mobileTab === 'reactions' ? 'bg-accent' : ''}`}
                  onClick={() => setMobileTab('reactions')}
                >
                  Reactions
                </button>
              </div>
              <div className="p-2">
                {mobileTab === 'chat' && liveSessionId && <LiveChatPanel sessionId={liveSessionId} className="h-[320px]" />}
                {mobileTab === 'reactions' && liveSessionId && (
                  <div className="h-[120px] flex items-center justify-center relative">
                    <FloatingReactions sessionId={liveSessionId} showPicker />
                  </div>
                )}
              </div>
            </div>
          </section>

          {liveSessionId && <LiveChatPanel sessionId={liveSessionId} className="hidden lg:flex h-[calc(100vh-120px)]" />}
        </div>
        <div className="max-w-7xl mx-auto mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            Back
          </Button>
        </div>
      </main>
    </div>
  );
}
