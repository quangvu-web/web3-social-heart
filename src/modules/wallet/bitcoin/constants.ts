import type { BitcoinNetwork } from './types';

export const BITCOIN_NETWORK: BitcoinNetwork = 'BTC_TESTNET';
export const BITCOIN_NETWORK_LABEL = 'Bitcoin Testnet';
export const BITCOIN_SYMBOL = 'BTC';
export const BITCOIN_COINGECKO_ID = 'bitcoin';
export const BITCOIN_DUST_LIMIT_SATS = 546;
export const BITCOIN_DEFAULT_SNAP_ID =
  import.meta.env.VITE_BITCOIN_SNAP_ID || 'npm:@metamask/bitcoin-wallet-snap';

export const BITCOIN_TESTNET_EXPLORER_BASE_URL = 'https://mempool.space/testnet';

export const BITCOIN_API_BASES = [
  'https://mempool.space/testnet/api',
  'https://blockstream.info/testnet/api',
] as const;
