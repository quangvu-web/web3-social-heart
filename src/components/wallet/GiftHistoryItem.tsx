import { formatDistanceToNow, format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { ExternalLink, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { GiftHistoryRow } from '@/hooks/useGiftHistory';

interface GiftHistoryItemProps {
  item: GiftHistoryRow;
  direction: 'sent' | 'received';
}

const shortenAddress = (address?: string | null) => {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

export function GiftHistoryItem({ item, direction }: GiftHistoryItemProps) {
  const time = new Date(item.created_at);
  const relative = formatDistanceToNow(time, { addSuffix: true, locale: enUS });
  const exact = format(time, 'PPpp');
  const counterparty =
    direction === 'sent'
      ? item.to_profile?.username || shortenAddress(item.to_address)
      : item.from_profile?.username || 'Unknown';

  const txUrl = item.tx_hash ? `https://bscscan.com/tx/${item.tx_hash}` : null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gold-light/30 bg-card/70 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF4D6] text-[#8B6B2E]">
          {direction === 'sent' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-[#8B7355]">
              {direction === 'sent' ? 'Sent' : 'Received'}
            </span>
            <span className="font-semibold text-[hsl(var(--foreground))]">
              {item.amount_numeric} {item.token}
            </span>
            <Badge
              variant="outline"
              className={`text-[11px] ${statusStyles[item.status] || 'border-muted text-muted-foreground'}`}
            >
              {item.status}
            </Badge>
          </div>
          <div className="text-xs text-[#6B5B3E] truncate">
            {direction === 'sent' ? 'To' : 'From'}: {counterparty}
          </div>
          {item.conversation?.name && (
            <div className="text-[11px] text-[#8B7355] truncate">
              Chat: {item.conversation.name}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-[#6B5B3E] whitespace-nowrap">{relative}</span>
          </TooltipTrigger>
          <TooltipContent>{exact}</TooltipContent>
        </Tooltip>
        {txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#2E6B4A] hover:underline"
          >
            Tx
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
