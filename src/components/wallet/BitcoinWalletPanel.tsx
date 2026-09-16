import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Coins, ExternalLink, RefreshCw, Shield, Wallet, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BitcoinReceiveTab } from './BitcoinReceiveTab';
import { BitcoinSendTab } from './BitcoinSendTab';
import { useBitcoinWallet } from '@/hooks/useBitcoinWallet';
import { formatSatsToBtc } from '@/modules/wallet/bitcoin/addressService';

const formatUsd = (value: number) =>
  value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });

/* ── Onboarding guide when not connected ── */
const BitcoinOnboarding = ({
  isConnectorAvailable,
  isConnecting,
  onConnect,
}: {
  isConnectorAvailable: boolean;
  isConnecting: boolean;
  onConnect: () => void;
}) => {
  const isMobileOrPwa =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia('(display-mode: standalone)').matches;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border-2 border-amber-200 bg-white shadow-lg">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <span className="text-3xl">₿</span>
          </div>
          <h2 className="text-lg font-bold text-white">Bitcoin Testnet Wallet</h2>
          <p className="mt-1 text-sm text-white/80">Quản lý BTC testnet qua MetaMask Snap</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Steps */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Hướng dẫn sử dụng:</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <StepItem n={1} text="Mở trình duyệt desktop có cài MetaMask extension" />
              <StepItem n={2} text='Bấm "Connect Bitcoin Snap" bên dưới' />
              <StepItem n={3} text="MetaMask sẽ yêu cầu cài Bitcoin Snap — bấm Approve" />
              <StepItem n={4} text='Dùng "Receive" để lấy địa chỉ tb1... và nạp coin testnet' />
              <StepItem n={5} text='Dùng "Send" để tạo giao dịch, ký qua Snap và broadcast' />
            </div>
          </div>

          {/* Environment warning */}
          {!isConnectorAvailable && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="flex items-start gap-2">
                {isMobileOrPwa ? (
                  <Smartphone className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                ) : (
                  <Monitor className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-amber-800">
                    {isMobileOrPwa
                      ? 'Điện thoại / PWA không hỗ trợ MetaMask Snap'
                      : 'Không tìm thấy MetaMask extension'}
                  </p>
                  <p className="mt-1 text-amber-700">
                    {isMobileOrPwa
                      ? 'Bitcoin Snap chỉ hoạt động trên trình duyệt desktop có cài MetaMask extension (Chrome, Firefox, Brave).'
                      : 'Hãy cài MetaMask extension cho trình duyệt, sau đó refresh trang này.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Connect button */}
          <Button
            onClick={onConnect}
            disabled={isConnecting || !isConnectorAvailable}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3"
          >
            <Wallet className="mr-2 h-5 w-5" />
            {isConnecting ? 'Đang kết nối...' : 'Connect Bitcoin Snap'}
          </Button>
        </div>
      </div>

      {/* Security note */}
      <Card className="border-slate-200">
        <CardContent className="space-y-2 p-4 text-sm text-slate-700">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-4 w-4 text-emerald-600" />
            <p>Private keys luôn ở trong MetaMask Snap. App chỉ tạo PSBT và broadcast giao dịch đã ký.</p>
          </div>
          <div className="flex items-start gap-2">
            <ExternalLink className="mt-0.5 h-4 w-4 text-slate-500" />
            <p>Chỉ hỗ trợ Bitcoin testnet. Dùng địa chỉ <code className="text-xs bg-slate-100 px-1 rounded">tb1...</code> và coin testnet.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StepItem = ({ n, text }: { n: number; text: string }) => (
  <div className="flex items-start gap-2.5">
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
      {n}
    </span>
    <span>{text}</span>
  </div>
);

/* ── Main panel ── */
export const BitcoinWalletPanel = () => {
  const {
    address,
    btcBalance,
    btcUsdValue,
    feeOptions,
    utxos,
    connect,
    disconnect,
    refresh,
    createTransaction,
    signTransaction,
    broadcastTransaction,
    isConnected,
    isConnecting,
    isLoading,
    isRefetching,
    isConnectorAvailable,
    error,
  } = useBitcoinWallet();
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [copied, setCopied] = useState(false);

  const confirmedUtxoCount = useMemo(
    () => utxos.filter((utxo) => utxo.status?.confirmed !== false).length,
    [utxos],
  );

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Đã copy địa chỉ Bitcoin.');
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Bitcoin Snap đã kết nối.');
    } catch (connectError) {
      const msg = (connectError as Error).message ?? '';
      if (msg.includes('endowment') || msg.includes('not permitted')) {
        toast.error(
          'MetaMask đã có Bitcoin Snap sẵn nhưng không thể kích hoạt. Hãy cập nhật MetaMask lên phiên bản mới nhất và thử lại.',
          { duration: 8000 },
        );
      } else {
        toast.error(msg);
      }
    }
  };

  // Show onboarding if not connected
  if (!isConnected) {
    return (
      <BitcoinOnboarding
        isConnectorAvailable={isConnectorAvailable}
        isConnecting={isConnecting}
        onConnect={() => void handleConnect()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border-2 border-amber-200 bg-white shadow-lg">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white">
              <Coins className="h-5 w-5" />
              <span className="text-sm font-bold">MetaMask Bitcoin Snap</span>
            </div>
            <div className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
              Connected
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!address}
            className="rounded-full bg-white/10 px-3 py-1.5 text-left text-sm font-mono text-white/90 transition-colors hover:text-white disabled:cursor-default"
          >
            {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : '...'}
            {copied ? '  ✓ Copied' : ''}
          </button>
        </div>

        <div className="border-b bg-gradient-to-b from-slate-50 to-white px-4 py-4">
          <p className="mb-1 text-xs text-muted-foreground">Bitcoin Testnet Balance</p>
          <p className="text-2xl font-bold text-slate-900">
            {isLoading ? 'Loading...' : `${formatSatsToBtc(btcBalance)} BTC`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Approx. {formatUsd(btcUsdValue)}
          </p>
        </div>

        <div className="border-b bg-slate-50/60 px-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setShowReceive(true)}
              disabled={!address}
              className="rounded-xl border bg-white p-3 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Receive
            </button>
            <button
              type="button"
              onClick={() => setShowSend(true)}
              disabled={!address}
              className="rounded-xl border bg-white p-3 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl border bg-white p-3 text-sm font-medium transition-colors hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50/60 px-4 py-3">
          <Button variant="outline" onClick={disconnect}>
            Disconnect
          </Button>
          <Button variant="ghost" onClick={() => void refresh()} disabled={isRefetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        <div className="divide-y">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
            <span className="text-sm font-semibold text-slate-600">Bitcoin</span>
            <span className="text-xs text-muted-foreground">{confirmedUtxoCount} confirmed UTXOs</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">BTC</p>
                <p className="text-xs text-muted-foreground">Bitcoin Testnet (native)</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{formatSatsToBtc(btcBalance)} BTC</p>
              <p className="text-xs text-muted-foreground">{formatUsd(btcUsdValue)}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="space-y-2 p-4 text-sm text-slate-700">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-4 w-4 text-emerald-600" />
            <p>Private keys luôn ở trong MetaMask Snap. App chỉ tạo PSBT và broadcast giao dịch đã ký.</p>
          </div>
          <div className="flex items-start gap-2">
            <ExternalLink className="mt-0.5 h-4 w-4 text-slate-500" />
            <p>Chỉ hỗ trợ Bitcoin testnet. Dùng địa chỉ <code className="text-xs bg-slate-100 px-1 rounded">tb1...</code> và coin testnet.</p>
          </div>
          {error ? <p className="text-red-600">{(error as Error).message}</p> : null}
        </CardContent>
      </Card>

      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receive BTC</DialogTitle>
          </DialogHeader>
          <BitcoinReceiveTab walletAddress={address} />
        </DialogContent>
      </Dialog>

      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send BTC</DialogTitle>
          </DialogHeader>
          <BitcoinSendTab
            senderAddress={address}
            balanceSats={btcBalance}
            feeOptions={feeOptions}
            createTransaction={createTransaction}
            signTransaction={signTransaction}
            broadcastTransaction={broadcastTransaction}
            utxos={utxos}
            isConnectorAvailable={isConnectorAvailable}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
