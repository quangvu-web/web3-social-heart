import { isMobileDevice } from './mobileWalletConnect';

/** Detect if running inside MetaMask mobile dApp browser */
export function isMetaMaskMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const eth = (window as any).ethereum;
  return Boolean(eth?.isMetaMask) && isMobileDevice();
}

/** Keys to remove from localStorage on disconnect */
const EXACT_KEYS = [
  'fun_wallet_auth_flow',
  'walletconnect',
  'WEB3_CONNECT_CACHED_PROVIDER',
  'wagmi.store',
  'wagmi.connected',
  'wagmi.wallet',
  'wagmi.recentConnectorId',
];

const PREFIX_PATTERNS = ['wc@', 'rk-', 'wagmi.'];

/** Clear all wallet-related localStorage entries */
export function clearWalletLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;

  // Remove exact keys
  for (const key of EXACT_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  // Remove prefixed keys
  const allKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) allKeys.push(k);
  }

  for (const key of allKeys) {
    if (PREFIX_PATTERNS.some((p) => key.startsWith(p))) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  }
}

/**
 * Full wallet disconnect: calls wagmi disconnect, clears cached data,
 * and force-reloads on mobile MetaMask to reset the injected provider.
 */
export async function fullWalletDisconnect(
  wagmiDisconnect: () => void
): Promise<void> {
  // 1. Call wagmi disconnect
  try { wagmiDisconnect(); } catch { /* ignore */ }

  // 2. Clear all cached wallet data
  clearWalletLocalStorage();

  // 3. On mobile MetaMask, force reload to fully reset provider
  if (isMetaMaskMobileBrowser()) {
    await new Promise((r) => setTimeout(r, 300));
    window.location.reload();
  }
}

/**
 * Force a fresh eth_requestAccounts call, bypassing cached accounts.
 */
export async function forceRequestAccounts(): Promise<string[] | null> {
  if (typeof window === 'undefined') return null;
  const eth = (window as any).ethereum;
  if (!eth?.request) return null;

  try {
    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    return accounts as string[];
  } catch {
    return null;
  }
}

export interface WalletSwitchResult {
  switched: boolean;
  newAddress: string | null;
  cancelled: boolean;
  /** True when provider doesn't support wallet_requestPermissions (common on MetaMask mobile) */
  fallbackUsed: boolean;
}

/**
 * Request MetaMask to open its account chooser so user can switch wallet.
 *
 * MetaMask mobile often cannot force an account picker from the dapp browser.
 * In that case we fall back to `eth_requestAccounts`, which may return the same
 * account. The UI must guide the user to switch accounts manually inside the
 * wallet app instead of auto-retrying another signature request.
 *
 * Strategy:
 * 1. Try `wallet_requestPermissions` with `eth_accounts` — this is the only
 *    reliable way to force MetaMask desktop to re-show the account picker.
 * 2. If that fails (MetaMask mobile often doesn't support it fully), fall back
 *    to `eth_requestAccounts` which may or may not show a chooser.
 * 3. Compare returned address with the previously connected one.
 *
 * @param currentAddress - the currently connected address (lowercase) to detect actual switch
 */
export async function requestWalletSwitch(
  currentAddress?: string | null
): Promise<WalletSwitchResult> {
  if (typeof window === 'undefined') {
    return { switched: false, newAddress: null, cancelled: false, fallbackUsed: false };
  }

  const eth = (window as any).ethereum;
  if (!eth?.request) {
    return { switched: false, newAddress: null, cancelled: false, fallbackUsed: false };
  }

  const normalizedCurrent = currentAddress?.toLowerCase() ?? null;
  let fallbackUsed = false;

  try {
    // --- Desktop path: wallet_requestPermissions opens account chooser ---
    await eth.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });

    // After permissions granted, fetch the newly selected account
    const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
    const newAddr = accounts[0]?.toLowerCase() ?? null;

    return {
      switched: newAddr !== normalizedCurrent,
      newAddress: newAddr,
      cancelled: false,
      fallbackUsed: false,
    };
  } catch (permError: any) {
    // User rejected the permission request
    const code = permError?.code;
    if (code === 4001) {
      return { switched: false, newAddress: null, cancelled: true, fallbackUsed: false };
    }

    // --- Mobile fallback: wallet_requestPermissions not supported ---
    // MetaMask mobile may throw "Method not supported" or similar.
    // Fall back to eth_requestAccounts which might still trigger a chooser.
    fallbackUsed = true;

    try {
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      const newAddr = accounts[0]?.toLowerCase() ?? null;

      return {
        switched: newAddr !== normalizedCurrent,
        newAddress: newAddr,
        cancelled: false,
        fallbackUsed: true,
      };
    } catch (reqError: any) {
      if (reqError?.code === 4001) {
        return { switched: false, newAddress: null, cancelled: true, fallbackUsed: true };
      }
      return { switched: false, newAddress: null, cancelled: false, fallbackUsed: true };
    }
  }
}
