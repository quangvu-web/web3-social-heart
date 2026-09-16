import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type StudioPreviewStatus = 'idle' | 'starting' | 'ready' | 'blocked' | 'error';

export interface StudioMediaDevice {
  deviceId: string;
  label: string;
}

function mapMediaError(error: unknown): string {
  const err = error as { name?: string; message?: string };
  if (err?.name === 'NotAllowedError') return 'Bạn chưa cấp quyền camera/micro.';
  if (err?.name === 'NotFoundError') return 'Không tìm thấy thiết bị camera/micro.';
  if (err?.name === 'NotReadableError') return 'Camera hoặc micro đang được ứng dụng khác sử dụng.';
  if (err?.name === 'OverconstrainedError') return 'Thiết bị đã chọn không khả dụng, vui lòng chọn thiết bị khác.';
  return err?.message || 'Không thể bật preview camera.';
}

function friendlyDeviceName(device: MediaDeviceInfo, index: number, prefix: string) {
  return device.label || `${prefix} ${index + 1}`;
}

export function useLocalStudioPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<StudioPreviewStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoDevices, setVideoDevices] = useState<StudioMediaDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<StudioMediaDevice[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices
        .filter((device) => device.kind === 'videoinput' && device.deviceId)
        .map((device, index) => ({ deviceId: device.deviceId, label: friendlyDeviceName(device, index, 'Camera') }));
      const audios = devices
        .filter((device) => device.kind === 'audioinput' && device.deviceId)
        .map((device, index) => ({ deviceId: device.deviceId, label: friendlyDeviceName(device, index, 'Micro') }));

      setVideoDevices(videos);
      setAudioDevices(audios);
      setSelectedVideoDeviceId((current) => current || videos[0]?.deviceId || '');
      setSelectedAudioDeviceId((current) => current || audios[0]?.deviceId || '');
    } catch {
      // ignore enumerate errors before permission
    }
  }, []);

  // Latest-state ref so the mount effect can call startPreview without re-acquiring on every state change.
  const startPreviewRef = useRef<() => Promise<MediaStream | null>>(async () => null);

  const startPreview = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('blocked');
      setError('Trình duyệt này chưa hỗ trợ camera preview.');
      return null;
    }

    setStatus('starting');
    setError(null);

    try {
      stopStream();
      const videoConstraint = cameraEnabled
        ? {
            ...(selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {}),
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user' as const,
          }
        : false;
      const audioConstraint = micEnabled
        ? {
            ...(selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : {}),
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : false;

      // If both are disabled, no need to call getUserMedia.
      if (!videoConstraint && !audioConstraint) {
        setStatus('idle');
        return null;
      }

      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint as MediaTrackConstraints | false,
        audio: audioConstraint as MediaTrackConstraints | false,
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      if (videoRef.current) {
        videoRef.current.srcObject = nextStream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus('ready');
      await refreshDevices();
      return nextStream;
    } catch (err) {
      stopStream();
      setStatus('error');
      setError(mapMediaError(err));
      return null;
    }
  }, [cameraEnabled, micEnabled, refreshDevices, selectedAudioDeviceId, selectedVideoDeviceId, stopStream]);

  useEffect(() => {
    startPreviewRef.current = startPreview;
  }, [startPreview]);

  const attachVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => undefined);
    }
  }, []);

  // Mount only: enumerate devices, kick off preview, cleanup on unmount.
  useEffect(() => {
    void refreshDevices();
    void startPreviewRef.current();
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to toggles/device changes after mount (debounced).
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      void startPreviewRef.current();
    }, 120);
    return () => clearTimeout(t);
  }, [cameraEnabled, micEnabled, selectedVideoDeviceId, selectedAudioDeviceId]);

  const hasVideo = useMemo(() => !!stream?.getVideoTracks().some((track) => track.readyState === 'live'), [stream]);
  const hasAudio = useMemo(() => !!stream?.getAudioTracks().some((track) => track.readyState === 'live'), [stream]);

  const retry = useCallback(() => startPreview(), [startPreview]);

  return {
    attachVideoRef,
    stream,
    status,
    error,
    hasVideo,
    hasAudio,
    cameraEnabled,
    micEnabled,
    videoDevices,
    audioDevices,
    selectedVideoDeviceId,
    selectedAudioDeviceId,
    setSelectedVideoDeviceId,
    setSelectedAudioDeviceId,
    setCameraEnabled,
    setMicEnabled,
    startPreview,
    retry,
    stopStream,
  };
}
