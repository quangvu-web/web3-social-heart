import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clipboard,
  Eye,
  FileText,
  Home,
  KeyRound,
  Loader2,
  MonitorUp,
  PhoneOff,
  Play,
  Radio,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LiveChatPanel } from '../components/LiveChatPanel';
import { RTMPPlayer } from '../components/RTMPPlayer';
import {
  createRtmpLiveSession,
  endRtmpLiveSession,
  getRtmpLiveSession,
  getRtmpLiveStatus,
  getRtmpStreamKeyForCopy,
  goLiveRtmpSession,
  heartbeatRtmpProducer,
  regenerateRtmpStreamKey,
  saveRtmpLiveDetails,
  type RtmpLiveStatus,
  type RtmpProducerStatus,
} from '../rtmpService';

type LoadState = 'loading' | 'ready' | 'error';

type LivePayload = {
  live_session_id: string;
  stream_key?: string | null;
  rtmp_url?: string | null;
  rtmps_url?: string | null;
  hls_url?: string | null;
  playback_url?: string | null;
  status?: RtmpLiveStatus['status'];
  app_status?: RtmpProducerStatus;
  title?: string | null;
  description?: string | null;
  source_connected_at?: string | null;
  go_live_clicked_at?: string | null;
  live_post_id?: string | null;
  recording_status?: string | null;
  archive_status?: string | null;
  rtmp_started_at?: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function CopyButton({ value, label, onCopyValue }: { value?: string | null; label: string; onCopyValue?: () => Promise<string> }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  const copy = async () => {
    try {
      setCopying(true);
      const nextValue = onCopyValue ? await onCopyValue() : value;
      if (!nextValue) return;
      await navigator.clipboard.writeText(nextValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the sao chep.'));
    } finally {
      setCopying(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} disabled={copying || (!value && !onCopyValue)} className="shrink-0">
      {copying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : copied ? <Check className="h-4 w-4 mr-2" /> : <Clipboard className="h-4 w-4 mr-2" />}
      {copying ? 'Dang sao chep' : copied ? 'Da sao chep' : label}
    </Button>
  );
}

function statusLabel(status: RtmpProducerStatus, rtmpStatus: RtmpLiveStatus['status'], archiveStatus?: string | null) {
  if (status === 'live') return 'DANG PHAT TRUC TIEP';
  if (status === 'ready_to_go_live') return 'SAN SANG PHAT';
  if (status === 'source_connected' || rtmpStatus === 'live') return 'DA KET NOI OBS';
  if (status === 'posted' || archiveStatus === 'archived') return 'REPLAY DA DANG';
  if (status === 'ended' || status === 'processing' || status === 'archiving') return 'DANG XU LY REPLAY';
  if (status === 'failed') return 'LOI';
  return 'CHO OBS KET NOI';
}

function StepItem({
  number,
  title,
  description,
  state,
}: {
  number: number;
  title: string;
  description: string;
  state: 'pending' | 'completed' | 'warning';
}) {
  const completed = state === 'completed';
  const warning = state === 'warning';
  return (
    <div className={`rounded-md border p-3 ${completed ? 'border-emerald-500/40 bg-emerald-500/5' : warning ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card'}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${completed ? 'bg-emerald-600 text-white' : warning ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
          {completed ? <Check className="h-4 w-4" /> : number}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground leading-5">{description}</div>
        </div>
      </div>
    </div>
  );
}

export default function RtmpHostPage() {
  const navigate = useNavigate();
  const { liveSessionId } = useParams<{ liveSessionId: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(liveSessionId || null);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [rtmpsUrl, setRtmpsUrl] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [rtmpStatus, setRtmpStatus] = useState<RtmpLiveStatus['status']>('waiting');
  const [appStatus, setAppStatus] = useState<RtmpProducerStatus>('waiting_for_obs');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lastSavedTitle, setLastSavedTitle] = useState('');
  const [lastSavedDescription, setLastSavedDescription] = useState('');
  const [sourceConnectedAt, setSourceConnectedAt] = useState<string | null>(null);
  const [livePostId, setLivePostId] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<string | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null);
  const [rtmpStartedAt, setRtmpStartedAt] = useState<string | null>(null);
  const [elapsedLabel, setElapsedLabel] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const sourceConnected = appStatus === 'source_connected' || appStatus === 'ready_to_go_live' || appStatus === 'live' || rtmpStatus === 'live';
  const titleValid = title.trim().length > 0;
  const descriptionValid = description.trim().length > 0;
  const detailsValid = titleValid && descriptionValid;
  const detailsDirty = title.trim() !== lastSavedTitle || description.trim() !== lastSavedDescription;
  const isPublicLive = appStatus === 'live';
  const isEnded = ['ended', 'processing', 'archiving', 'posted', 'failed'].includes(appStatus);
  const canGoLive = sourceConnected && detailsValid && !!hlsUrl && !isPublicLive && !isEnded;

  const applyLivePayload = useCallback((live: LivePayload) => {
    setSessionId(live.live_session_id);
    if (live.stream_key) setStreamKey(live.stream_key);
    setRtmpsUrl(live.rtmps_url || live.rtmp_url || null);
    setHlsUrl(live.hls_url || live.playback_url || null);
    setRtmpStatus(live.status || 'waiting');
    setAppStatus(live.app_status || (live.status === 'ended' ? 'ended' : live.status === 'live' ? 'live' : 'waiting_for_obs'));
    if (typeof live.title === 'string') {
      setTitle(live.title);
      setLastSavedTitle(live.title.trim());
    }
    if (typeof live.description === 'string') {
      setDescription(live.description);
      setLastSavedDescription(live.description.trim());
    }
    setSourceConnectedAt(live.source_connected_at || null);
    setLivePostId(live.live_post_id || null);
    setRecordingStatus(live.recording_status || null);
    setArchiveStatus(live.archive_status || null);
    setRtmpStartedAt(live.rtmp_started_at || null);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!sessionId) return;
    const next = await getRtmpLiveStatus(sessionId);
    setRtmpStatus(next.status);
    setAppStatus(next.app_status || (next.status === 'ended' ? 'ended' : next.status === 'live' ? 'live' : 'waiting_for_obs'));
    if (next.hls_url) setHlsUrl(next.hls_url);
    if (typeof next.title === 'string' && !detailsDirty) setTitle(next.title);
    if (typeof next.description === 'string' && !detailsDirty) setDescription(next.description);
    setSourceConnectedAt(next.source_connected_at || null);
    setLivePostId(next.live_post_id || null);
    setRecordingStatus(next.recording_status || null);
    setArchiveStatus(next.archive_status || null);
    if ((next.app_status === 'posted' || next.app_status === 'ended') && next.archive_status === 'archived') stopPolling();
  }, [detailsDirty, sessionId, stopPolling]);

  useEffect(() => {
    let active = true;

    async function boot() {
      setLoadState('loading');
      setError(null);
      try {
        const live = liveSessionId ? await getRtmpLiveSession(liveSessionId) : await createRtmpLiveSession();
        if (!active) return;
        applyLivePayload(live);
        setLoadState('ready');
        if (live.live_session_id !== liveSessionId) {
          navigate(`/live/${live.live_session_id}/rtmp/host`, { replace: true });
        }
        getRtmpLiveStatus(live.live_session_id).then((next) => {
          if (!active) return;
          applyLivePayload(next as LivePayload);
        }).catch(() => undefined);
      } catch (err: unknown) {
        if (!active) return;
        setLoadState('error');
        setError(getErrorMessage(err, 'Khong the tao OBS live session.'));
      }
    }

    boot();
    return () => {
      active = false;
      stopPolling();
    };
  }, [applyLivePayload, liveSessionId, navigate, stopPolling]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`obs-live-producer-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as {
            status?: RtmpProducerStatus;
            rtmp_status?: RtmpLiveStatus['status'];
            hls_url?: string | null;
            playback_url?: string | null;
            title?: string | null;
            description?: string | null;
            source_connected_at?: string | null;
            live_post_id?: string | null;
            post_id?: string | null;
            recording_status?: string | null;
            archive_status?: string | null;
            rtmp_started_at?: string | null;
          };
          setAppStatus(row.status || 'waiting_for_obs');
          setRtmpStatus(row.rtmp_status || 'waiting');
          if (row.hls_url || row.playback_url) setHlsUrl(row.hls_url || row.playback_url || null);
          if (typeof row.title === 'string' && !detailsDirty) setTitle(row.title);
          if (typeof row.description === 'string' && !detailsDirty) setDescription(row.description);
          setSourceConnectedAt(row.source_connected_at || null);
          setLivePostId(row.live_post_id || row.post_id || null);
          setRecordingStatus(row.recording_status || null);
          setArchiveStatus(row.archive_status || null);
          if (row.rtmp_started_at) setRtmpStartedAt(row.rtmp_started_at);
        },
      )
      .subscribe();

    stopPolling();
    // Realtime subscription ở trên là nguồn cập nhật chính.
    // Polling chỉ là fallback → 20s là đủ, giảm 85% tải DB. Bỏ qua khi tab ẩn.
    pollTimerRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshStatus().catch(() => undefined);
    }, 20000);

    return () => {
      supabase.removeChannel(channel);
      stopPolling();
    };
  }, [detailsDirty, refreshStatus, sessionId, stopPolling]);

  useEffect(() => {
    if (!sessionId) return;
    const beat = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      heartbeatRtmpProducer(sessionId)
        .then((next) => applyLivePayload(next as LivePayload))
        .catch(() => undefined);
    };

    beat();
    stopHeartbeat();
    // Heartbeat 30s (trước là 15s) — giảm tải live_sessions UPDATE, bỏ qua khi tab ẩn.
    heartbeatTimerRef.current = setInterval(beat, 30000);

    return () => {
      stopHeartbeat();
    };
  }, [applyLivePayload, sessionId, stopHeartbeat]);

  useEffect(() => {
    if (!sourceConnected || !rtmpStartedAt) {
      setElapsedLabel('');
      return;
    }
    const compute = () => {
      const startedMs = Date.parse(rtmpStartedAt);
      if (!Number.isFinite(startedMs)) return '';
      const diff = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      const pad = (n: number) => n.toString().padStart(2, '0');
      return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    };
    setElapsedLabel(compute());
    const id = setInterval(() => setElapsedLabel(compute()), 1000);
    return () => clearInterval(id);
  }, [rtmpStartedAt, sourceConnected]);

  const validationText = useMemo(() => {
    if (!sourceConnected) return 'OBS chua ket noi toi Cloudflare.';
    if (!titleValid) return 'Vui long nhap tieu de.';
    if (!descriptionValid) return 'Vui long nhap mo ta.';
    if (!hlsUrl) return 'Dang cho Cloudflare tao playback URL.';
    return '';
  }, [descriptionValid, hlsUrl, sourceConnected, titleValid]);

  const saveDetails = async () => {
    if (!sessionId) return null;
    if (!titleValid) {
      toast.error('Tieu de la bat buoc.');
      return null;
    }
    if (!descriptionValid) {
      toast.error('Mo ta la bat buoc.');
      return null;
    }
    setSavingDetails(true);
    try {
      const updated = await saveRtmpLiveDetails(sessionId, {
        title: title.trim(),
        description: description.trim(),
      });
      applyLivePayload(updated);
      toast.success('Da luu chi tiet bai viet.');
      return updated;
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the luu chi tiet bai viet.'));
      return null;
    } finally {
      setSavingDetails(false);
    }
  };

  const goLive = async () => {
    if (!sessionId) return;
    if (!canGoLive) {
      toast.error(validationText || 'Chua du dieu kien phat truc tiep.');
      return;
    }
    setGoingLive(true);
    try {
      if (detailsDirty) {
        const saved = await saveDetails();
        if (!saved) return;
      }
      const live = await goLiveRtmpSession(sessionId);
      applyLivePayload(live);
      toast.success('Da phat truc tiep. Bai LIVE da xuat hien tren feed.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the phat truc tiep.'));
    } finally {
      setGoingLive(false);
    }
  };

  const resetKey = async () => {
    if (!sessionId) return;
    try {
      const next = await regenerateRtmpStreamKey(sessionId);
      applyLivePayload(next);
      toast.success('Da tao Stream Key moi.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the dat lai Stream Key.'));
    }
  };

  const endLive = async () => {
    if (!sessionId) return;
    try {
      await endRtmpLiveSession(sessionId);
      setAppStatus('ended');
      setRtmpStatus('ended');
      toast.success('Da ket thuc livestream. Replay se duoc xu ly va luu sang R2.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the ket thuc livestream.'));
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Dang chuan bi Live Producer...</span>
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-background">
        <FacebookNavbar />
        <div className="pt-20 px-4 max-w-xl mx-auto">
          <Card className="p-6 space-y-4">
            <div className="font-semibold text-lg">Khong the mo Live Producer</div>
            <div className="text-sm text-muted-foreground">{error}</div>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              Ve trang chu
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const label = statusLabel(appStatus, rtmpStatus, archiveStatus);

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      <main className="pt-16 pb-4">
        <div className="border-b bg-card/70 px-3 md:px-6 py-3">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold truncate">Live Producer</h1>
                <p className="text-xs text-muted-foreground truncate">Phan mem phat truc tiep / RTMP / OBS</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isPublicLive ? 'destructive' : sourceConnected ? 'default' : 'outline'} className="gap-1">
                <Radio className={`h-3.5 w-3.5 ${isPublicLive ? 'animate-pulse' : ''}`} />
                {label}
              </Badge>
              {sourceConnected && elapsedLabel && (
                <span className="hidden sm:inline text-xs font-mono text-muted-foreground">{elapsedLabel}</span>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_390px] gap-4 px-3 md:px-6 pt-4">
          <aside className="space-y-3">
            <Card className="p-3 space-y-3">
              <div className="text-sm font-semibold">Tien trinh</div>
              <StepItem
                number={1}
                title="Ket noi nguon video"
                description={sourceConnected
                  ? 'Cloudflare da nhan tin hieu tu OBS.'
                  : 'Sao chep RTMPS URL va Stream Key vao OBS. (Ingest chi mo khi trang nay dang mo — dong tab se tat OBS de tranh ton tai nguyen.)'}
                state={sourceConnected ? 'completed' : 'pending'}
              />
              <StepItem
                number={2}
                title="Hoan tat chi tiet bai viet"
                description={detailsValid ? 'Tieu de va mo ta da san sang.' : 'Tieu de va mo ta la bat buoc.'}
                state={detailsValid ? 'completed' : 'warning'}
              />
              <StepItem
                number={3}
                title="Phat truc tiep"
                description={isPublicLive ? 'Live post dang hien tren feed.' : canGoLive ? 'Da du dieu kien de phat truc tiep.' : 'Chi mo khi OBS, chi tiet va playback da san sang.'}
                state={isPublicLive || canGoLive ? 'completed' : 'pending'}
              />
            </Card>

            <Card className="p-3 space-y-2 text-xs text-muted-foreground leading-5">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Luu y
              </div>
              <p>OBS co the dang gui tin hieu nhung viewer se chua thay live cho den khi bam Phat truc tiep.</p>
              <p>Control panel nay co the dong/refresh. OBS moi la nguon video chinh.</p>
            </Card>
          </aside>

          <section className="space-y-4">
            <Card className="overflow-hidden">
              <div className="aspect-video bg-black">
                <RTMPPlayer
                  src={sourceConnected ? hlsUrl : null}
                  waitingLabel={
                    sourceConnected
                      ? 'Dang tai preview tu Cloudflare...'
                      : 'Ket noi phan mem phat truc tiep de xem preview.'
                  }
                />
              </div>
            </Card>

            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Nguon video</div>
                  <div className="font-medium flex items-center gap-1.5">
                    {sourceConnected ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <MonitorUp className="h-4 w-4" />}
                    {sourceConnected ? 'Da ket noi' : 'Dang cho'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Trang thai public</div>
                  <div className="font-medium">{isPublicLive ? 'Dang live' : isEnded ? 'Da ket thuc' : 'Chua public'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Recording</div>
                  <div className="font-medium">{recordingStatus || 'idle'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Archive</div>
                  <div className="font-medium">{archiveStatus || 'pending'}</div>
                </div>
              </div>
            </Card>

            {isPublicLive && sessionId && (
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Live post da xuat hien tren feed</div>
                    <div className="text-sm text-muted-foreground">Viewer co the xem live tren feed/profile hoac trang live.</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate(`/live/${sessionId}`)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Xem nhu viewer
                    </Button>
                    <Button variant="destructive" onClick={endLive}>
                      <PhoneOff className="h-4 w-4 mr-2" />
                      Ket thuc live
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </section>

          <aside className="space-y-4">
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Nguon video
                </div>
                <Badge variant="outline">RTMP/OBS</Badge>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="text-sm font-medium">URL may chu / RTMPS URL</div>
                  <div className="flex gap-2">
                    <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-xs break-all">{rtmpsUrl || 'Dang tao RTMPS URL...'}</code>
                    <CopyButton value={rtmpsUrl} label="URL" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-sm font-medium">Stream Key</div>
                  <div className="flex gap-2">
                    <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-xs break-all">{streamKey || '****************'}</code>
                    {sessionId && <CopyButton label="Key" onCopyValue={() => getRtmpStreamKeyForCopy(sessionId)} />}
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground leading-5">
                <div>OBS {'->'} Settings {'->'} Stream</div>
                <div>Service = Custom</div>
                <div>Server = RTMPS URL</div>
                <div>Stream Key = Stream Key</div>
                <div>Start Streaming trong OBS, sau do quay lai day de Phat truc tiep.</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => refreshStatus().catch((err) => toast.error(getErrorMessage(err, 'Khong the refresh.')))}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Lam moi
                </Button>
                <Button variant="outline" size="sm" onClick={resetKey} disabled={!sessionId || sourceConnected || isPublicLive || isEnded}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Dat lai Stream Key
                </Button>
              </div>

              {sourceConnectedAt && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400">
                  OBS da ket noi luc {new Date(sourceConnectedAt).toLocaleString()}.
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-4">
              <div className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Chi tiet bai viet
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="live-title">Tieu de</label>
                <Input
                  id="live-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() => {
                    if (detailsValid && detailsDirty) saveDetails().catch(() => undefined);
                  }}
                  placeholder="Nhap tieu de livestream"
                  disabled={isPublicLive || isEnded}
                />
                {!titleValid && <div className="text-xs text-destructive">Tieu de la bat buoc.</div>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="live-description">Mo ta</label>
                <Textarea
                  id="live-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  onBlur={() => {
                    if (detailsValid && detailsDirty) saveDetails().catch(() => undefined);
                  }}
                  placeholder="Mo ta noi dung buoi live"
                  className="min-h-[110px]"
                  disabled={isPublicLive || isEnded}
                />
                {!descriptionValid && <div className="text-xs text-destructive">Mo ta la bat buoc.</div>}
              </div>

              <Button variant="outline" onClick={saveDetails} disabled={!detailsValid || savingDetails || isPublicLive || isEnded || !detailsDirty}>
                {savingDetails ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Luu chi tiet
              </Button>
            </Card>

            <Card className="p-4 space-y-3">
              <Button className="w-full" size="lg" onClick={goLive} disabled={!canGoLive || goingLive}>
                {goingLive ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Phat truc tiep
              </Button>
              {!canGoLive && !isPublicLive && (
                <div className="text-xs text-muted-foreground leading-5">{validationText}</div>
              )}
              {isPublicLive && livePostId && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400">Live post ID: {livePostId}</div>
              )}
              {isEnded && sessionId && (
                <Button variant="outline" className="w-full" onClick={() => navigate(`/live/${sessionId}`)}>
                  Xem replay/status
                </Button>
              )}
            </Card>

            {sessionId && isPublicLive && <LiveChatPanel sessionId={sessionId} className="h-[360px]" />}
          </aside>
        </div>
      </main>
    </div>
  );
}
