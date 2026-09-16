import { bsc, mainnet } from 'wagmi/chains';

type OpenConnectModal = (() => void) | undefined;
export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
};

type WagmiConnectorLike = {
  name?: string;
  getProvider?: () => Promise<unknown> | unknown;
};

const bscRpcUrl = (import.meta.env.VITE_BSC_RPC_URL || 'https://bsc-dataseed.binance.org').trim();
const BSC_TESTNET_RPC_URL = 'https://data-seed-prebsc-1-s1.binance.org:8545';

export const SUPPORTED_CHAIN_IDS = [bsc.id, 97, mainnet.id] as const;
export const PWA_RECONNECT_HINT = 'Refresh trang hoac Disconnect -> Connect lai tu wallet app.';
export const MODAL_OPEN_FAILED_HINT = 'Khong the mo modal ket noi vi. Vui long thu lai.';

type NetworkResolveDebugContext = {
  connectorName?: string;
  isPwa: boolean;
  reason?: string;
};

const CHAIN_PARAMS: Record<number, {
  chainIdHex: string;
  chainName: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  56: {
    chainIdHex: '0x38',
    chainName: 'BNB Smart Chain',
    rpcUrls: [bscRpcUrl],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  97: {
    chainIdHex: '0x61',
    chainName: 'BNB Smart Chain Testnet',
    rpcUrls: [BSC_TESTNET_RPC_URL],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
  },
};

export function isInjectedAvailable(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined';
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneDisplayMode = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const isIosStandalone = Boolean((window.navigator as any)?.standalone);
  return Boolean(isStandaloneDisplayMode || isIosStandalone);
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isMetaMaskMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const eth = (window as any).ethereum;
  return Boolean(eth?.isMetaMask) && isMobileDevice();
}

export function isTrustWalletMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const eth = (window as any).ethereum;
  return Boolean(eth?.isTrust || eth?.isTrustWallet) && isMobileDevice();
}

export function getInjectedProvider(): Eip1193Provider | null {
  if (!isInjectedAvailable()) return null;
  return (window as any).ethereum as Eip1193Provider;
}

export function isInjectedMobileBrowser(): boolean {
  return isMetaMaskMobileBrowser() || isTrustWalletMobileBrowser();
}

export function getInjectedMobileBrowserType(): 'metamask' | 'trustwallet' | 'unknown' {
  const provider = getInjectedProvider();
  if (!provider) return 'unknown';
  if (provider.isMetaMask) return 'metamask';
  if (provider.isTrust || provider.isTrustWallet) return 'trustwallet';
  return 'unknown';
}

