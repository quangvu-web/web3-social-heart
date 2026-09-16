import { BitcoinApiClient } from './apiClient';
import type { BitcoinConnector } from './connector';
import { mapFeeOptions } from './feeService';
import { MetaMaskSnapBitcoinConnector } from './metamaskSnapConnector';
import { BitcoinTransactionService } from './transactionService';
import type {
  BitcoinAccount,
  BitcoinBalance,
  BitcoinFeeOption,
  BitcoinUtxo,
  BroadcastBitcoinTransactionResult,
  CreateBitcoinTransactionInput,
  SignedBitcoinTransaction,
  UnsignedBitcoinTransaction,
} from './types';

export class BitcoinService {
  constructor(
    private readonly apiClient = new BitcoinApiClient(),
    private readonly connector: BitcoinConnector = new MetaMaskSnapBitcoinConnector(),
    private readonly transactionService = new BitcoinTransactionService(),
  ) {}

  isConnectorAvailable() {
    return this.connector.isAvailable();
  }

  isConnectorInstalled() {
    return this.connector.isInstalled();
  }

  generateWallet(): Promise<BitcoinAccount> {
    return this.connector.generateWallet();
  }

  getBalance(address: string): Promise<BitcoinBalance> {
    return this.apiClient.getBalance(address);
  }

  getUTXOs(address: string): Promise<BitcoinUtxo[]> {
    return this.apiClient.getUTXOs(address);
  }

  async getFeeOptions(): Promise<BitcoinFeeOption[]> {
    const fees = await this.apiClient.getRecommendedFees();
    return mapFeeOptions(fees);
  }

  createTransaction(input: CreateBitcoinTransactionInput): UnsignedBitcoinTransaction {
    return this.transactionService.createTransaction(input);
  }

  signTransaction(transaction: UnsignedBitcoinTransaction): Promise<SignedBitcoinTransaction> {
    return this.connector.signTransaction(transaction);
  }

  async broadcastTransaction(signedTransaction: SignedBitcoinTransaction, fallbackPsbtBase64?: string): Promise<BroadcastBitcoinTransactionResult> {
    const transactionHex = this.transactionService.extractTransactionHex(signedTransaction, fallbackPsbtBase64);
    return this.apiClient.broadcastTransaction(transactionHex);
  }
}

export const bitcoinService = new BitcoinService();
