import { HlsPlayer } from './HlsPlayer';

interface RTMPPlayerProps {
  src?: string | null;
  title?: string;
  poster?: string;
  className?: string;
  waitingLabel?: string;
}

export function RTMPPlayer({
  src,
  title = 'RTMP live stream',
  poster,
  className,
  waitingLabel = 'Waiting for OBS stream...',
}: RTMPPlayerProps) {
  return (
    <HlsPlayer
      src={src}
      title={title}
      poster={poster}
      className={className}
      waitingLabel={waitingLabel}
      autoPlay
      muted
    />
  );
}
