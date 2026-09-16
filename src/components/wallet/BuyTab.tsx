import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import {
  buildMoonPayBuyUrl,
  mapBuyError,
  MOONPAY_ENABLED_TOKENS,
  type BuyToken,
  validateBuyContext,
} from '@/modules/wallet/services/buyCrypto';

interface BuyTabProps {
  walletAddress?: string | null;
  chainId?: number | null;
  isConnected?: boolean;
  onOpenProvider?: (url: string) => void;
}

export const BuyTab = ({ walletAddress, chainId, isConnected, onOpenProvider }: BuyTabProps) => {
  const [token, setToken] = useState<BuyToken>('BNB');
  const [isOpening, setIsOpening] = useState(false);

  const validation = useMemo(() => {
    return validateBuyContext({ isConnected, chainId, address: walletAddress });
  }, [chainId, isConnected, walletAddress]);

  const logBuyRedirect = async (selectedToken: BuyToken) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user || !walletAddress) return;

    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await supabase.from('transactions').insert({
      user_id: user.id,
      tx_hash: `buy_redirect_${selectedToken.toLowerCase()}_${unique}`,
      from_address: walletAddress,
      to_address: walletAddress,
      amount: '0',
      token_symbol: `BUY_${selectedToken}`,
      chain_id: 56,
      status: 'pending',
    });
  };

  const handleBuy = async () => {
    if (isOpening) return;
    setIsOpening(true);
    try {
      if (!validation.ok) {
        const v = validation as { ok: false; error: string };
        toast.error(v.error);
        return;
      }

      const url = buildMoonPayBuyUrl({
        token,
        walletAddress: walletAddress as string,
        chainId,
      });

      await logBuyRedirect(token);

      if (import.meta.env.DEV) {
        console.debug('[BuyTab][event] buy_redirect', {
          token,
          walletAddress,
          provider: 'moonpay',
          chainId,
        });
      }

      if (onOpenProvider) {
        onOpenProvider(url);
      } else {
        const popup = window.open(url, '_blank', 'noopener,noreferrer');
        if (!popup) {
          toast.error('Trinh duyet dang chan popup. Vui long cho phep mo tab moi.');
          return;
        }
      }

      toast.success('Dang mo cong thanh toan MoonPay...');
    } catch (error) {
      toast.error(mapBuyError(error));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buy Crypto (Visa)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Token</Label>
          <Select value={token} onValueChange={(value) => setToken(value as BuyToken)}>
            <SelectTrigger>
              <SelectValue placeholder="Chon token mua" />
            </SelectTrigger>
            <SelectContent>
              {MOONPAY_ENABLED_TOKENS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Dia chi nhan</Label>
          <Input value={walletAddress || ''} readOnly placeholder="0x..." />
        </div>

        {validation.ok ? (
          <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm text-green-700 dark:text-green-400">
            Ban da san sang mua crypto bang the Visa qua MoonPay.
          </div>
        ) : (
          <div className="rounded-md border border-yellow-600/30 bg-yellow-600/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
            {!validation.ok ? (validation as { ok: false; error: string }).error : null}
          </div>
        )}

        <Button onClick={handleBuy} disabled={isOpening || !validation.ok} className="w-full">
          {isOpening ? 'Dang mo cong thanh toan...' : 'Buy with Visa'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Luu y: KYC/AML va phi thanh toan do MoonPay xu ly. Giai doan 1 ho tro BNB va USDT tren BSC Mainnet.
        </p>
      </CardContent>
    </Card>
  );
};

