// Central token metadata for BSC (and future chains if needed).
// Keep this file small and dependency-free.

export const TOKEN_META = {
  USDT: {
    address: '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`,
    decimals: 18,
  },
  BTCB: {
    address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' as `0x${string}`,
    decimals: 18,
  },
  CAMLY: {
    address: '0x0910320181889feFDE0BB1Ca63962b0A8882e413' as `0x${string}`,
    decimals: 3,
  },
} as const;

export type Erc20TokenSymbol = keyof typeof TOKEN_META;

