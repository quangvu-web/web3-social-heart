import { isAddress } from 'viem';
import {
  MOONPAY_API_KEY,
  MOONPAY_BASE_URL,
  MOONPAY_DEFAULT_LANGUAGE,
  MOONPAY_ENABLED_TOKENS,
  MOONPAY_NETWORK_CODE,
  type MoonPayEnabledToken,
} from '@/config/onramp';

export type BuyToken = MoonPayEnabledToken;

type MoonPayCurrencyCode = 'bnb_bsc' | 'usdt_bsc';

const MOONPAY_TOKEN_MAP: Record<BuyToken, MoonPayCurrencyCode> = {
  BNB: 'bnb_bsc',
  USDT: 'usdt_bsc',
};

export type BuyContext = {
  isConnected?: boolean;
  chainId?: number | null;
  address?: string | null;
};

export function validateBuyContext(ctx: BuyContext): { ok: true } | { ok: false; error: string } {
  if (!ctx.isConnected) return { ok: false, error: 'Vui long ket noi vi truoc khi mua crypto.' };
  if (ctx.chainId !== 56) return { ok: false, error: 'Vui long chuyen sang BNB Smart Chain (56).' };
  if (!ctx.address || !isAddress(ctx.address)) return { ok: false, error: 'Dia chi vi khong hop le.' };
  return { ok: true };
}

export type BuildMoonPayBuyUrlParams = {
  token: BuyToken;
  walletAddress: string;
  chainId?: number | null;
  language?: string;
};

export function buildMoonPayBuyUrl(params: BuildMoonPayBuyUrlParams): string {
  const currencyCode = MOONPAY_TOKEN_MAP[params.token];
  const url = new URL(MOONPAY_BASE_URL);
  url.searchParams.set('currencyCode', currencyCode);
  url.searchParams.set('walletAddress', params.walletAddress);
  url.searchParams.set('networkCode', MOONPAY_NETWORK_CODE);
  url.searchParams.set('language', params.language || MOONPAY_DEFAULT_LANGUAGE);

  if (params.chainId === 56) {
    url.searchParams.set('chainId', '56');
  }

  if (MOONPAY_API_KEY) {
    url.searchParams.set('apiKey', MOONPAY_API_KEY);
  }

  return url.toString();
}

export function mapBuyError(error: unknown): string {
  if (!error) return 'Khong the mo cong thanh toan Buy.';
  const e = error as { message?: string; shortMessage?: string };
  const text = `${e.shortMessage || ''} ${e.message || ''}`.toLowerCase();
  if (text.includes('popup') || text.includes('blocked')) {
    return 'Trinh duyet dang chan popup. Vui long cho phep mo tab moi.';
  }
  return e.shortMessage || e.message || 'Khong the mo cong thanh toan Buy.';
}

export { MOONPAY_ENABLED_TOKENS };

