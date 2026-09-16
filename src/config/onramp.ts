const defaultMoonPayBaseUrl = 'https://buy.moonpay.com';

export const MOONPAY_BASE_URL = (
  import.meta.env.VITE_MOONPAY_BASE_URL || defaultMoonPayBaseUrl
).trim().replace(/\/+$/, '');

export const MOONPAY_API_KEY = (import.meta.env.VITE_MOONPAY_API_KEY || '').trim();

export const MOONPAY_ENABLED_TOKENS = ['BNB', 'USDT'] as const;
export type MoonPayEnabledToken = (typeof MOONPAY_ENABLED_TOKENS)[number];

export const MOONPAY_NETWORK_CODE = 'bsc';
export const MOONPAY_DEFAULT_LANGUAGE = 'vi';

