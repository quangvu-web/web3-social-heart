import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  isBlocking: boolean;
  onConfirm: () => void;
  mode: 'block' | 'unblock';
}

export function BlockUserDialog({
  open,
  onOpenChange,
  username,
  isBlocking,
  onConfirm,
  mode,
}: BlockUserDialogProps) {
  const title = mode === 'block' ? 'Tạm ngừng kết nối' : 'Kết nối lại';
  const body =
    mode === 'block'
      ? `Bạn có chắc muốn tạm ngừng kết nối với ${username}? Bạn sẽ không thể nhắn tin trực tiếp với nhau.`
      : `Bạn có muốn kết nối lại với ${username}?`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">{body}</div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBlocking}>
            Hủy
          </Button>
          <Button
            variant={mode === 'block' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isBlocking}
          >
            {isBlocking ? 'Đang xử lý...' : mode === 'block' ? 'Tạm ngừng' : 'Kết nối lại'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

