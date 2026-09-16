import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2 } from 'lucide-react';

interface HlsPlayerProps {
  src?: string | null;
  title?: string;
  muted?: boolean;
  autoPlay?: boolean;
  poster?: string;
  className?: string;
  waitingLabel?: string;
}

function withPreviewCacheBuster(src: string, attempt: number) {
  try {
    const url = new URL(src);
    url.searchParams.set('__preview', `${Date.now()}-${attempt}`);
    return url.toString();
  } catch {
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}__preview=${Date.now()}-${attempt}`;
  }
}

export function HlsPlayer({
  src,
  title = 'Live stream',
  muted = false,
  autoPlay = true,
  poster,
  className = '',
  waitingLabel = 'Waiting for stream...',
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<'waiting' | 'loading' | 'ready' | 'buffering' | 'error'>('waiting');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      setState('waiting');
      return;
    }

    let hls: Hls | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let hasVideoFrame = false;
    const startedAt = Date.now();

    const clearRetryTimer = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const clearStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    const markBuffering = () => {
      if (!cancelled) setState('buffering');
    };

    const markReady = () => {
      if (cancelled || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      hasVideoFrame = true;
      clearRetryTimer();
      clearStallTimer();
      setState('ready');
    };

    const markError = () => {
      if (cancelled) return;
      if (Date.now() - startedAt < 8000) {
        markBuffering();
        return;
      }
      setState('error');
    };

    const destroyHls = () => {
      hls?.destroy();
      hls = null;
    };

    const scheduleReconnect = (delay = 2200) => {
      if (cancelled || hasVideoFrame) return;
      clearRetryTimer();
      markBuffering();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, delay);
    };

    const scheduleStallWatch = () => {
      clearStallTimer();
      if (hasVideoFrame) return;
      stallTimer = setTimeout(() => {
        if (!cancelled && !hasVideoFrame) scheduleReconnect(0);
      }, 7000);
    };

    const connect = () => {
      if (cancelled) return;
      retryCount += 1;
      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
      setState(retryCount === 1 ? 'loading' : 'buffering');
      scheduleStallWatch();

      const previewSrc = withPreviewCacheBuster(src, retryCount);

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = previewSrc;
        video.load();
        if (autoPlay) video.play().catch(() => undefined);
        return;
      }

      if (!Hls.isSupported()) {
        markError();
        return;
      }

      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 8,
        maxLiveSyncPlaybackRate: 1.5,
        backBufferLength: 30,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 800,
        manifestLoadingMaxRetryTimeout: 4000,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 800,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 800,
      });

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls?.loadSource(previewSrc);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        markBuffering();
        if (autoPlay) video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.LEVEL_LOADED, () => {
        if (autoPlay) video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled) return;
        const details = String(data.details || '');
        const waitingForLiveMedia =
          details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
          details === Hls.ErrorDetails.LEVEL_EMPTY_ERROR ||
          details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
          details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT ||
          details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
          details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT;

        if (!data.fatal) {
          if (waitingForLiveMedia || details.includes('buffer')) scheduleReconnect(1800);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCount < 6) {
          markBuffering();
          hls?.recoverMediaError();
          scheduleStallWatch();
          return;
        }

        if (retryCount < 40) {
          scheduleReconnect(Math.min(5000, 1200 + retryCount * 300));
          return;
        }

        markError();
      });

      hls.attachMedia(video);
    };

    const onStalled = () => scheduleReconnect(1800);

    video.addEventListener('loadeddata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('playing', markReady);
    video.addEventListener('timeupdate', markReady);
    video.addEventListener('error', markError);
    video.addEventListener('waiting', markBuffering);
    video.addEventListener('stalled', onStalled);

    connect();

    return () => {
      cancelled = true;
      clearRetryTimer();
      clearStallTimer();
      video.removeEventListener('loadeddata', markReady);
      video.removeEventListener('canplay', markReady);
      video.removeEventListener('playing', markReady);
      video.removeEventListener('timeupdate', markReady);
      video.removeEventListener('error', markError);
      video.removeEventListener('waiting', markBuffering);
      video.removeEventListener('stalled', onStalled);
      destroyHls();
      video.removeAttribute('src');
      video.load();
    };
  }, [autoPlay, src]);

  return (
    <div className={`relative h-full w-full bg-black ${className}`}>
      <video
        ref={videoRef}
        title={title}
        className="h-full w-full object-contain bg-black"
        controls
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        poster={poster}
      />
      {state !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 px-4 text-center text-white">
          {state === 'loading' || state === 'buffering' ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
          <div className="text-sm font-medium">
            {state === 'error' ? 'Stream preview is not available yet.' : state === 'buffering' ? 'Reconnecting stream...' : waitingLabel}
          </div>
        </div>
      )}
    </div>
  );
}
