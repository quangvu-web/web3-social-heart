const defaultZeroXBaseUrl = 'https://api.0x.org';

export const ZEROX_API_BASE_URL = (
  import.meta.env.VITE_ZEROX_API_BASE_URL || defaultZeroXBaseUrl
).trim().replace(/\/+$/, '');

export const ZEROX_API_KEY = (import.meta.env.VITE_ZEROX_API_KEY || '').trim();

export const SWAP_CHAIN_ID = 56;
export const SWAP_SLIPPAGE_BPS_DEFAULT = 100; // 1.0%
export const SWAP_QUOTE_TTL_MS = 30_000;

