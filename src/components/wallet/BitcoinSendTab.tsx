import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatSatsToBtc } from '@/modules/wallet/bitcoin/addressService';
import type {
  BitcoinFeeOption,
  BitcoinUtxo,
  BroadcastBitcoinTransactionResult,
  SignedBitcoinTransaction,
  UnsignedBitcoinTransaction,
} from '@/modules/wallet/bitcoin/types';

interface BitcoinSendTabProps {
  senderAddress?: string | null;
  balanceSats: number;
  feeOptions: BitcoinFeeOption[];
  createTransaction: (input: {
    senderAddress: string;
    recipientAddress: string;
    amountBtc: string;
    feeRate: number;
    utxos: BitcoinUtxo[];
  }) => UnsignedBitcoinTransaction;
  signTransaction: (transaction: UnsignedBitcoinTransaction) => Promise<SignedBitcoinTransaction>;
  broadcastTransaction: (
    transaction: SignedBitcoinTransaction,
    fallbackPsbtBase64?: string,
  ) => Promise<BroadcastBitcoinTransactionResult>;
  utxos: BitcoinUtxo[];
  isConnectorAvailable: boolean;
}

export const BitcoinSendTab = ({
  senderAddress,
  balanceSats,
  feeOptions,
  createTransaction,
  signTransaction,
  broadcastTransaction,
  utxos,
  isConnectorAvailable,
}: BitcoinSendTabProps) => {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amountBtc, setAmountBtc] = useState('');
  const [selectedFeePreset, setSelectedFeePreset] = useState<string>('normal');
  const [preview, setPreview] = useState<UnsignedBitcoinTransaction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<BroadcastBitcoinTransactionResult | null>(null);

  const selectedFee = useMemo(
    () => feeOptions.find((option) => option.preset === selectedFeePreset) ?? feeOptions[1] ?? feeOptions[0] ?? null,
    [feeOptions, selectedFeePreset],
  );

  useEffect(() => {
    if (!feeOptions.length) return;
    if (!feeOptions.some((option) => option.preset === selectedFeePreset)) {
      setSelectedFeePreset(feeOptions[0].preset);
    }
  }, [feeOptions, selectedFeePreset]);

  const handlePreview = () => {
    if (!senderAddress) {
      toast.error('Connect the Bitcoin Snap wallet first.');
      return;
    }

    if (!selectedFee) {
      toast.error('Fee recommendations are still loading.');
      return;
    }

    try {
      const nextPreview = createTransaction({
        senderAddress,
        recipientAddress,
        amountBtc,
        feeRate: selectedFee.satsPerVbyte,
        utxos,
      });

      setPreview(nextPreview);
      setBroadcastResult(null);
      setConfirmOpen(true);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleConfirmSend = async () => {
    if (!preview) return;
    setIsSubmitting(true);

    try {
      const signedTransaction = await signTransaction(preview);
      const result = await broadcastTransaction(signedTransaction, preview.psbtBase64);
      setBroadcastResult(result);
      setConfirmOpen(false);
      setRecipientAddress('');
      setAmountBtc('');
      setPreview(null);
      toast.success(`BTC testnet transaction sent: ${result.txid}`);
    } catch (error) {
      toast.error((error as Error).message || 'Unable to send BTC.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send BTC</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnectorAvailable ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            MetaMask extension is required for Bitcoin Snap support.
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="btc-recipient">Recipient address</Label>
          <Input
            id="btc-recipient"
            placeholder="tb1..."
            value={recipientAddress}
            onChange={(event) => setRecipientAddress(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="btc-amount">Amount (BTC)</Label>
            <span className="text-xs text-muted-foreground">
              Balance: {formatSatsToBtc(balanceSats)} BTC
            </span>
          </div>
          <Input
            id="btc-amount"
            placeholder="0.00010000"
            value={amountBtc}
            onChange={(event) => setAmountBtc(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Fee speed</Label>
          <Select value={selectedFeePreset} onValueChange={setSelectedFeePreset}>
            <SelectTrigger>
              <SelectValue placeholder="Choose fee speed" />
            </SelectTrigger>
            <SelectContent>
              {feeOptions.map((option) => (
                <SelectItem key={option.preset} value={option.preset}>
                  {option.label} ({option.satsPerVbyte} sat/vB)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Transactions are assembled locally as PSBTs, signed via MetaMask Snap, then broadcast to the Bitcoin testnet.
        </div>

        <Button
          onClick={handlePreview}
          disabled={!senderAddress || !selectedFee || isSubmitting}
          className="w-full"
        >
          Review BTC Send
        </Button>

        {broadcastResult ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <div className="font-medium">Broadcast complete</div>
            <div className="mt-1 break-all text-xs">{broadcastResult.txid}</div>
            <a
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline"
              href={broadcastResult.explorerUrl}
              rel="noreferrer"
              target="_blank"
            >
              View in explorer
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : null}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Bitcoin testnet send</DialogTitle>
            </DialogHeader>

            {preview ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div>Recipient: <strong>{preview.recipientAddress}</strong></div>
                  <div>Amount: <strong>{formatSatsToBtc(preview.amountSats)} BTC</strong></div>
                  <div>Fee: <strong>{formatSatsToBtc(preview.feeSats)} BTC</strong></div>
                  <div>Total spend: <strong>{formatSatsToBtc(preview.amountSats + preview.feeSats)} BTC</strong></div>
                  <div>Change: <strong>{formatSatsToBtc(preview.changeSats)} BTC</strong></div>
                  <div>Fee rate: <strong>{preview.feeRate} sat/vB</strong></div>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    MetaMask will prompt for Bitcoin Snap approval. Only testnet BTC should be used here.
                  </p>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSend} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign and Broadcast
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
