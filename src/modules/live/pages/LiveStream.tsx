import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Square, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { uploadStreamVideo, createStreamRecord } from '../streamService';

type Phase = 'idle' | 'preview' | 'recording' | 'uploading';

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function resolveMime(): string {
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function LiveStream() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>('idle');
  const [title, setTitle] = useState(searchParams.get('title') || '');
  const [seconds, setSeconds] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const busyRef = useRef(false);

  // Cleanup helper
  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (phase === 'recording' || phase === 'uploading') {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      stopTracks();
    };
  }, [stopTracks]);

  // Attach stream to video element whenever the video element mounts
  useEffect(() => {
    if (videoRef.current && streamRef.current && phase !== 'idle') {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  // ---- Actions ----
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPhase('preview');
    } catch {
      toast.error('Không thể truy cập camera / micro');
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = resolveMime();
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setSeconds(0);
    setPhase('recording');

    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopAndUpload = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    clearInterval(timerRef.current);

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      busyRef.current = false;
      return;
    }

    setPhase('uploading');

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      };
      recorder.stop();
    });

    stopTracks();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      const duration = seconds;
      const { publicUrl } = await uploadStreamVideo(blob, user.id);
      await createStreamRecord(user.id, title.trim() || null, publicUrl, duration);
      await queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      toast.success('Video đã được đăng!');
      navigate('/');
    } catch (err: any) {
      toast.error(err?.message || 'Upload thất bại');
      setPhase('idle');
    } finally {
      busyRef.current = false;
    }
  };

  const handleBack = () => {
    if (phase === 'recording') return;
    clearInterval(timerRef.current);
    stopTracks();
    navigate(-1);
  };

  // ---- Render ----
  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-3 border-b">
        <Button variant="ghost" size="icon" onClick={handleBack} disabled={phase === 'uploading'}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">Ghi & Đăng</h1>
        {phase === 'recording' && (
          <Badge variant="destructive" className="animate-pulse gap-1">
            <span className="h-2 w-2 rounded-full bg-white" />
            REC {formatTime(seconds)}
          </Badge>
        )}
      </div>

      {/* Video area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {phase === 'idle' ? (
          <div className="text-center text-muted-foreground space-y-4 p-6">
            <Camera className="h-16 w-16 mx-auto opacity-40" />
            <p>Nhập tiêu đề rồi bật camera để bắt đầu</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        {phase === 'uploading' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
            <p className="text-white text-sm">Đang tải lên…</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3 border-t">
        {phase === 'idle' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="rec-title">Tiêu đề (tuỳ chọn)</Label>
              <Input
                id="rec-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Giao lưu tối nay"
                maxLength={120}
              />
            </div>
            <Button onClick={startCamera} className="w-full gap-2">
              <Camera className="h-4 w-4" />
              Bật camera
            </Button>
          </>
        )}

        {phase === 'preview' && (
          <Button onClick={startRecording} className="w-full gap-2">
            <span className="h-3 w-3 rounded-full bg-destructive" />
            Bắt đầu ghi
          </Button>
        )}

        {phase === 'recording' && (
          <Button onClick={stopAndUpload} variant="destructive" className="w-full gap-2">
            <Square className="h-4 w-4" />
            Kết thúc & Đăng
          </Button>
        )}
      </div>
    </div>
  );
}
