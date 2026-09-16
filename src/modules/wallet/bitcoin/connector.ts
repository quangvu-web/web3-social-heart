import type { BitcoinAccount, SignedBitcoinTransaction, UnsignedBitcoinTransaction } from './types';

export interface BitcoinConnector {
  isAvailable(): boolean;
  isInstalled(): Promise<boolean>;
  generateWallet(): Promise<BitcoinAccount>;
  signTransaction(transaction: UnsignedBitcoinTransaction): Promise<SignedBitcoinTransaction>;
}