export function getMetaMaskDeepLink(): string {
  if (typeof window === 'undefined') return '';
  return `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
}

export function connectWalletViaRainbowModal(openConnectModal: OpenConnectModal): boolean {
  if (!openConnectModal) return false;
  openConnectModal();
  return true;
}

export async function resolveWalletProvider(connector?: WagmiConnectorLike | null): Promise<Eip1193Provider | null> {
  if (connector?.getProvider) {
    const provider = await connector.getProvider();
    if (provider && typeof provider === 'object' && 'request' in provider) {
      return provider as Eip1193Provider;
    }
  }

  if (isInjectedAvailable()) {
    return (window as any).ethereum as Eip1193Provider;
  }

  return null;
}

export async function getInjectedAccounts(provider?: Eip1193Provider | null): Promise<string[]> {
  const eth = provider ?? getInjectedProvider();
  if (!eth) return [];
  try {
    const accounts = await eth.request({ method: 'eth_accounts' });
    return Array.isArray(accounts) ? (accounts as string[]) : [];
  } catch {
    return [];
  }
}

export async function requestInjectedAccounts(provider?: Eip1193Provider | null): Promise<string[]> {
  const eth = provider ?? getInjectedProvider();
  if (!eth) return [];
  const accounts = await eth.request({ method: 'eth_requestAccounts' });
  return Array.isArray(accounts) ? (accounts as string[]) : [];
}

export function normalizeChainId(rawChainId: unknown): number | null {
  if (typeof rawChainId === 'number' && Number.isFinite(rawChainId)) {
    return rawChainId;
  }

  if (typeof rawChainId !== 'string') return null;
  const value = rawChainId.trim();
  if (!value) return null;

  if (value.startsWith('0x') || value.startsWith('0X')) {
    const parsedHex = Number.parseInt(value, 16);
    return Number.isFinite(parsedHex) ? parsedHex : null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getChainId(provider: Eip1193Provider | null | undefined): Promise<number | null> {
  if (!provider) return null;
  try {
    const raw = await provider.request({ method: 'eth_chainId' });
    return normalizeChainId(raw);
  } catch {
    return null;
  }
}

export function isSupportedChain(chainId: number | null | undefined): boolean {
  if (!chainId) return false;
  return SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number]);
}

export function formatNetworkResolveDebug(context: NetworkResolveDebugContext): string {
  const connector = context.connectorName || 'unknown';
  const reason = context.reason || 'unknown';
  const pwa = context.isPwa ? 'standalone' : 'browser';
  return `[DEV] Chain resolve failed (${reason}). connector=${connector}, mode=${pwa}. Try refresh/reconnect.`;
}

type EnsureBscParams = {
  provider?: Eip1193Provider | null;
  preferredChainId?: number;
};

function getErrorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string') {
    const parsed = Number.parseInt(code, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function switchToChain(provider: Eip1193Provider, targetChainId: number): Promise<boolean> {
  const chainConfig = CHAIN_PARAMS[targetChainId] || CHAIN_PARAMS[bsc.id];
  const chainIdHex = chainConfig?.chainIdHex || `0x${targetChainId.toString(16)}`;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
    return true;
  } catch (error) {
    if (getErrorCode(error) !== 4902) return false;

    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: chainConfig.chainName,
          nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
          rpcUrls: chainConfig.rpcUrls,
          blockExplorerUrls: chainConfig.blockExplorerUrls,
        }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

export async function ensureBscNetwork(params: EnsureBscParams): Promise<{ ok: boolean; chainId: number | null; error?: string }> {
  const provider = params.provider;
  const preferredChainId = params.preferredChainId ?? bsc.id;

  if (!provider) {
    return { ok: false, chainId: null, error: 'Wallet provider not available' };
  }

  const currentChainId = await getChainId(provider);
  if (isSupportedChain(currentChainId)) {
    return { ok: true, chainId: currentChainId };
  }

  const switched = await switchToChain(provider, preferredChainId);
  if (!switched) {
    return { ok: false, chainId: currentChainId, error: 'Failed to switch chain' };
  }

  const latestChainId = await getChainId(provider);
  if (!isSupportedChain(latestChainId)) {
    return { ok: false, chainId: latestChainId, error: 'Switched chain is still unsupported' };
  }

  return { ok: true, chainId: latestChainId };
}

export async function requestWalletAccountSwitch(): Promise<boolean> {
  if (!isInjectedAvailable()) return false;
  try {
    await (window as any).ethereum.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
    return true;
  } catch {
    return false;
  }
}

export function getTrustWalletDeepLink(): string {
  if (typeof window === 'undefined') return '';
  const url = encodeURIComponent(`${window.location.origin}${window.location.pathname}`);
  return `https://link.trustwallet.com/open_url?coin_id=20000714&url=${url}`;
}

export function getWalletAppLinks() {
  return {
    metamask: {
      android: 'https://play.google.com/store/apps/details?id=io.metamask',
      ios: 'https://apps.apple.com/app/metamask/id1438144202',
    },
    trustWallet: {
      android: 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp',
      ios: 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409',
    },
  };
}

export function getChainName(chainId: number | null | undefined): string {
  if (!chainId) return 'Unknown';
  const names: Record<number, string> = {
    1: 'Ethereum',
    56: 'BNB Smart Chain',
    97: 'BSC Testnet',
    137: 'Polygon',
    43114: 'Avalanche',
    42161: 'Arbitrum',
    10: 'Optimism',
  };
  return names[chainId] || `Chain ${chainId}`;
}
