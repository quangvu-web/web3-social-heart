import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { GiftHistoryItem } from './GiftHistoryItem';
import { useGiftHistory } from '@/hooks/useGiftHistory';

interface GiftHistoryPanelProps {
  userId: string | null;
}

export function GiftHistoryPanel({ userId }: GiftHistoryPanelProps) {
  const { sent, received, isLoading } = useGiftHistory(userId);

  return (
    <div className="rounded-2xl border border-gold-light/40 bg-card/80 p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Gift History</h3>
        <p className="text-sm text-[#6B5B3E]">Your sent and received crypto gifts.</p>
      </div>

      <Tabs defaultValue="sent">
        <TabsList className="bg-[#FFF2D1]">
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="mt-4 space-y-3">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {!isLoading && sent.length === 0 && (
            <p className="text-sm text-muted-foreground">No sent gifts yet.</p>
          )}
          {sent.map((item) => (
            <GiftHistoryItem key={item.id} item={item} direction="sent" />
          ))}
        </TabsContent>

        <TabsContent value="received" className="mt-4 space-y-3">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {!isLoading && received.length === 0 && (
            <p className="text-sm text-muted-foreground">No received gifts yet.</p>
          )}
          {received.map((item) => (
            <GiftHistoryItem key={item.id} item={item} direction="received" />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
