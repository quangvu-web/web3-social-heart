import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useSendTransaction, useSwitchChain, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { bsc } from 'wagmi/chains';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { config as wagmiConfig } from '@/config/web3';
import { SWAP_CHAIN_ID } from '@/config/swap';
import {
  executeSwap,
  formatSwapAmount,
  getSwapQuote,
  isSwapTokenDisabled,
  mapSwapError,
  quoteExpired,
  requiresApproval,
  type SwapQuoteResult,
  type SwapStatus,
  type SwapToken,
  approveToken,
} from '@/modules/wallet/services/swapAsset';
import { FUN_TESTNET_NOTE } from '@/modules/wallet/services/sendAsset';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { formatTokenBalance } from '@/lib/formatters';

interface SwapTabProps {
  initialSellToken?: SwapToken;
  initialBuyToken?: SwapToken;
  onSwapSuccess?: () => void;
}

const SWAP_TOKENS: SwapToken[] = ['BNB', 'USDT', 'BTCB', 'CAMLY', 'FUN'];

export const SwapTab = ({ initialSellToken, initialBuyToken, onSwapSuccess }: SwapTabProps) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [sellToken, setSellToken] = useState<SwapToken>(initialSellToken ?? 'BNB');
  const [buyToken, setBuyToken] = useState<SwapToken>(initialBuyToken ?? 'USDT');
  const [sellAmount, setSellAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  // Token balances for sell token display
  const { tokens } = useTokenBalances();
  const currentSellTokenData = tokens.find(t => t.symbol === sellToken);
  const currentSellBalance = currentSellTokenData?.balance ?? 0;
  const isSellBalanceLoading = currentSellTokenData?.isLoading ?? false;

  const isBusy = status !== 'idle' && status !== 'success' && status !== 'failed';
  const isWrongChain = chainId !== SWAP_CHAIN_ID;
  const tokenDisabled = isSwapTokenDisabled(sellToken) || isSwapTokenDisabled(buyToken);
  const sameToken = sellToken === buyToken;
  const amountInvalid = !sellAmount.trim() || Number(sellAmount) <= 0;

  useEffect(() => {
    setSellToken(initialSellToken ?? 'BNB');
  }, [initialSellToken]);

  useEffect(() => {
    setBuyToken(initialBuyToken ?? 'USDT');
  }, [initialBuyToken]);

  useEffect(() => {
    if (sellToken === buyToken) {
      setQuote(null);
      setQuoteError('Token nguon va token dich khong duoc giong nhau.');
      return;
    }

    if (!isConnected || !address || isWrongChain || tokenDisabled || amountInvalid) {
      setQuote(null);
      if (tokenDisabled) {
        setQuoteError(FUN_TESTNET_NOTE);
      } else {
        setQuoteError(null);
      }
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsQuoting(true);
      setStatus('quoting');
      setQuoteError(null);
      try {
        const nextQuote = await getSwapQuote({
          sellToken,
          buyToken,
          sellAmount: sellAmount.trim(),
          taker: address,
        });
        setQuote(nextQuote);
        setStatus('idle');
      } catch (error) {
        setQuote(null);
        setStatus('failed');
        setQuoteError(mapSwapError(error));
      } finally {
        setIsQuoting(false);
      }
    }, 550);

    return () => window.clearTimeout(timer);
  }, [address, amountInvalid, buyToken, isConnected, isWrongChain, sellAmount, sellToken, tokenDisabled]);

  const needsApproval = useMemo(() => {
    if (!quote) return false;
    return requiresApproval({ quote, sellToken });
  }, [quote, sellToken]);

  const mainButtonLabel = useMemo(() => {
    if (isQuoting) return 'Đang báo giá...';
    if (needsApproval) return `Approve ${sellToken}`;
    if (status === 'awaiting_swap_signature') return 'Đang chờ ký swap...';
    if (status === 'awaiting_approval_signature') return 'Đang chờ ký approve...';
    if (status === 'submitting' || status === 'approving' || status === 'pending_confirm') return 'Đang xử lý...';
    return 'Swap';
  }, [isQuoting, needsApproval, sellToken, status]);

  const swapDisabled = !isConnected || isWrongChain || isBusy || isQuoting || sameToken || amountInvalid || tokenDisabled || !quote;

  const persistTransaction = async (
    txHash: `0x${string}`,
    txStatus: 'pending' | 'confirmed' | 'failed',
    kind: 'swap' | 'approve'
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    const symbol = kind === 'swap' ? `SWAP ${sellToken}->${buyToken}` : `APPROVE ${sellToken}`;

    if (txStatus === 'pending') {
      await supabase.from('transactions').insert({
        user_id: user.id,
        tx_hash: txHash,
        from_address: address,
        to_address: quote?.tx.to || null,
        amount: sellAmount.trim(),
        token_symbol: symbol,
        chain_id: SWAP_CHAIN_ID,
        status: 'pending',
      });
      return;
    }

    await supabase
      .from('transactions')
      .update({ status: txStatus })
      .eq('tx_hash', txHash)
      .eq('user_id', user.id);
  };

  const waitForConfirmation = async (
    txHash: `0x${string}`,
    kind: 'swap' | 'approve'
  ): Promise<boolean> => {
    try {
      setStatus('pending_confirm');
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash: txHash,
        chainId: SWAP_CHAIN_ID,
        confirmations: 1,
      });

      if ((receipt as { status?: string }).status && (receipt as { status?: string }).status !== 'success') {
        await persistTransaction(txHash, 'failed', kind);
        setStatus('failed');
        toast.error('Giao dịch bị revert.');
        return false;
      }

      await persistTransaction(txHash, 'confirmed', kind);
      setStatus('success');
      return true;
    } catch {
      await persistTransaction(txHash, 'pending', kind);
      setStatus('pending_confirm');
      toast.warning('Giao dịch đã gửi. Đang chờ xác nhận trên chuỗi.');
      return false;
    }
  };

  const handleApprove = async () => {
    if (!quote || !address) return;
    if (!quote.allowanceTarget) {
      toast.error('Không tìm thấy allowance target từ quote.');
      return;
    }

    try {
      setStatus('awaiting_approval_signature');
      const { hash } = await approveToken({
        writeContract: (args) => writeContractAsync(args as never),
        token: sellToken,
        spender: quote.allowanceTarget,
        amount: BigInt(quote.sellAmount),
        account: address,
      });
      setLastTxHash(hash);
      setStatus('approving');
      await persistTransaction(hash, 'pending', 'approve');
      toast.success(`Đã gửi approve ${sellToken}.`);

      const ok = await waitForConfirmation(hash, 'approve');
      if (ok) {
        const refreshed = await getSwapQuote({
          sellToken,
          buyToken,
          sellAmount: sellAmount.trim(),
          taker: address,
        });
        setQuote(refreshed);
        setStatus('idle');
        toast.success('Approve thành công. Bạn có thể swap ngay bây giờ.');
      }
    } catch (error) {
      setStatus('failed');
      toast.error(mapSwapError(error));
    }
  };

  const handleSwap = async () => {
    if (!quote || !address) return;
    if (quoteExpired(quote)) {
      toast.error('Quote đã hết hạn, vui lòng đợi báo giá mới.');
      setQuote(null);
      return;
    }

    try {
      setStatus('awaiting_swap_signature');
      const { hash } = await executeSwap({
        sendTransaction: sendTransactionAsync,
        quote,
        account: address,
      });
      setLastTxHash(hash);
      setStatus('submitting');
      await persistTransaction(hash, 'pending', 'swap');
      toast.success('Đã gửi giao dịch swap.');

      const ok = await waitForConfirmation(hash, 'swap');
      if (ok) {
        toast.success('Swap thành công.');
        onSwapSuccess?.();
      }
    } catch (error) {
      setStatus('failed');
      toast.error(mapSwapError(error));
    }
  };

  const handleAction = async () => {
    if (swapDisabled) return;
    if (needsApproval) {
      await handleApprove();
      return;
    }
    await handleSwap();
  };

  const handleSwitchNetwork = () => {
    switchChain(
      { chainId: bsc.id },
      {
        onSuccess: () => toast.success('Đã chuyển sang BNB Smart Chain.'),
        onError: () => toast.error('Không thể chuyển network. Vui lòng thử lại.'),
      }
    );
  };

  const handleRefreshPending = async () => {
    if (!lastTxHash) return;
    try {
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash: lastTxHash,
        chainId: SWAP_CHAIN_ID,
        confirmations: 1,
      });
      if ((receipt as { status?: string }).status && (receipt as { status?: string }).status !== 'success') {
        setStatus('failed');
        toast.error('Giao dịch bị revert.');
        return;
      }
      setStatus('success');
      onSwapSuccess?.();
      toast.success('Giao dịch đã được xác nhận.');
    } catch {
      toast.info('Giao dịch vẫn đang pending. Thử lại sau.');
    }
  };

  const estimatedReceive = quote ? formatSwapAmount(buyToken, quote.buyAmount) : '--';
  const minReceive = quote ? formatSwapAmount(buyToken, quote.minReceived) : '--';

  return (
    <div className="space-y-4">
      {/* From Token */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>From</Label>
          <span className="text-xs text-muted-foreground">
            {isSellBalanceLoading
              ? 'Đang tải...'
              : `Số dư: ${formatTokenBalance(currentSellBalance)} ${sellToken}`}
          </span>
        </div>
        <Select value={sellToken} onValueChange={(value) => setSellToken(value as SwapToken)}>
          <SelectTrigger>
            <SelectValue placeholder="Chọn token nguồn" />
          </SelectTrigger>
          <SelectContent>
            {SWAP_TOKENS.map((token) => (
              <SelectItem key={token} value={token}>
                {token === 'FUN' ? 'FUN (Testnet - đang triển khai)' : token}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sell Amount */}
      <div className="space-y-2">
        <Label htmlFor="swap-amount">Số lượng ({sellToken})</Label>
        <Input
          id="swap-amount"
          type="number"
          min="0"
          placeholder="0.0"
          value={sellAmount}
          onChange={(e) => setSellAmount(e.target.value)}
        />
      </div>

      {/* To Token */}
      <div className="space-y-2">
        <Label>To</Label>
        <Select value={buyToken} onValueChange={(value) => setBuyToken(value as SwapToken)}>
          <SelectTrigger>
            <SelectValue placeholder="Chọn token đích" />
          </SelectTrigger>
          <SelectContent>
            {SWAP_TOKENS.map((token) => (
              <SelectItem key={token} value={token}>
                {token === 'FUN' ? 'FUN (Testnet - đang triển khai)' : token}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quote Info */}
      <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/20">
        <p>Nhận ước tính: <strong>{estimatedReceive} {buyToken}</strong></p>
        <p>Tối thiểu nhận (1.0% slippage): <strong>{minReceive} {buyToken}</strong></p>
        {quote?.estimatedGas && <p>Gas ước tính: <strong>{quote.estimatedGas}</strong></p>}
      </div>

      {/* Warnings */}
      {tokenDisabled && (
        <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground">
          {FUN_TESTNET_NOTE}
        </div>
      )}

      {isWrongChain && (
        <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground flex items-center flex-wrap gap-2">
          <span>Đang sai network. Vui lòng chuyển sang BNB Smart Chain.</span>
          <Button size="sm" variant="outline" onClick={handleSwitchNetwork}>
            Switch Network
          </Button>
        </div>
      )}

      {quoteError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {quoteError}
        </div>
      )}

      {/* Action Button */}
      <Button onClick={handleAction} disabled={swapDisabled} className="w-full">
        {mainButtonLabel}
      </Button>

      {status === 'pending_confirm' && lastTxHash && (
        <Button variant="outline" className="w-full" onClick={handleRefreshPending}>
          Làm mới trạng thái giao dịch
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Swap trên BSC Mainnet (chainId 56). FUN hiển thị theo roadmap và tạm thời chưa bật swap.
      </p>
    </div>
  );
};
