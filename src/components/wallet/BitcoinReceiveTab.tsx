import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

interface BitcoinReceiveTabProps {
  walletAddress?: string | null;
}

export const BitcoinReceiveTab = ({ walletAddress }: BitcoinReceiveTabProps) => {
  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    toast.success('Bitcoin address copied.');
  };

  const handleShare = async () => {
    if (!walletAddress) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Bitcoin testnet address',
          text: `Send BTC testnet funds to ${walletAddress}`,
        });
        return;
      } catch {
        // Fall back to copy.
      }
    }

    handleCopy();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive BTC</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-4">
          <div className="rounded-xl bg-slate-100 p-6">
            <div className="inline-block rounded-lg bg-white p-4 shadow-sm">
              {walletAddress ? (
                <QRCodeSVG value={walletAddress} size={192} includeMargin level="H" />
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Bitcoin Testnet address</p>
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
              <code className="flex-1 break-all text-xs">{walletAddress || 'Not connected'}</code>
              <Button size="icon" variant="ghost" onClick={handleCopy} disabled={!walletAddress}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={handleCopy} disabled={!walletAddress}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button className="flex-1" variant="outline" onClick={handleShare} disabled={!walletAddress}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Only send Bitcoin testnet funds to this address.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
