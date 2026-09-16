import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Eye, Video, CameraOff, Radio, Download, Loader2, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StreamPlayer } from '@/components/ui/StreamPlayer';
import { ReplayPlayer } from '@/modules/live/components/ReplayPlayer';
import { LiveChatReplay } from '@/modules/live/components/LiveChatReplay';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LivePostCardProps {
  liveMetadata: Record<string, unknown>;
  videoUrl?: string | null;
  liveStatus: 'live' | 'ended';
  liveSessionId: string | null;
  postContent: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function LivePostCard({ liveMetadata, videoUrl, liveStatus, liveSessionId, postContent }: LivePostCardProps) {
  const navigate = useNavigate();
  const [playerOpen, setPlayerOpen] = useState(false);
  const finalizeTriggered = useRef(false);

  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  const title: string = str(liveMetadata.live_title) || postContent || 'Phát trực tiếp trên FUN Profile';
  const viewerCount = Number(liveMetadata.viewer_count || 0);
  const thumbnailUrl: string | null = str(liveMetadata.thumbnail_url);
  const durationSeconds = liveMetadata.duration_seconds ? Number(liveMetadata.duration_seconds) : null;
  const endedAt: string | null = str(liveMetadata.ended_at);
  const replayStatus: string | null = str(liveMetadata.replay_status) || str(liveMetadata.recording_status);
  const archiveStatus: string | null = str(liveMetadata.archive_status);
  const playbackProvider: string | null = str(liveMetadata.playback_provider);
  const playbackType: string = playbackProvider || str(liveMetadata.playback_type) || (liveMetadata.playback_hls ? 'cloudflare_stream' : 'chunked');

  // Production replay is archived to R2. HLS (.m3u8) or MP4 depending on source.
  const r2VideoUrl: string | null = str(liveMetadata.r2_video_url);
  const isMp4Url = (u: string | null) => !!u && /\.mp4(\?|$)/i.test(u);

  // download_mp4_parts: array of { url, index, size?, key? } produced by process-live-recordings or backfill.
  const mp4Parts = useMemo<Array<{ url: string; index: number; size?: number }>>(() => {
    const raw = (liveMetadata as Record<string, unknown>).download_mp4_parts;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((p: any, i: number) => ({
        url: typeof p?.url === 'string' ? p.url : '',
        index: typeof p?.index === 'number' ? p.index : i,
        size: typeof p?.size === 'number' ? p.size : undefined,
      }))
      .filter((p) => p.url);
  }, [liveMetadata]);

  const rawMp4: string | null = str(liveMetadata.playback_mp4) || r2VideoUrl;
  const legacyMp4: string | null = isMp4Url(rawMp4) ? rawMp4 : null;
  // Effective single MP4 used for the inline download button (when there's exactly one part)
  const playbackMp4: string | null = mp4Parts.length === 1 ? mp4Parts[0].url : legacyMp4;
  const playbackUrl: string | null = playbackProvider === 'r2'
    ? (r2VideoUrl || str(liveMetadata.playback_hls) || str(liveMetadata.playback_url) || videoUrl || null)
    : (str(liveMetadata.playback_hls) || str(liveMetadata.playback_url) || videoUrl || null);
  const hasVideo = !!playbackUrl;
  const archivePending =
    liveStatus === 'ended' &&
    playbackProvider !== 'r2' &&
    ['pending', 'mp4_pending', 'archiving', 'failed'].includes(String(archiveStatus || replayStatus || ''));
  // MP4 chưa có nhưng replay đã ready → đang được Cloudflare render
  const mp4Pending = !playbackMp4 && mp4Parts.length === 0 && hasVideo && playbackType === 'cloudflare_stream' && liveStatus === 'ended';

  const formatBytes = (n?: number) => {
    if (!n || !Number.isFinite(n)) return '';
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const MultiPartDownload = ({ size = 'sm' as const }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant="outline" onClick={(e) => e.stopPropagation()}>
          <Download className="w-3.5 h-3.5 mr-1" />
          Tải MP4 ({mp4Parts.length} phần)
          <ChevronDown className="w-3.5 h-3.5 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {mp4Parts.map((p) => (
          <DropdownMenuItem key={p.index} asChild>
            <a
              href={p.url}
              download={`live-${liveSessionId || 'replay'}-part-${p.index + 1}.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Phần {p.index + 1}{p.size ? ` · ${formatBytes(p.size)}` : ''}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // When replay is ready (HLS available) but MP4 not yet rendered by Cloudflare,
  // ask the backend to start/poll the MP4 render. Page reload (or feed refresh)
  // will then pick up the playback_mp4 URL from posts.metadata.
  useEffect(() => {
    if (finalizeTriggered.current) return;
    if (liveStatus !== 'ended') return;
    if (!liveSessionId) return;
    if (playbackProvider === 'r2') return;
    if (!archivePending && !mp4Pending) return;

    finalizeTriggered.current = true;

    void (async () => {
      const { error } = await supabase.functions.invoke('archive-replay-to-r2', {
        body: { live_session_id: liveSessionId },
      });

      if (!error) return;

      const message = error.message || '';
      if (message.includes('404') || message.includes('Replay not found')) {
        console.info('[LivePostCard] archive skipped because replay no longer exists', {
          liveSessionId,
        });
        return;
      }

      console.warn('[LivePostCard] archive trigger failed', error);
    })();
  }, [archivePending, liveStatus, liveSessionId, mp4Pending, playbackProvider]);


  // Currently LIVE
  if (liveStatus === 'live') {
    const handleGoLive = () => {
      if (liveSessionId) navigate(`/live/${liveSessionId}`);
    };

    return (
      <div className="mb-3 overflow-hidden">
        {/* Preview area */}
        <button
          onClick={handleGoLive}
          className="relative w-full block group focus:outline-none"
          aria-label="Xem trực tiếp"
        >
          <div className="w-full aspect-video relative overflow-hidden bg-black">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-gray-900 to-red-900">
                <div
                  className="absolute inset-0 opacity-40 animate-pulse"
                  style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, hsl(0 80% 40% / 0.7) 0%, transparent 60%), radial-gradient(circle at 70% 70%, hsl(0 60% 25% / 0.6) 0%, transparent 55%)' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-red-600/40 border-2 border-red-500/50 flex items-center justify-center backdrop-blur-sm animate-pulse">
                    <Radio className="w-8 h-8 text-red-300" />
                  </div>
                  <div className="text-center px-8">
                    <p className="text-white font-semibold text-sm line-clamp-2 drop-shadow">{title}</p>
                    <p className="text-white/50 text-xs mt-1">Đang phát trực tiếp</p>
                  </div>
                </div>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* ĐANG LIVE badge - top left */}
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                ĐANG LIVE
              </span>
            </div>

            {/* Viewer count - top right */}
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded">
                <Eye className="w-3 h-3" />
                {viewerCount}
              </span>
            </div>

            {/* Big play button - center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
              </div>
            </div>
          </div>
        </button>

        {/* Info bar below */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-border bg-card">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title}</p>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Eye className="w-3 h-3" />
              <span>{viewerCount} người đang xem</span>
            </div>
          </div>
          {liveSessionId && (
            <Button size="sm" variant="destructive" className="ml-3 shrink-0" onClick={handleGoLive}>
              <Radio className="w-3.5 h-3.5 mr-1" />
              Xem LIVE
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (
    liveStatus === 'ended' &&
    (archivePending || (!hasVideo && ['uploading', 'queued', 'processing'].includes(String(replayStatus))))
  ) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-5 flex items-center gap-3 text-muted-foreground">
          <Radio className="w-8 h-8 shrink-0 opacity-60 animate-pulse" />
          <div>
            <p className="text-sm font-medium text-foreground">Replay is processing</p>
            <p className="text-xs mt-0.5">Video dang duoc tao MP4 va luu tru len R2.</p>
          </div>
          <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 bg-red-600/90 text-white text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md shadow ring-1 ring-red-500/40">
            <Video className="w-3 h-3" fill="currentColor" />
            {archiveStatus === 'failed' ? 'RETRYING' : 'REPLAY · PROCESSING'}
          </span>
        </div>
      </div>
    );
  }

  // ENDED - No video available
  if (!hasVideo) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-5 flex items-center gap-3 text-muted-foreground">
          <CameraOff className="w-8 h-8 shrink-0 opacity-50" />
          <div>
            <p className="text-sm font-medium text-foreground">Phiên live đã kết thúc</p>
            <p className="text-xs mt-0.5">Video replay chưa được lưu cho phiên này</p>
          </div>
          {liveSessionId && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto shrink-0"
              onClick={() => navigate(`/live/${liveSessionId}`)}
            >
              Xem thông tin
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ENDED - Has video replay
  return (
    <>
      <div className="mb-3 overflow-hidden">
        {/* Thumbnail / Preview area */}
        <button
          onClick={() => setPlayerOpen(true)}
          className="relative w-full block group focus:outline-none"
          aria-label="Xem lại video"
        >
          {/* Background */}
          <div
            className={cn(
              'w-full aspect-video relative overflow-hidden',
              'bg-black'
            )}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-80 transition-opacity"
              />
            ) : (
              /* Beautiful gradient fallback when no thumbnail */
              <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-gray-900 to-purple-950">
                <div className="absolute inset-0 opacity-30"
                  style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, hsl(0 80% 40% / 0.6) 0%, transparent 60%), radial-gradient(circle at 70% 70%, hsl(270 60% 30% / 0.5) 0%, transparent 55%)' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-red-600/30 border-2 border-red-500/40 flex items-center justify-center backdrop-blur-sm">
                    <Radio className="w-8 h-8 text-red-300" />
                  </div>
                  <div className="text-center px-8">
                    <p className="text-white font-semibold text-sm line-clamp-2 drop-shadow">{title}</p>
                    <p className="text-white/50 text-xs mt-1">Video Replay</p>
                  </div>
                </div>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* VIDEO REPLAY badge - top left (prominent) */}
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-md shadow-lg ring-2 ring-red-500/40">
                <Video className="w-3.5 h-3.5" fill="currentColor" />
                REPLAY
              </span>
            </div>

            {/* Duration badge - top right */}
            {durationSeconds !== null && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center bg-black/70 text-white text-[11px] font-mono px-2 py-0.5 rounded">
                  {formatDuration(durationSeconds)}
                </span>
              </div>
            )}

            {/* Big play button - center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
              </div>
            </div>

          </div>
        </button>

        {/* Info bar below */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-border bg-card">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {viewerCount} người xem
              </span>
              {endedAt && (
                <>
                  <span>·</span>
                  <span>
                    Đã kết thúc{' '}
                    {formatDistanceToNow(new Date(endedAt), { addSuffix: true, locale: vi })}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="ml-3 shrink-0 flex items-center gap-2">
            {mp4Parts.length > 1 ? (
              <MultiPartDownload />
            ) : playbackMp4 ? (
              <a
                href={playbackMp4}
                download={`live-${liveSessionId || 'replay'}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm" variant="outline">
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Tải MP4
                </Button>
              </a>
            ) : mp4Pending ? (
              <Button
                size="sm"
                variant="outline"
                disabled
                onClick={(e) => e.stopPropagation()}
                title="Đang tạo file MP4, vui lòng quay lại sau vài phút"
              >
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Đang tạo MP4...
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="default"
              onClick={() => setPlayerOpen(true)}
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              Xem lại
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog player */}
      <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden bg-black border-border">
          <DialogHeader className="px-4 py-3 bg-card/90 border-b border-border flex flex-row items-center justify-between gap-3">
            <DialogTitle className="text-sm font-semibold truncate pr-8 flex-1">{title}</DialogTitle>
            {mp4Parts.length > 1 ? (
              <div className="shrink-0 mr-6">
                <MultiPartDownload />
              </div>
            ) : playbackMp4 ? (
              <a
                href={playbackMp4}
                download={`live-${liveSessionId || 'replay'}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 mr-6"
              >
                <Button size="sm" variant="outline">
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Tải MP4
                </Button>
              </a>
            ) : mp4Pending ? (
              <Button size="sm" variant="outline" disabled className="shrink-0 mr-6">
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Đang tạo MP4...
              </Button>
            ) : null}
          </DialogHeader>
          <div className={cn(
            'flex flex-col',
            liveSessionId ? 'md:flex-row' : ''
          )}>
            {/* Video */}
            <div className={cn(
              'w-full bg-black relative',
              liveSessionId ? 'md:flex-[3]' : '',
              'aspect-video'
            )}>
              {playbackType === 'r2' || playbackType === 'cloudflare_stream' ? (
                <ReplayPlayer
                  src={playbackUrl}
                  poster={thumbnailUrl || undefined}
                  className="w-full h-full"
                  autoPlay
                  muted={false}
                />
              ) : (
                <StreamPlayer
                  src={playbackUrl}
                  poster={thumbnailUrl || undefined}
                  className="w-full h-full"
                  autoPlay
                  muted={false}
                  enableStatusCheck={false}
                />
              )}
              {/* REPLAY watermark overlay */}
              <div className="pointer-events-none absolute bottom-3 right-3 z-10">
                <span className="inline-flex items-center gap-1 bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded shadow ring-1 ring-red-500/40">
                  <Video className="w-2.5 h-2.5" fill="currentColor" />
                  REPLAY
                </span>
              </div>
            </div>
            {/* Chat Replay */}
            {liveSessionId && (
              <div className="md:flex-[2] border-t md:border-t-0 md:border-l border-border h-72 md:h-auto md:max-h-[60vh]">
                <LiveChatReplay sessionId={liveSessionId} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
