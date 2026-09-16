import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RedEnvelopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreating: boolean;
  onCreate: (input: { token: 'CAMLY' | 'BNB'; totalAmount: number; totalCount: number }) => void;
}

export function RedEnvelopeDialog({ open, onOpenChange, isCreating, onCreate }: RedEnvelopeDialogProps) {
  const [token, setToken] = useState<'CAMLY' | 'BNB'>('CAMLY');
  const [amount, setAmount] = useState('10');
  const [count, setCount] = useState('5');

  useEffect(() => {
    if (open) {
      setToken('CAMLY');
      setAmount('10');
      setCount('5');
    }
  }, [open]);

  const handleCreate = () => {
    const totalAmount = Number(amount);
    const totalCount = Number(count);
    if (!totalAmount || totalAmount <= 0) return;
    if (!totalCount || totalCount <= 0) return;
    onCreate({ token, totalAmount, totalCount });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lì xì</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Token</Label>
            <Select value={token} onValueChange={(v) => setToken(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAMLY">CAMLY</SelectItem>
                <SelectItem value="BNB">BNB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tổng số tiền</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.0001" />
          </div>

          <div className="space-y-2">
            <Label>Số người nhận</Label>
            <Input value={count} onChange={(e) => setCount(e.target.value)} type="number" min="1" step="1" />
          </div>

          <div className="text-xs text-muted-foreground">
            Phân phối ngẫu nhiên, hết hạn sau 24 giờ.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Đang tạo...' : 'Tạo lì xì'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

