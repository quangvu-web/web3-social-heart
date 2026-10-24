import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export default function AngelPlayerPage() {
  const [params] = useSearchParams();
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackUrl = params.get("t") ?? "";
  const title = (params.get("title") ?? "Nhạc thiền").slice(0, 120);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !trackUrl) return;
    const play = () => { void audio.play().catch(() => undefined); };
    audio.addEventListener("canplay", play);
    audio.load();
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) play();
    return () => audio.removeEventListener("canplay", play);
  }, [trackUrl]);

  return (
    <main className="min-h-screen bg-black text-white text-center flex flex-col items-center justify-center gap-6">
      <div className="max-w-5xl px-12 break-words text-4xl font-semibold">🎵 {title}</div>
      <div className="text-2xl opacity-70">Angel Translator 🌐</div>
      <audio ref={audioRef} src={trackUrl || undefined} preload="auto" autoPlay onError={() => undefined} />
    </main>
  );
}
