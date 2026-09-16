import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, RadioTower, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface StartLiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StartMode = 'webcam' | 'rtmp' | 'record';

export function StartLiveDialog({ open, onOpenChange }: StartLiveDialogProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<StartMode>('webcam');

  const handleStart = () => {
    onOpenChange(false);
    if (mode === 'webcam') navigate('/live/new');
    if (mode === 'rtmp') navigate('/live/rtmp/new');
    if (mode === 'record') navigate('/live/stream');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-destructive" />
            Bắt đầu LIVE
          </DialogTitle>
          <DialogDescription>Chọn cách con muốn phát trực tiếp.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={mode}
            onValueChange={(value) => setMode(value as StartMode)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <label
              htmlFor="mode-webcam"
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                mode === 'webcam'
                  ? 'border-destructive bg-destructive/5'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="webcam" id="mode-webcam" className="sr-only" />
              <Video className="h-6 w-6 text-destructive" />
              <span className="text-sm font-medium">Live bằng Webcam</span>
              <span className="text-xs text-muted-foreground text-center">Phát từ camera (Agora RTC)</span>
            </label>

            <label
              htmlFor="mode-rtmp"
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                mode === 'rtmp'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="rtmp" id="mode-rtmp" className="sr-only" />
              <RadioTower className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Live bằng OBS</span>
              <span className="text-xs text-muted-foreground text-center">Phát từ phần mềm (OBS, vMix...)</span>
            </label>

            <label
              htmlFor="mode-record"
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                mode === 'record'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="record" id="mode-record" className="sr-only" />
              <Film className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Ghi & Đăng</span>
              <span className="text-xs text-muted-foreground text-center">Quay trên trình duyệt</span>
            </label>
          </RadioGroup>

          <Button onClick={handleStart} className="w-full">
            {mode === 'webcam' ? 'Mở FUN Studio' : mode === 'rtmp' ? 'Live bằng OBS' : 'Bắt đầu ghi'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
