import * as bitcoin from 'bitcoinjs-lib';

const TESTNET = bitcoin.networks.testnet;

export function isValidBitcoinTestnetAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!trimmed || !trimmed.toLowerCase().startsWith('tb1')) {
    return false;
  }

  try {
    bitcoin.address.toOutputScript(trimmed, TESTNET);
    return true;
  } catch {
    return false;
  }
}

export function assertBitcoinTestnetAddress(address: string): string {
  const trimmed = address.trim();
  if (!isValidBitcoinTestnetAddress(trimmed)) {
    throw new Error('Invalid Bitcoin testnet SegWit address.');
  }
  return trimmed;
}

export function getBitcoinTestnetOutputScript(address: string): Uint8Array {
  return bitcoin.address.toOutputScript(assertBitcoinTestnetAddress(address), TESTNET);
}

export function formatSatsToBtc(sats: number, maximumFractionDigits = 8): string {
  return (sats / 100_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function parseBtcToSats(amount: string): number {
  const trimmed = amount.trim();
  if (!trimmed) {
    throw new Error('Amount is required.');
  }

  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) {
    throw new Error('Invalid BTC amount. Use up to 8 decimal places.');
  }

  const [wholePart, fractionalPart = ''] = trimmed.split('.');
  const sats = Number(wholePart) * 100_000_000 + Number(fractionalPart.padEnd(8, '0'));

  if (!Number.isFinite(sats) || sats <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  return sats;
}
