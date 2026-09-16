import * as bitcoin from 'bitcoinjs-lib';
import { BITCOIN_DUST_LIMIT_SATS } from './constants';
import {
  assertBitcoinTestnetAddress,
  getBitcoinTestnetOutputScript,
  parseBtcToSats,
} from './addressService';
import type {
  CreateBitcoinTransactionInput,
  SignedBitcoinTransaction,
  UnsignedBitcoinTransaction,
  BitcoinUtxo,
} from './types';

const TESTNET = bitcoin.networks.testnet;

function estimateVBytes(inputCount: number, outputCount: number): number {
  return 11 + inputCount * 68 + outputCount * 31;
}

function sumUtxos(utxos: BitcoinUtxo[]): number {
  return utxos.reduce((total, utxo) => total + utxo.value, 0);
}

export class BitcoinTransactionService {
  createTransaction(input: CreateBitcoinTransactionInput): UnsignedBitcoinTransaction {
    const senderAddress = assertBitcoinTestnetAddress(input.senderAddress);
    const recipientAddress = assertBitcoinTestnetAddress(input.recipientAddress);
    const amountSats = parseBtcToSats(input.amountBtc);

    const spendableUtxos = [...input.utxos]
      .filter((utxo) => utxo.status?.confirmed !== false)
      .sort((left, right) => right.value - left.value);

    if (!spendableUtxos.length) {
      throw new Error('No confirmed UTXOs available for this wallet.');
    }

    if (amountSats < BITCOIN_DUST_LIMIT_SATS) {
      throw new Error('Amount is below the Bitcoin dust threshold.');
    }

    const selectedUtxos: BitcoinUtxo[] = [];
    let selectedTotal = 0;
    let feeSats = 0;
    let changeSats = 0;

    for (const utxo of spendableUtxos) {
      selectedUtxos.push(utxo);
      selectedTotal += utxo.value;

      const provisionalFee = Math.ceil(estimateVBytes(selectedUtxos.length, 2) * input.feeRate);
      const provisionalChange = selectedTotal - amountSats - provisionalFee;

      if (provisionalChange >= BITCOIN_DUST_LIMIT_SATS) {
        feeSats = provisionalFee;
        changeSats = provisionalChange;
        break;
      }

      const noChangeFee = Math.ceil(estimateVBytes(selectedUtxos.length, 1) * input.feeRate);
      const requiredWithoutChange = amountSats + noChangeFee;
      if (selectedTotal >= requiredWithoutChange) {
        feeSats = noChangeFee;
        changeSats = selectedTotal - amountSats - noChangeFee;
        if (changeSats > 0 && changeSats < BITCOIN_DUST_LIMIT_SATS) {
          feeSats += changeSats;
          changeSats = 0;
        }
        break;
      }
    }

    if (selectedTotal < amountSats + feeSats) {
      throw new Error('Insufficient BTC balance for amount and fee.');
    }

    const senderScript = getBitcoinTestnetOutputScript(senderAddress);
    const psbt = new bitcoin.Psbt({ network: TESTNET });

    selectedUtxos.forEach((utxo) => {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: senderScript,
          value: BigInt(utxo.value),
        },
      });
    });

    psbt.addOutput({
      address: recipientAddress,
      value: BigInt(amountSats),
    });

    if (changeSats >= BITCOIN_DUST_LIMIT_SATS) {
      psbt.addOutput({
        address: senderAddress,
        value: BigInt(changeSats),
      });
    }

    return {
      psbtBase64: psbt.toBase64(),
      senderAddress,
      recipientAddress,
      amountSats,
      feeSats,
      feeRate: input.feeRate,
      changeSats,
      totalInputSats: sumUtxos(selectedUtxos),
      selectedUtxos,
      network: 'BTC_TESTNET',
    };
  }

  extractTransactionHex(result: SignedBitcoinTransaction, fallbackPsbtBase64?: string): string {
    if (result.transactionHex) {
      return result.transactionHex;
    }

    const psbtBase64 = result.psbtBase64 || fallbackPsbtBase64;
    if (!psbtBase64) {
      throw new Error('Signed Bitcoin transaction is missing PSBT data.');
    }

    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: TESTNET });

    try {
      psbt.finalizeAllInputs();
    } catch {
      // Some signers may return an already-finalized PSBT.
    }

    return psbt.extractTransaction().toHex();
  }
}
