import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const REASONS = [
  { value: 'spam', label: 'Spam / Quảng cáo' },
  { value: 'harassment', label: 'Quấy rối / xúc phạm' },
  { value: 'scam', label: 'Lừa đảo' },
  { value: 'hate', label: 'Kích động thù ghét' },
  { value: 'other', label: 'Khác' },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (input: { reason: string; details: string | null }) => void;
}

export function ReportDialog({ open, onOpenChange, isSubmitting, onSubmit }: ReportDialogProps) {
  const [reason, setReason] = useState<string>('spam');
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    onSubmit({ reason, details: details.trim() ? details.trim() : null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gửi phản hồi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lý do</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn lý do" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Chi tiết (tùy chọn)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Mô tả thêm để đội ngũ hiểu rõ hơn..."
              className="min-h-[90px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Đang gửi...' : 'Gửi'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

