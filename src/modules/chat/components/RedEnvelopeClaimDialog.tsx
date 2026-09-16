import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { RedEnvelope, RedEnvelopeClaim } from '../types';

interface RedEnvelopeClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelope: RedEnvelope | null;
  claims: RedEnvelopeClaim[];
}

export function RedEnvelopeClaimDialog({
  open,
  onOpenChange,
  envelope,
  claims,
}: RedEnvelopeClaimDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chi tiết lì xì</DialogTitle>
        </DialogHeader>

        {!envelope ? (
          <div className="text-sm text-muted-foreground">Không tìm thấy lì xì.</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-3 text-sm">
              <div className="flex justify-between">
                <span>Tổng</span>
                <span className="font-medium">
                  {envelope.total_amount} {envelope.token}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Đã nhận</span>
                <span className="font-medium">
                  {envelope.total_count - envelope.remaining_count}/{envelope.total_count}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Còn lại</span>
                <span className="font-medium">
                  {envelope.remaining_amount} {envelope.token}
                </span>
              </div>
            </div>

            <div className="text-sm font-medium">Danh sách nhận</div>
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-2 space-y-1">
                {claims.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">Chưa có ai nhận.</div>
                ) : (
                  claims.map((c) => (
                    <div key={c.id} className="flex justify-between text-sm rounded-md px-2 py-1 hover:bg-accent">
                      <span className="font-mono text-xs">{c.claimer_id.slice(0, 8)}...</span>
                      <span className="font-medium">
                        {c.amount} {envelope.token}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

