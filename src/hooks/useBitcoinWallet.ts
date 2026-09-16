import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '@/modules/wallet/bitcoin/bitcoinService';
import { BITCOIN_COINGECKO_ID } from '@/modules/wallet/bitcoin/constants';
import { formatSatsToBtc } from '@/modules/wallet/bitcoin/addressService';
import type {
  BitcoinAccount,
  BitcoinFeeOption,
  BroadcastBitcoinTransactionResult,
  CreateBitcoinTransactionInput,
  SignedBitcoinTransaction,
  UnsignedBitcoinTransaction,
} from '@/modules/wallet/bitcoin/types';

const STORAGE_KEY = 'fun_profile_btc_testnet_account';

function readStoredAccount(): BitcoinAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BitcoinAccount) : null;
  } catch {
    return null;
  }
}

export function useBitcoinWallet() {
  const [account, setAccount] = useState<BitcoinAccount | null>(() => readStoredAccount());
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (account) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [account]);

  const address = account?.address ?? null;

  const balanceQuery = useQuery({
    queryKey: ['bitcoin-balance', address],
    queryFn: () => bitcoinService.getBalance(address as string),
    enabled: !!address,
    staleTime: 30_000,
  });

  const utxoQuery = useQuery({
    queryKey: ['bitcoin-utxos', address],
    queryFn: () => bitcoinService.getUTXOs(address as string),
    enabled: !!address,
    staleTime: 30_000,
  });

  const feeOptionsQuery = useQuery({
    queryKey: ['bitcoin-fees'],
    queryFn: () => bitcoinService.getFeeOptions(),
    staleTime: 30_000,
  });

  const priceQuery = useQuery({
    queryKey: ['bitcoin-price'],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/price-proxy?ids=${encodeURIComponent(BITCOIN_COINGECKO_ID)}`,
        {
          headers: {
            apikey: anonKey,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Unable to fetch BTC price.');
      }

      const data = await response.json();
      return Number(data?.[BITCOIN_COINGECKO_ID]?.usd ?? 0);
    },
    staleTime: 60_000,
  });

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const nextAccount = await bitcoinService.generateWallet();
      setAccount(nextAccount);
      return nextAccount;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      balanceQuery.refetch(),
      utxoQuery.refetch(),
      feeOptionsQuery.refetch(),
      priceQuery.refetch(),
    ]);
  }, [balanceQuery, feeOptionsQuery, priceQuery, utxoQuery]);

  const createTransaction = useCallback(
    (input: CreateBitcoinTransactionInput): UnsignedBitcoinTransaction => bitcoinService.createTransaction(input),
    [],
  );

  const signTransaction = useCallback(
    (transaction: UnsignedBitcoinTransaction): Promise<SignedBitcoinTransaction> =>
      bitcoinService.signTransaction(transaction),
    [],
  );

  const broadcastTransaction = useCallback(
    (transaction: SignedBitcoinTransaction, fallbackPsbtBase64?: string): Promise<BroadcastBitcoinTransactionResult> =>
      bitcoinService.broadcastTransaction(transaction, fallbackPsbtBase64),
    [],
  );

  const feeOptions = feeOptionsQuery.data ?? ([] as BitcoinFeeOption[]);
  const btcBalance = balanceQuery.data?.totalSats ?? 0;
  const btcPrice = priceQuery.data ?? 0;
  const btcUsdValue = (btcBalance / 100_000_000) * btcPrice;

  return {
    account,
    address,
    balance: balanceQuery.data ?? null,
    utxos: utxoQuery.data ?? [],
    feeOptions,
    btcBalance,
    btcBalanceFormatted: formatSatsToBtc(btcBalance),
    btcUsdValue,
    btcPrice,
    isConnected: Boolean(account),
    isConnecting,
    isLoading:
      balanceQuery.isLoading || utxoQuery.isLoading || feeOptionsQuery.isLoading,
    isConnectorAvailable: bitcoinService.isConnectorAvailable(),
    connect,
    disconnect,
    refresh,
    createTransaction,
    signTransaction,
    broadcastTransaction,
    isRefetching:
      balanceQuery.isFetching ||
      utxoQuery.isFetching ||
      feeOptionsQuery.isFetching ||
      priceQuery.isFetching,
    error:
      balanceQuery.error ||
      utxoQuery.error ||
      feeOptionsQuery.error ||
      priceQuery.error ||
      null,
  };
}
