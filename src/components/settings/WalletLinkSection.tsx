import { useState, useEffect } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { useUnifiedAuth } from '@/modules/auth/hooks/useUnifiedAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Link2, Unlink, Loader2, Copy, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

function truncateAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const COOLDOWN_DAYS = 30;

function useCooldown() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setDaysLeft(null); setLoading(false); return; }

      // Chỉ áp dụng cooldown khi user đang có ví liên kết
      const { count } = await supabase
        .from('user_wallets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if ((count ?? 0) === 0) {
        setDaysLeft(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('last_wallet_changed_at')
        .eq('id', user.id)
        .single();

      if (data?.last_wallet_changed_at) {
        const lastChanged = new Date(data.last_wallet_changed_at);
        const cooldownEnd = new Date(lastChanged.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
        const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        setDaysLeft(remaining > 0 ? remaining : null);
      } else {
        setDaysLeft(null);
      }
    } catch {
      setDaysLeft(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return { daysLeft, loading, refresh };
}

function WalletLinkContent() {
  const { wallets, linkWallet, unlinkWallet, isLoading } = useUnifiedAuth();
  const { t } = useLanguage();
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const { daysLeft, loading: cooldownLoading, refresh: refreshCooldown } = useCooldown();

  const isCooldownActive = daysLeft !== null && daysLeft > 0;

  const handleLink = async () => {
    setIsLinking(true);
    try {
      await linkWallet();
      toast.success((t as any)('walletLinked') || 'Wallet linked successfully');
      refreshCooldown();
    } catch (err: any) {
      if (err?.message?.includes('User rejected')) return;
      const raw = err?.message || '';
      let friendly = raw || (t as any)('walletLinkError') || 'Failed to link wallet';
      if (/already linked to another account/i.test(raw)) {
        friendly = 'Ví này đã được liên kết với một tài khoản khác. Hãy đổi sang ví khác trong MetaMask rồi thử lại.';
      } else if (/nonce.*(invalid|expired|already used)/i.test(raw)) {
        friendly = 'Phiên ký đã hết hạn, vui lòng thử lại.';
      } else if (/signature does not match/i.test(raw)) {
        friendly = 'Chữ ký không khớp địa chỉ ví đang chọn. Hãy chắc chắn ký bằng đúng ví bạn muốn liên kết.';
      }
      toast.error(friendly);
    } finally {
      setIsLinking(false);
    }
  };


  const handleUnlink = async (walletId: string) => {
    setUnlinkingId(walletId);
    try {
      await unlinkWallet({ walletId });
      toast.success((t as any)('walletUnlinked') || 'Wallet unlinked successfully');
      refreshCooldown();
    } catch (err: any) {
      toast.error(err?.message || (t as any)('walletUnlinkError') || 'Failed to unlink wallet');
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleCopy = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  if (isLoading || cooldownLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          {(t as any)('web3Wallet') || 'Web3 Wallet'}
        </CardTitle>
        <CardDescription>
          {(t as any)('web3WalletDesc') || 'Link your Web3 wallets to your account'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cooldown notice */}
        {isCooldownActive && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-500">Thời gian chờ thay đổi ví</p>
              <p className="text-muted-foreground mt-0.5">
                Bạn có thể thay đổi ví sau <span className="font-semibold text-foreground">{daysLeft} ngày</span> nữa.
                Quy định này giúp bảo vệ tài khoản và chống lạm dụng hệ thống.
              </p>
            </div>
          </div>
        )}

        {wallets.length > 0 ? (
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Wallet className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">
                        {truncateAddress(wallet.address)}
                      </span>
                      <button
                        onClick={() => handleCopy(wallet.address)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedAddress === wallet.address ? (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {wallet.is_primary && (
                        <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    {wallet.chain_id && (
                      <span className="text-xs text-muted-foreground">
                        Chain ID: {wallet.chain_id}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlink(wallet.id)}
                  disabled={unlinkingId === wallet.id || isCooldownActive}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  title={isCooldownActive ? `Cần đợi ${daysLeft} ngày nữa` : undefined}
                >
                  {unlinkingId === wallet.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                  <span className="ml-1 hidden sm:inline">
                    {(t as any)('unlink') || 'Unlink'}
                  </span>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            {(t as any)('noWalletLinked') || 'No wallet linked yet'}
          </p>
        )}

        <Button
          onClick={handleLink}
          disabled={isLinking || isCooldownActive}
          className="w-full"
          variant="outline"
          title={isCooldownActive ? `Cần đợi ${daysLeft} ngày nữa` : undefined}
        >
          {isLinking ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Link2 className="w-4 h-4 mr-2" />
          )}
          {(t as any)('connectAndLinkWallet') || 'Connect & Link Wallet'}
        </Button>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Mẹo: trong MetaMask, chọn đúng account bạn muốn liên kết <span className="font-medium">trước khi</span> bấm nút. Mỗi địa chỉ ví chỉ có thể liên kết với một tài khoản FUN.RICH.
        </p>
      </CardContent>
    </Card>
  );
}

export function WalletLinkSection() {
  return (
    <RainbowKitProvider
      theme={darkTheme({
        accentColor: '#10b981',
        accentColorForeground: 'white',
        borderRadius: 'large',
      })}
    >
      <WalletLinkContent />
    </RainbowKitProvider>
  );
}
