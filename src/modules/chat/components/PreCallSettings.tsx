/**
 * Pre-Call Settings Dialog
 * Allows users to select camera, microphone, and preview video before joining a call
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mic, MicOff, Video, VideoOff, Phone, RefreshCw, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import AgoraRTC, { ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { useMediaDevices, MediaDevice } from '../hooks/useMediaDevices';
import type { CallType } from '../types';

interface PreCallSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCall: (type: CallType) => void;
  callType: CallType;
  userInfo?: {
    username?: string;
    avatarUrl?: string;
  };
  recipientInfo?: {
    username?: string;
    avatarUrl?: string;
  };
}

export function PreCallSettings({
  isOpen,
  onClose,
  onStartCall,
  callType,
  userInfo,
  recipientInfo,
}: PreCallSettingsProps) {
  const [previewVideoTrack, setPreviewVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [previewAudioTrack, setPreviewAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const {
    devices,
    isEnumerating,
    audioLevel,
    hasMultipleCameras,
    selectCamera,
    selectMicrophone,
    flipCamera,
    startAudioLevelMonitor,
    stopAudioLevelMonitor,
  } = useMediaDevices({
    videoTrack: previewVideoTrack,
    audioTrack: previewAudioTrack,
  });

  // Create preview tracks when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    const createTracks = async () => {
      setIsLoading(true);
      try {
        if (callType === 'video') {
          const [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks();
          setPreviewAudioTrack(audio);
          setPreviewVideoTrack(video);
        } else {
          const audio = await AgoraRTC.createMicrophoneAudioTrack();
          setPreviewAudioTrack(audio);
        }
      } catch (error) {
        console.error('[PreCallSettings] Failed to create tracks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    createTracks();

    return () => {
      // Cleanup tracks when dialog closes
      previewVideoTrack?.close();
      previewAudioTrack?.close();
      setPreviewVideoTrack(null);
      setPreviewAudioTrack(null);
      stopAudioLevelMonitor();
    };
  }, [isOpen, callType]);

  // Play video in container
  useEffect(() => {
    if (previewVideoTrack && videoContainerRef.current && !isCameraOff) {
      previewVideoTrack.play(videoContainerRef.current);
    }
    return () => {
      previewVideoTrack?.stop();
    };
  }, [previewVideoTrack, isCameraOff]);

  // Start audio level monitoring
  useEffect(() => {
    if (previewAudioTrack && !isMuted) {
      startAudioLevelMonitor();
    }
    return () => {
      stopAudioLevelMonitor();
    };
  }, [previewAudioTrack, isMuted, startAudioLevelMonitor, stopAudioLevelMonitor]);

  const handleToggleMute = useCallback(async () => {
    if (previewAudioTrack) {
      await previewAudioTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  }, [previewAudioTrack, isMuted]);

  const handleToggleCamera = useCallback(async () => {
    if (previewVideoTrack) {
      await previewVideoTrack.setEnabled(isCameraOff);
      setIsCameraOff(!isCameraOff);
    }
  }, [previewVideoTrack, isCameraOff]);

  const handleStartCall = useCallback(() => {
    // Close preview tracks before starting real call
    previewVideoTrack?.close();
    previewAudioTrack?.close();
    setPreviewVideoTrack(null);
    setPreviewAudioTrack(null);
    onStartCall(callType);
    onClose();
  }, [previewVideoTrack, previewAudioTrack, onStartCall, callType, onClose]);

  const handleCameraChange = useCallback(async (deviceId: string) => {
    await selectCamera(deviceId);
  }, [selectCamera]);

  const handleMicrophoneChange = useCallback(async (deviceId: string) => {
    await selectMicrophone(deviceId);
  }, [selectMicrophone]);

  const handleClose = useCallback(() => {
    previewVideoTrack?.close();
    previewAudioTrack?.close();
    setPreviewVideoTrack(null);
    setPreviewAudioTrack(null);
    onClose();
  }, [previewVideoTrack, previewAudioTrack, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Cài đặt cuộc gọi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient info */}
          {recipientInfo && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarImage src={recipientInfo.avatarUrl} />
                <AvatarFallback>
                  {(recipientInfo.username || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{recipientInfo.username || 'Người dùng'}</p>
                <p className="text-sm text-muted-foreground">
                  {callType === 'video' ? 'Video call' : 'Voice call'}
                </p>
              </div>
            </div>
          )}

          {/* Video Preview */}
          {callType === 'video' && (
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : isCameraOff ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={userInfo?.avatarUrl} />
                    <AvatarFallback className="text-2xl">
                      {(userInfo?.username || 'Me')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="mt-2 text-sm text-muted-foreground">Camera đã tắt</p>
                </div>
              ) : (
                <div ref={videoContainerRef} className="w-full h-full" />
              )}

              {/* Overlay controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleMute}
                  className={cn(
                    'h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm',
                    isMuted && 'bg-destructive/20 text-destructive'
                  )}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleCamera}
                  className={cn(
                    'h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm',
                    isCameraOff && 'bg-destructive/20 text-destructive'
                  )}
                >
                  {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </Button>

                {hasMultipleCameras && !isCameraOff && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={flipCamera}
                    className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Audio only preview */}
          {callType === 'voice' && (
            <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
              <Avatar className="h-20 w-20">
                <AvatarImage src={userInfo?.avatarUrl} />
                <AvatarFallback className="text-3xl">
                  {(userInfo?.username || 'Me')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Device Selection */}
          <div className="space-y-3">
            {/* Camera Selection */}
            {callType === 'video' && devices.cameras.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Camera</Label>
                <Select
                  value={devices.selectedCamera || undefined}
                  onValueChange={handleCameraChange}
                  disabled={isEnumerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.cameras.map((camera) => (
                      <SelectItem key={camera.deviceId} value={camera.deviceId}>
                        {camera.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Microphone Selection */}
            {devices.microphones.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Microphone</Label>
                <Select
                  value={devices.selectedMicrophone || undefined}
                  onValueChange={handleMicrophoneChange}
                  disabled={isEnumerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.microphones.map((mic) => (
                      <SelectItem key={mic.deviceId} value={mic.deviceId}>
                        {mic.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Audio Level Indicator */}
            {!isMuted && (
              <div className="space-y-1.5">
                <Label className="text-sm">Kiểm tra micro</Label>
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-muted-foreground" />
                  <Progress value={audioLevel} className="flex-1 h-2" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Nói để kiểm tra microphone
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Huỷ
          </Button>
          <Button onClick={handleStartCall} disabled={isLoading}>
            <Phone className="h-4 w-4 mr-2" />
            {callType === 'video' ? 'Gọi Video' : 'Gọi thoại'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
