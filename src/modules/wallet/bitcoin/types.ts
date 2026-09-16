export type BitcoinNetwork = 'BTC_TESTNET';

export type BitcoinFeePreset = 'slow' | 'normal' | 'fast';

export interface BitcoinAccount {
  address: string;
  publicKey?: string | null;
  derivationPath?: string | null;
  network: BitcoinNetwork;
}

export interface BitcoinBalance {
  confirmedSats: number;
  pendingSats: number;
  totalSats: number;
}

export interface BitcoinUtxo {
  txid: string;
  vout: number;
  value: number;
  status?: {
    confirmed?: boolean;
    blockHeight?: number;
    blockTime?: number;
  };
}

export interface BitcoinFeeRates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface BitcoinFeeOption {
  preset: BitcoinFeePreset;
  label: string;
  satsPerVbyte: number;
}

export interface CreateBitcoinTransactionInput {
  senderAddress: string;
  recipientAddress: string;
  amountBtc: string;
  feeRate: number;
  utxos: BitcoinUtxo[];
}

export interface UnsignedBitcoinTransaction {
  psbtBase64: string;
  senderAddress: string;
  recipientAddress: string;
  amountSats: number;
  feeSats: number;
  feeRate: number;
  changeSats: number;
  totalInputSats: number;
  selectedUtxos: BitcoinUtxo[];
  network: BitcoinNetwork;
}

export interface SignedBitcoinTransaction {
  psbtBase64?: string;
  transactionHex?: string;
  txid?: string;
}

export interface BroadcastBitcoinTransactionResult {
  txid: string;
  explorerUrl: string;
}
