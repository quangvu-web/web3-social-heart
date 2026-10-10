import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRedEnvelope } from '../hooks/useRedEnvelope';
import { RedEnvelopeClaimDialog } from './RedEnvelopeClaimDialog';

interface RedEnvelopeCardProps {
  envelopeId: string;
  conversationId: string;
  currentUserId: string | null;
  compact?: boolean;
}

export function RedEnvelopeCard({
  envelopeId,
  conversationId,
  currentUserId,
  compact,
}: RedEnvelopeCardProps) {
  const [openDetails, setOpenDetails] = useState(false);
  const { envelope, claims, isLoading, claim } = useRedEnvelope(envelopeId, conversationId);

  const hasClaimed = useMemo(() => {
    if (!currentUserId) return false;
    return claims.some((c) => c.claimer_id === currentUserId);
  }, [claims, currentUserId]);

  const isActive = envelope?.status === 'active' && new Date(envelope.expires_at) > new Date();
  const canClaim = !!currentUserId && isActive && !hasClaimed && (envelope?.remaining_count || 0) > 0;

  return (
    <>
      <div
        className={cn(
          'rounded-xl border bg-gradient-to-br from-destructive via-destructive to-destructive text-primary-foreground p-3 shadow-sm',
          compact && 'p-2'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">Lì xì</div>
            <div className="text-xs text-primary-foreground/80">
              {isLoading || !envelope
                ? 'Đang tải...'
                : `${envelope.remaining_count}/${envelope.total_count} còn lại`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpenDetails(true)}
              className="bg-card/15 hover:bg-card/20 text-primary-foreground border-white/20"
            >
              Xem
            </Button>
            <Button
              size="sm"
              onClick={() => claim.mutate()}
              disabled={!canClaim || claim.isPending}
              className="bg-gold-line hover:bg-[hsl(var(--gold-hover))] text-[hsl(var(--foreground))]"
            >
              {claim.isPending ? '...' : hasClaimed ? 'Đã nhận' : 'Nhận'}
            </Button>
          </div>
        </div>
        {!isLoading && envelope && (
          <div className="mt-2 text-xs text-primary-foreground/80">
            Còn lại: {envelope.remaining_amount} {envelope.token}
          </div>
        )}
        {!isLoading && envelope && !isActive && (
          <div className="mt-2 text-xs text-primary-foreground/80">Đã hết hạn hoặc đã hết.</div>
        )}
      </div>

      <RedEnvelopeClaimDialog
        open={openDetails}
        onOpenChange={setOpenDetails}
        envelope={envelope}
        claims={claims}
      />
    </>
  );
}

