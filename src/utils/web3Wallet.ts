import { isAddress } from 'viem';

export type Web3Network = 'BSC' | 'ETH' | 'POLYGON';

export const WEB3_NETWORK_OPTIONS: Array<{ value: Web3Network; label: string }> = [
  { value: 'BSC', label: 'BSC (BNB Smart Chain)' },
  { value: 'ETH', label: 'ETH (Ethereum)' },
  { value: 'POLYGON', label: 'Polygon' },
];

export function normalizeWeb3Address(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  // Store in lowercase for stable comparisons/uniqueness.
  const lowered = trimmed.toLowerCase();

  // `isAddress` accepts lowercase addresses and validates hex length/format.
  if (!isAddress(lowered)) return null;

  return lowered;
}

export function isValidWeb3Address(input: string): boolean {
  return normalizeWeb3Address(input) !== null;
}

