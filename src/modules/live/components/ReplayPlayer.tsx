import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, Maximize, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReplayPlayerProps {
  src: string;
  poster?: string | null;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
}

export function ReplayPlayer({
  src,
  poster,
  className,
  autoPlay = false,
  muted = false,
  controls = true,
}: ReplayPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setError(null);
    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.removeAttribute('src');
    video.load();

    const markReady = () => {
      setIsLoading(false);
      setIsBuffering(false);
      if (autoPlay) video.play().catch(() => undefined);
    };
    const markBuffering = () => setIsBuffering(true);
    const clearBuffering = () => setIsBuffering(false);
    const markError = () => {
      setIsLoading(false);
      setError('Video replay is not available yet.');
    };

    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('waiting', markBuffering);
    video.addEventListener('playing', clearBuffering);
    video.addEventListener('canplay', clearBuffering);
    video.addEventListener('error', markError);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1,
        backBufferLength: 60,
        maxBufferLength: 60,
        manifestLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 4,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, markReady);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        setError('HLS playback failed.');
        setIsLoading(false);
      });
    } else {
      setError('HLS playback is not supported in this browser.');
      setIsLoading(false);
    }

    return () => {
      video.removeEventListener('loadedmetadata', markReady);
      video.removeEventListener('waiting', markBuffering);
      video.removeEventListener('playing', clearBuffering);
      video.removeEventListener('canplay', clearBuffering);
      video.removeEventListener('error', markError);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [autoPlay, retryKey, src]);

  return (
    <div className={cn('relative bg-black overflow-hidden', className)}>
      <video
        ref={videoRef}
        poster={poster || undefined}
        preload="metadata"
        playsInline
        muted={muted}
        controls={controls}
        className="w-full h-full object-contain"
      />

      {(isLoading || isBuffering) && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white p-4 text-center">
          <p className="text-sm">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => setRetryKey((x) => x + 1)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {!error && (
        <button
          type="button"
          onClick={() => videoRef.current?.requestFullscreen?.()}
          className="absolute top-3 right-3 h-9 w-9 rounded bg-black/60 text-white inline-flex items-center justify-center hover:bg-black/80"
          aria-label="Fullscreen"
        >
          <Maximize className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default ReplayPlayer;
