import { useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { bsc } from 'wagmi/chains';
import { useReadContract } from 'wagmi';

// Token logos
import bnbLogo from '@/assets/tokens/bnb-logo.webp';
import usdtLogo from '@/assets/tokens/usdt-logo.webp';
import btcbLogo from '@/assets/tokens/btcb-logo.webp';
import camlyLogo from '@/assets/tokens/camly-logo.webp';
import { TOKEN_META } from '@/config/tokens';

// CoinGecko IDs for price fetching
const COINGECKO_IDS = {
  BNB: 'binancecoin',
  BTCB: 'bitcoin',
  USDT: 'tether',
  CAMLY: 'camly-coin',
};

// ERC20 ABI for balanceOf
const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export interface TokenBalance {
  symbol: string;
  name: string;
  icon: string;
  balance: number;
  price: number;
  usdValue: number;
  change24h: number;
  isLoading: boolean;
  contractAddress?: string;
  decimals: number;
}

interface PriceData {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

interface UseTokenBalancesOptions {
  customAddress?: `0x${string}` | null;
}

export const useTokenBalances = (options?: UseTokenBalancesOptions) => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [prices, setPrices] = useState<PriceData>({});
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [lastPrices, setLastPrices] = useState<PriceData>({});

  // Use custom address if provided, otherwise use connected wallet address
  const address = options?.customAddress || connectedAddress;

  // Native BNB balance
  const { data: bnbBalance, refetch: refetchBnb, isLoading: isBnbLoading } = useBalance({
    address,
    chainId: bsc.id,
  });

  // USDT balance
  const { data: usdtBalance, refetch: refetchUsdt, isLoading: isUsdtLoading } = useReadContract({
    address: TOKEN_META.USDT.address,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: bsc.id,
  });

  // BTCB balance
  const { data: btcbBalance, refetch: refetchBtcb, isLoading: isBtcbLoading } = useReadContract({
    address: TOKEN_META.BTCB.address,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: bsc.id,
  });

  // CAMLY balance (3 decimals)
  const { data: camlyBalance, refetch: refetchCamly, isLoading: isCamlyLoading } = useReadContract({
    address: TOKEN_META.CAMLY.address,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: bsc.id,
  });

  // Fetch prices from CoinGecko
  const fetchPrices = useCallback(async () => {
    try {
      setIsPriceLoading(true);
      const ids = Object.values(COINGECKO_IDS).join(',');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/price-proxy?ids=${encodeURIComponent(ids)}`,
        {
          headers: {
            'apikey': anonKey,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      
      const data = await response.json();
      
      // Map CoinGecko response to our format
      const priceData: PriceData = {
        BNB: data[COINGECKO_IDS.BNB] || lastPrices.BNB || { usd: 700, usd_24h_change: 0 },
        BTCB: data[COINGECKO_IDS.BTCB] || lastPrices.BTCB || { usd: 100000, usd_24h_change: 0 },
        USDT: data[COINGECKO_IDS.USDT] || lastPrices.USDT || { usd: 1, usd_24h_change: 0 },
        CAMLY: data[COINGECKO_IDS.CAMLY] || lastPrices.CAMLY || { usd: 0.000004, usd_24h_change: 0 },
      };
      
      setPrices(priceData);
      setLastPrices(priceData);
      setIsPriceLoading(false);
    } catch (error) {
      console.error('Error fetching prices:', error);
      // Use last known prices or fallback
      if (Object.keys(lastPrices).length > 0) {
        setPrices(lastPrices);
      } else {
        // Fallback prices
        setPrices({
          BNB: { usd: 700, usd_24h_change: 0 },
          BTCB: { usd: 100000, usd_24h_change: 0 },
          USDT: { usd: 1, usd_24h_change: 0 },
          CAMLY: { usd: 0.000004, usd_24h_change: 0 },
        });
      }
      setIsPriceLoading(false);
    }
  }, [lastPrices]);

  // Initial price fetch and 30-second interval
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Parse token balances
  const parseBalance = (value: bigint | undefined, decimals: number): number => {
    if (!value) return 0;
    return parseFloat(formatUnits(value, decimals));
  };

  // Calculate balances
  const bnbAmount = bnbBalance ? parseFloat(bnbBalance.formatted) : 0;
  const usdtAmount = parseBalance(usdtBalance as bigint | undefined, TOKEN_META.USDT.decimals);
  const btcbAmount = parseBalance(btcbBalance as bigint | undefined, TOKEN_META.BTCB.decimals);
  const camlyAmount = parseBalance(camlyBalance as bigint | undefined, TOKEN_META.CAMLY.decimals);

  // Build tokens array with real data
  const tokens: TokenBalance[] = [
    {
      symbol: 'BNB',
      name: 'BNB',
      icon: bnbLogo,
      balance: bnbAmount,
      price: prices.BNB?.usd || 700,
      usdValue: bnbAmount * (prices.BNB?.usd || 700),
      change24h: prices.BNB?.usd_24h_change || 0,
      isLoading: isBnbLoading || isPriceLoading,
      decimals: 18,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      icon: usdtLogo,
      balance: usdtAmount,
      price: prices.USDT?.usd || 1,
      usdValue: usdtAmount * (prices.USDT?.usd || 1),
      change24h: prices.USDT?.usd_24h_change || 0,
      isLoading: isUsdtLoading || isPriceLoading,
      contractAddress: TOKEN_META.USDT.address,
      decimals: TOKEN_META.USDT.decimals,
    },
    {
      symbol: 'BTCB',
      name: 'Bitcoin BEP20',
      icon: btcbLogo,
      balance: btcbAmount,
      price: prices.BTCB?.usd || 100000,
      usdValue: btcbAmount * (prices.BTCB?.usd || 100000),
      change24h: prices.BTCB?.usd_24h_change || 0,
      isLoading: isBtcbLoading || isPriceLoading,
      contractAddress: TOKEN_META.BTCB.address,
      decimals: TOKEN_META.BTCB.decimals,
    },
    {
      symbol: 'CAMLY',
      name: 'Camly Coin',
      icon: camlyLogo,
      balance: camlyAmount,
      price: prices.CAMLY?.usd || 0.000004,
      usdValue: camlyAmount * (prices.CAMLY?.usd || 0.000004),
      change24h: prices.CAMLY?.usd_24h_change || 0,
      isLoading: isCamlyLoading || isPriceLoading,
      contractAddress: TOKEN_META.CAMLY.address,
      decimals: TOKEN_META.CAMLY.decimals,
    },
  ];

  const totalUsdValue = tokens.reduce((sum, token) => sum + token.usdValue, 0);
  const isLoading = isBnbLoading || isUsdtLoading || isBtcbLoading || isCamlyLoading || isPriceLoading;

  const refetch = useCallback(() => {
    refetchBnb();
    refetchUsdt();
    refetchBtcb();
    refetchCamly();
    fetchPrices();
  }, [refetchBnb, refetchUsdt, refetchBtcb, refetchCamly, fetchPrices]);

  return {
    tokens,
    totalUsdValue,
    isLoading,
    refetch,
    prices,
    isConnected,
  };
};
