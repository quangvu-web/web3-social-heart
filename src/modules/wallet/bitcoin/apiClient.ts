import { BITCOIN_API_BASES, BITCOIN_TESTNET_EXPLORER_BASE_URL } from './constants';
import type {
  BitcoinBalance,
  BitcoinFeeRates,
  BitcoinUtxo,
  BroadcastBitcoinTransactionResult,
} from './types';

type AddressStatsResponse = {
  chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
  mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
};

type RawUtxo = {
  txid: string;
  vout: number;
  value: number;
  status?: {
    confirmed?: boolean;
    block_height?: number;
    block_time?: number;
  };
};

export class BitcoinApiClient {
  async getBalance(address: string): Promise<BitcoinBalance> {
    const data = await this.fetchJson<AddressStatsResponse>(`/address/${address}`);

    const confirmedFunded = data.chain_stats?.funded_txo_sum ?? 0;
    const confirmedSpent = data.chain_stats?.spent_txo_sum ?? 0;
    const mempoolFunded = data.mempool_stats?.funded_txo_sum ?? 0;
    const mempoolSpent = data.mempool_stats?.spent_txo_sum ?? 0;

    const confirmedSats = confirmedFunded - confirmedSpent;
    const pendingSats = mempoolFunded - mempoolSpent;

    return {
      confirmedSats,
      pendingSats,
      totalSats: confirmedSats + pendingSats,
    };
  }

  async getUTXOs(address: string): Promise<BitcoinUtxo[]> {
    const data = await this.fetchJson<RawUtxo[]>(`/address/${address}/utxo`);

    return data.map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      status: {
        confirmed: utxo.status?.confirmed,
        blockHeight: utxo.status?.block_height,
        blockTime: utxo.status?.block_time,
      },
    }));
  }

  async getRecommendedFees(): Promise<BitcoinFeeRates> {
    try {
      return await this.fetchJson<BitcoinFeeRates>('/v1/fees/recommended');
    } catch {
      const estimates = await this.fetchJson<Record<string, number>>('/fee-estimates');

      return {
        fastestFee: Math.ceil(estimates['1'] ?? 10),
        halfHourFee: Math.ceil(estimates['3'] ?? estimates['2'] ?? 8),
        hourFee: Math.ceil(estimates['6'] ?? estimates['4'] ?? 6),
        economyFee: Math.ceil(estimates['144'] ?? 3),
        minimumFee: Math.ceil(estimates['1008'] ?? 1),
      };
    }
  }

  async broadcastTransaction(transactionHex: string): Promise<BroadcastBitcoinTransactionResult> {
    const txid = await this.fetchText('/tx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: transactionHex,
    });

    return {
      txid,
      explorerUrl: `${BITCOIN_TESTNET_EXPLORER_BASE_URL}/tx/${txid}`,
    };
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchWithFallback(path, init);
    return response.json() as Promise<T>;
  }

  private async fetchText(path: string, init?: RequestInit): Promise<string> {
    const response = await this.fetchWithFallback(path, init);
    return response.text();
  }

  private async fetchWithFallback(path: string, init?: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (const baseUrl of BITCOIN_API_BASES) {
      try {
        const response = await fetch(`${baseUrl}${path}`, init);
        if (!response.ok) {
          throw new Error(`Bitcoin API request failed with ${response.status}`);
        }
        return response;
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw lastError ?? new Error('Bitcoin API request failed.');
  }
}
