import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useSendTransaction, useSwitchChain, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { bsc } from 'wagmi/chains';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { formatTokenBalance } from '@/lib/formatters';
import { config as wagmiConfig } from '@/config/web3';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FUN_TESTNET_NOTE,
  isTokenInImplementation,
  mapSendError,
  SEND_TRANSFER_NOTE,
  sendAsset,
  type SendStatus,
  type SendToken,
  type WriteContractFn,
  validateSendInput,
} from '@/modules/wallet/services/sendAsset';

const SUPPORTED_CHAIN_IDS = [56, 97] as const;
const BNB_GAS_BUFFER = 0.001;

interface SendTabProps {
  initialToken?: SendToken;
}

export const SendTab = ({ initialToken }: SendTabProps) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<SendToken>(initialToken ?? 'BNB');
  const [status, setStatus] = useState<SendStatus>('idle');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);
  const [lastTxChainId, setLastTxChainId] = useState<number>(bsc.id);

  // Balance for selected token
  const { tokens } = useTokenBalances();
  const currentTokenBalance = tokens.find(t => t.symbol === token);
  const currentBalance = currentTokenBalance?.balance ?? 0;
  const isBalanceLoading = currentTokenBalance?.isLoading ?? false;

  const maxAmount = useMemo(() => {
    if (token === 'BNB') {
      const max = currentBalance - BNB_GAS_BUFFER;
      return max > 0 ? max : 0;
    }
    return currentBalance;
  }, [token, currentBalance]);

  const handleMax = () => {
    if (maxAmount > 0) {
      setAmount(maxAmount.toString());
    }
  };

  const isBusy = status !== 'idle' && status !== 'success' && status !== 'failed';
  const isWrongChain = Boolean(chainId && !SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number]));
  const isTokenDisabled = isTokenInImplementation(token);

  const writeContractWrapper: WriteContractFn = (params) => {
    return writeContractAsync(params as any);
  };

  const statusLabel = useMemo(() => {
    if (status === 'awaiting_signature') return 'Dang cho ky...';
    if (status === 'submitting') return 'Dang gui len mang...';
    if (status === 'pending_confirm') return 'Dang cho xac nhan...';
    return 'Gui';
  }, [status]);

  useEffect(() => {
    setToken(initialToken ?? 'BNB');
  }, [initialToken]);

  const resetForm = () => {
    setRecipient('');
    setAmount('');
    setToken(initialToken ?? 'BNB');
    setLastTxHash(null);
    setStatus('idle');
  };

  const persistTransaction = async (
    txHash: `0x${string}`,
    txStatus: 'pending' | 'confirmed' | 'failed'
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    if (txStatus === 'pending') {
      await supabase.from('transactions').insert({
        user_id: user.id,
        tx_hash: txHash,
        from_address: address,
        to_address: recipient.trim(),
        amount: amount.trim(),
        token_symbol: token,
        chain_id: chainId,
        status: 'pending',
      });
      return;
    }

    await supabase
      .from('transactions')
      .update({
        status: txStatus,
      })
      .eq('tx_hash', txHash)
      .eq('user_id', user.id);
  };

  const handleSubmit = () => {
    if (!isConnected || !address) {
      toast.error('Vui long ket noi vi truoc.');
      return;
    }

    const validation = validateSendInput({
      recipient,
      amount,
      token,
      chainId,
    });

    if (!validation.ok) {
      toast.error((validation as { ok: false; error: string }).error);
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!address) return;
    setConfirmOpen(false);

    if (import.meta.env.DEV) {
      console.debug('[SendTab][event] send_clicked', { token, chainId });
    }

    setStatus('validating');

    const validation = validateSendInput({
      recipient,
      amount,
      token,
      chainId,
    });

    if (!validation.ok) {
      setStatus('failed');
      toast.error((validation as { ok: false; error: string }).error);
      return;
    }

    try {
      setStatus('awaiting_signature');
      if (import.meta.env.DEV) {
        console.debug('[SendTab][event] signature_requested', { token });
      }

      const activeChainId = chainId && SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number]) ? chainId : bsc.id;
      setLastTxChainId(activeChainId);

      const { hash } = await sendAsset({
        token,
        recipient: recipient.trim() as `0x${string}`,
        amount: amount.trim(),
        chainId: activeChainId,
        account: address,
        sendNative: sendTransactionAsync,
        writeContract: writeContractWrapper,
      });

      setStatus('submitting');
      if (import.meta.env.DEV) {
        console.debug('[SendTab][event] tx_submitted', { hash, token });
      }
      setLastTxHash(hash);

      await persistTransaction(hash, 'pending');
      setStatus('pending_confirm');
      toast.success('Da gui giao dich. Dang cho xac nhan...');

      try {
        const receipt = await waitForTransactionReceipt(wagmiConfig, {
          hash,
          chainId: activeChainId as 1 | 56,
          confirmations: 1,
        });

        if ((receipt as any)?.status && (receipt as any).status !== 'success') {
          await persistTransaction(hash, 'failed');
          setStatus('failed');
          toast.error('Giao dich bi revert.');
          return;
        }

        await persistTransaction(hash, 'confirmed');
        setStatus('success');
        toast.success('Giao dich thanh cong.');
        if (import.meta.env.DEV) {
          console.debug('[SendTab][event] tx_confirmed', { hash, token });
        }
        resetForm();
      } catch (error) {
        await persistTransaction(hash, 'pending');
        setStatus('pending_confirm');
        toast.warning('Giao dich da gui. Dang cho xac nhan tren chuoi.');
      }
    } catch (error) {
      const msg = mapSendError(error);
      if (import.meta.env.DEV) {
        console.debug('[SendTab][event] tx_failed', { token, error: msg });
      }
      if ((error as any)?.code === 4001 && import.meta.env.DEV) {
        console.debug('[SendTab][event] signature_rejected');
      }
      setStatus('failed');
      toast.error(msg);
    }
  };

  const handleSwitchNetwork = () => {
    switchChain(
      { chainId: bsc.id },
      {
        onSuccess: () => toast.success('Da chuyen sang BNB Smart Chain.'),
        onError: () => toast.error('Khong the chuyen network. Vui long thu lai.'),
      }
    );
  };

  const refreshPendingStatus = async () => {
    if (!lastTxHash) return;
    try {
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash: lastTxHash,
        chainId: lastTxChainId as 1 | 56,
        confirmations: 1,
      });

      const receiptStatus = (receipt as any)?.status;
      if (receiptStatus && receiptStatus !== 'success') {
        await persistTransaction(lastTxHash, 'failed');
        setStatus('failed');
        toast.error('Giao dich bi revert.');
        return;
      }

      await persistTransaction(lastTxHash, 'confirmed');
      setStatus('success');
      toast.success('Giao dich da duoc xac nhan.');
      resetForm();
    } catch {
      toast.info('Giao dich van dang pending. Thu lai sau.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gui Crypto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Token</Label>
          <Select value={token} onValueChange={(value) => setToken(value as SendToken)}>
            <SelectTrigger>
              <SelectValue placeholder="Chon token" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BNB">BNB</SelectItem>
              <SelectItem value="USDT">USDT</SelectItem>
              <SelectItem value="BTCB">BTCB</SelectItem>
              <SelectItem value="CAMLY">CAMLY</SelectItem>
              <SelectItem value="FUN">FUN (Testnet - dang trien khai)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipient">Dia chi nguoi nhan</Label>
          <Input
            id="recipient"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount">So luong ({token})</Label>
            <span className="text-xs text-muted-foreground">
              {isBalanceLoading
                ? 'Đang tải...'
                : `Số dư: ${formatTokenBalance(currentBalance)} ${token}`}
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              id="amount"
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMax}
              disabled={isBalanceLoading || maxAmount <= 0 || isTokenDisabled}
              className="shrink-0 text-xs font-semibold px-3"
            >
              MAX
            </Button>
          </div>
          {token === 'BNB' && currentBalance > 0 && (
            <p className="text-xs text-muted-foreground">
              * MAX đã trừ {BNB_GAS_BUFFER} BNB dự phòng gas fee
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {isTokenDisabled ? FUN_TESTNET_NOTE : SEND_TRANSFER_NOTE}
        </p>

        {isWrongChain && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Dang sai network. Vui long chuyen sang BNB Smart Chain.
            <Button size="sm" variant="outline" className="ml-2" onClick={handleSwitchNetwork}>
              Switch Network
            </Button>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!isConnected || isBusy || isWrongChain || isTokenDisabled}
          className="w-full"
        >
          {statusLabel}
        </Button>

        {status === 'pending_confirm' && lastTxHash && (
          <Button variant="outline" className="w-full" onClick={refreshPendingStatus}>
            Refresh Trang Thai Giao Dich
          </Button>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xac nhan giao dich</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p>Token: <strong>{token}</strong></p>
              <p>So luong: <strong>{amount || '0'}</strong></p>
              <p>Nguoi nhan: <strong>{recipient}</strong></p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Huy</Button>
              <Button onClick={handleConfirmSend}>Xac nhan gui</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
