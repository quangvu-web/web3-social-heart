import { BITCOIN_DEFAULT_SNAP_ID, BITCOIN_NETWORK } from './constants';
import { assertBitcoinTestnetAddress } from './addressService';
import type { BitcoinConnector } from './connector';
import type { BitcoinAccount, SignedBitcoinTransaction, UnsignedBitcoinTransaction } from './types';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<any>;
};

type SnapRequestShape = {
  method: string;
  params?: Record<string, unknown>;
};

const ACCOUNT_METHOD_CANDIDATES: SnapRequestShape[] = [
  { method: 'bitcoin_getAccount', params: { network: 'testnet' } },
  { method: 'btc_getAccount', params: { network: 'testnet' } },
  { method: 'getAccount', params: { network: 'testnet' } },
  {
    method: 'submitRequest',
    params: {
      method: 'bitcoin_getAccount',
      params: { network: 'testnet' },
    },
  },
];

function buildSignCandidates(psbtBase64: string): SnapRequestShape[] {
  return [
    { method: 'bitcoin_signPsbt', params: { network: 'testnet', psbt: psbtBase64 } },
    { method: 'bitcoin_signPsbt', params: { network: 'testnet', psbtBase64 } },
    { method: 'btc_signPsbt', params: { network: 'testnet', psbt: psbtBase64 } },
    { method: 'signPsbt', params: { network: 'testnet', psbt: psbtBase64 } },
    {
      method: 'submitRequest',
      params: {
        method: 'bitcoin_signPsbt',
        params: { network: 'testnet', psbt: psbtBase64 },
      },
    },
  ];
}

export class MetaMaskSnapBitcoinConnector implements BitcoinConnector {
  constructor(private readonly snapId = BITCOIN_DEFAULT_SNAP_ID) {}

  isAvailable(): boolean {
    return Boolean(this.getProvider());
  }

  async isInstalled(): Promise<boolean> {
    const provider = this.requireProvider();
    const snaps = await provider.request({ method: 'wallet_getSnaps' });
    return Boolean(snaps?.[this.snapId]);
  }

  async generateWallet(): Promise<BitcoinAccount> {
    await this.ensureInstalled();
    const result = await this.invokeCandidates(ACCOUNT_METHOD_CANDIDATES);
    return this.normalizeAccount(result);
  }

  async signTransaction(transaction: UnsignedBitcoinTransaction): Promise<SignedBitcoinTransaction> {
    await this.ensureInstalled();
    const result = await this.invokeCandidates(buildSignCandidates(transaction.psbtBase64));
    return this.normalizeSignedTransaction(result);
  }

  private getProvider(): EthereumProvider | null {
    const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;
    return ethereum?.request ? ethereum : null;
  }

  private requireProvider(): EthereumProvider {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error('MetaMask is required to connect the Bitcoin Snap.');
    }
    return provider;
  }

  private async ensureInstalled() {
    const provider = this.requireProvider();

    // Check if snap is already present (pre-installed in MetaMask v12.8+)
    try {
      const snaps = await provider.request({ method: 'wallet_getSnaps' });
      if (snaps?.[this.snapId]) {
        return; // Already installed, skip wallet_requestSnaps
      }
    } catch {
      // wallet_getSnaps failed — continue to try installing
    }

    // Try installing (works on Flask / older MetaMask)
    try {
      await provider.request({
        method: 'wallet_requestSnaps',
        params: { [this.snapId]: {} },
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      // If blocked because it's pre-installed, that's OK — we can still invoke it
      if (msg.includes('endowment') || msg.includes('not permitted')) {
        return;
      }
      throw err;
    }
  }

  private async invokeCandidates(candidates: SnapRequestShape[]) {
    const provider = this.requireProvider();
    let lastError: Error | null = null;

    // 1. Try wallet_invokeSnap (standard)
    for (const candidate of candidates) {
      try {
        return await provider.request({
          method: 'wallet_invokeSnap',
          params: {
            snapId: this.snapId,
            request: candidate,
          },
        });
      } catch (error) {
        lastError = error as Error;
      }
    }

    // 2. Fallback: wallet_invokeMethod (MetaMask Multichain API for pre-installed snaps)
    for (const candidate of candidates) {
      try {
        return await provider.request({
          method: 'wallet_invokeMethod',
          params: {
            snapId: this.snapId,
            request: candidate,
          },
        });
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw lastError ?? new Error('Unable to communicate with the Bitcoin Snap.');
  }

  private normalizeAccount(result: any): BitcoinAccount {
    const address =
      result?.address ||
      result?.account?.address ||
      result?.accountAddress ||
      result?.accounts?.[0]?.address ||
      result?.accounts?.[0];

    const publicKey =
      result?.publicKey ||
      result?.account?.publicKey ||
      result?.accounts?.[0]?.publicKey ||
      null;

    const derivationPath =
      result?.derivationPath ||
      result?.account?.derivationPath ||
      result?.accounts?.[0]?.derivationPath ||
      null;

    return {
      address: assertBitcoinTestnetAddress(String(address || '')),
      publicKey,
      derivationPath,
      network: BITCOIN_NETWORK,
    };
  }

  private normalizeSignedTransaction(result: any): SignedBitcoinTransaction {
    if (typeof result === 'string') {
      return { psbtBase64: result };
    }

    return {
      psbtBase64:
        result?.psbtBase64 ||
        result?.psbt ||
        result?.signedPsbtBase64 ||
        result?.signedPsbt,
      transactionHex: result?.transactionHex || result?.txHex || result?.rawTx,
      txid: result?.txid,
    };
  }
}
