import { useState } from 'react';
import { useAccount, useChainId, useSendTransaction, useSwitchChain, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { bsc } from 'wagmi/chains';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, Wallet, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { config as wagmiConfig } from '@/config/web3';
import {
  FUN_TESTNET_NOTE,
  isTokenInImplementation,
  mapSendError,
  SEND_TRANSFER_NOTE,
  sendAsset,
  type SendToken,
  type WriteContractFn,
  validateSendInput,
} from '@/modules/wallet/services/sendAsset';

// Token logos
import bnbLogo from '@/assets/tokens/bnb-logo.webp';
import btcbLogo from '@/assets/tokens/btcb-logo.webp';
import camlyLogo from '@/assets/tokens/camly-logo.webp';
import usdtLogo from '@/assets/tokens/usdt-logo.webp';
import funWalletLogo from '@/assets/fun-wallet-logo.png';

type TokenSymbol = SendToken;

interface SendCryptoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientAddress?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientAvatar?: string | null;
  conversationId?: string | null;
}

const TOKEN_LOGOS: Record<TokenSymbol, string> = {
  BNB: bnbLogo,
  BTCB: btcbLogo,
  CAMLY: camlyLogo,
  FUN: funWalletLogo,
  USDT: usdtLogo,
};

const TOKEN_LABEL: Record<TokenSymbol, string> = {
  BNB: 'BNB',
  BTCB: 'BTCB',
  CAMLY: 'CAMLY',
  FUN: 'FUN (Testnet - dang trien khai)',
  USDT: 'USDT',
};

const TokenOption = ({ token }: { token: TokenSymbol }) => (
  <div className="flex items-center gap-2">
    <img src={TOKEN_LOGOS[token]} alt={token} className="h-6 w-6 rounded-full" />
    <span className="font-medium text-[#2E2A1F]">{TOKEN_LABEL[token]}</span>
  </div>
);

// Helper to shorten wallet address
const shortenAddress = (address: string) => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Decorative SVG Components
const ApricotFlower = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="30" cy="12" rx="8" ry="12" fill="#FFD54F" opacity="0.9" />
    <ellipse cx="30" cy="48" rx="8" ry="12" fill="#FFD54F" opacity="0.9" />
    <ellipse cx="12" cy="30" rx="8" ry="12" fill="#FFD54F" opacity="0.9" transform="rotate(90 12 30)" />
    <ellipse cx="48" cy="30" rx="8" ry="12" fill="#FFD54F" opacity="0.9" transform="rotate(90 48 30)" />
    <ellipse cx="17" cy="17" rx="7" ry="11" fill="#FFD54F" opacity="0.85" transform="rotate(45 17 17)" />
    <ellipse cx="43" cy="43" rx="7" ry="11" fill="#FFD54F" opacity="0.85" transform="rotate(45 43 43)" />
    <ellipse cx="43" cy="17" rx="7" ry="11" fill="#FFD54F" opacity="0.85" transform="rotate(-45 43 17)" />
    <ellipse cx="17" cy="43" rx="7" ry="11" fill="#FFD54F" opacity="0.85" transform="rotate(-45 17 43)" />
    <circle cx="30" cy="30" r="6" fill="#D32F2F" />
    <circle cx="28" cy="28" r="1.5" fill="#FFEB3B" />
    <circle cx="32" cy="28" r="1.5" fill="#FFEB3B" />
    <circle cx="30" cy="32" r="1.5" fill="#FFEB3B" />
  </svg>
);

const PeachBlossom = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="40" cy="15" rx="10" ry="14" fill="#F8BBD9" opacity="0.9" />
    <ellipse cx="40" cy="65" rx="10" ry="14" fill="#F8BBD9" opacity="0.9" />
    <ellipse cx="15" cy="40" rx="10" ry="14" fill="#F8BBD9" opacity="0.9" transform="rotate(90 15 40)" />
    <ellipse cx="65" cy="40" rx="10" ry="14" fill="#F8BBD9" opacity="0.9" transform="rotate(90 65 40)" />
    <ellipse cx="22" cy="22" rx="9" ry="13" fill="#F8BBD9" opacity="0.85" transform="rotate(45 22 22)" />
    <ellipse cx="58" cy="58" rx="9" ry="13" fill="#F8BBD9" opacity="0.85" transform="rotate(45 58 58)" />
    <ellipse cx="58" cy="22" rx="9" ry="13" fill="#F8BBD9" opacity="0.85" transform="rotate(-45 58 22)" />
    <ellipse cx="22" cy="58" rx="9" ry="13" fill="#F8BBD9" opacity="0.85" transform="rotate(-45 22 58)" />
    <circle cx="40" cy="40" r="8" fill="#EC407A" />
    <circle cx="37" cy="37" r="2" fill="#FFEB3B" />
    <circle cx="43" cy="37" r="2" fill="#FFEB3B" />
    <circle cx="40" cy="43" r="2" fill="#FFEB3B" />
  </svg>
);

const RedEnvelope = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main envelope body */}
    <rect x="10" y="20" width="100" height="110" rx="8" fill="#C62828" />
    <rect x="10" y="20" width="100" height="110" rx="8" stroke="#FFD700" strokeWidth="2" />
    
    {/* Top flap */}
    <path d="M10 28 L60 60 L110 28" fill="#B71C1C" />
    <path d="M10 28 L60 60 L110 28" stroke="#FFD700" strokeWidth="2" fill="none" />
    
    {/* Gold circle decoration */}
    <circle cx="60" cy="85" r="25" fill="#FFD700" />
    <circle cx="60" cy="85" r="20" fill="#FFC107" />
    <circle cx="60" cy="85" r="15" fill="#FFD700" />
    
    {/* Inner square hole pattern */}
    <rect x="52" y="77" width="16" height="16" rx="2" fill="#C62828" />
    
    {/* Decorative patterns */}
    <circle cx="35" cy="50" r="4" fill="#FFD700" opacity="0.6" />
    <circle cx="85" cy="50" r="4" fill="#FFD700" opacity="0.6" />
  </svg>
);

const Firecracker = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* String */}
    <path d="M20 0 C20 10, 15 15, 20 20" stroke="#8B4513" strokeWidth="2" fill="none" />
    
    {/* Firecracker body */}
    <rect x="8" y="20" width="24" height="35" rx="3" fill="#C62828" />
    <rect x="8" y="20" width="24" height="35" rx="3" stroke="#FFD700" strokeWidth="1" />
    
    {/* Gold bands */}
    <rect x="8" y="25" width="24" height="4" fill="#FFD700" />
    <rect x="8" y="46" width="24" height="4" fill="#FFD700" />
    
    {/* Second firecracker */}
    <rect x="12" y="58" width="20" height="30" rx="2" fill="#D32F2F" />
    <rect x="12" y="62" width="20" height="3" fill="#FFD700" />
    <rect x="12" y="81" width="20" height="3" fill="#FFD700" />
    
    {/* Small decorative dots */}
    <circle cx="20" cy="37" r="2" fill="#FFD700" />
    <circle cx="22" cy="73" r="1.5" fill="#FFD700" />
  </svg>
);

const Sparkle = ({ className, delay = 0 }: { className?: string; delay?: number }) => (
  <div 
    className={`absolute ${className}`}
    style={{
      animation: `sparkle 2s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }}
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 0 L7 4.5 L12 6 L7 7.5 L6 12 L5 7.5 L0 6 L5 4.5 Z" fill="#FFD700" />
    </svg>
  </div>
);

export function SendCryptoModal({ 
  open, 
  onOpenChange, 
  recipientAddress,
  recipientUserId,
  recipientName,
  recipientAvatar,
  conversationId,
}: SendCryptoModalProps) {
  const { isConnected, address: senderAddress } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSendingNative } = useSendTransaction();
  const { writeContractAsync, isPending: isWritingContract } = useWriteContract();
  const [token, setToken] = useState<TokenSymbol>('BNB');
  const [amount, setAmount] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const isBusy = isConfirming || isSendingNative || isWritingContract;
  const hasRecipientWallet = !!recipientAddress;
  const isTokenDisabled = isTokenInImplementation(token);

  const resetForm = () => {
    setToken('BNB');
    setAmount('');
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (!recipientAddress) {
      toast.error('Thieu dia chi vi nguoi nhan.');
      return;
    }

    if (!recipientUserId) {
      toast.error('Thieu thong tin nguoi nhan.');
      return;
    }

    const normalizedAmount = amount.trim();

    if (!isConnected) {
      toast.error('Vui long ket noi vi truoc.');
      return;
    }

    const validation = validateSendInput({
      recipient: recipientAddress,
      amount: normalizedAmount,
      token,
      chainId,
    });

    if (!validation.ok) {
      toast.error((validation as { ok: false; error: string }).error);
      if (chainId && chainId !== bsc.id) {
        switchChain(
          { chainId: bsc.id },
          {
            onSuccess: () => toast.success('Da chuyen sang BNB Smart Chain. Vui long xac nhan lai.'),
            onError: () => toast.error('Vui long chuyen sang BNB Smart Chain de tiep tuc.'),
          }
        );
      }
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData?.session?.user?.id;
    if (!currentUserId) {
      toast.error('Phien dang nhap da het han. Vui long dang nhap lai.');
      return;
    }

    let giftId: string | null = null;
    try {
      setIsConfirming(true);

      const { data: giftRow, error: insertError } = await supabase
        .from('crypto_gifts')
        .insert({
          from_user_id: currentUserId,
          to_user_id: recipientUserId,
          to_address: recipientAddress,
          token,
          amount_numeric: Number(normalizedAmount),
          conversation_id: conversationId ?? null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError || !giftRow?.id) {
        throw new Error(insertError?.message || 'Khong the tao ban ghi tang qua.');
      }

      giftId = giftRow.id as string;

      const updateGift = async (patch: {
        status?: string;
        tx_hash?: string;
        error?: string;
        chain_id?: number;
        message_id?: string;
      }) => {
        await supabase
          .from('crypto_gifts')
          .update(patch)
          .eq('id', giftId);
      };


      const activeChainId: 1 | 56 = (chainId === 56 || chainId === 97) ? 56 : bsc.id;

      const writeContractWrapper: WriteContractFn = (params) => {
        return writeContractAsync(params as any);
      };

      const { hash } = await sendAsset({
        token,
        recipient: recipientAddress as `0x${string}`,
        amount: normalizedAmount,
        chainId: activeChainId,
        account: senderAddress || undefined,
        sendNative: sendTransactionAsync,
        writeContract: writeContractWrapper,
      });

      await updateGift({ tx_hash: hash, status: 'pending', error: null });
      toast.success('Da gui giao dich.');

      try {
        const receipt = await waitForTransactionReceipt(wagmiConfig, {
          hash,
          chainId: activeChainId,
          confirmations: 1,
        });

        const receiptStatus = (receipt as any)?.status;
        if (receiptStatus && receiptStatus !== 'success') {
          await updateGift({ status: 'failed', error: 'Giao dich bi revert.' });
          toast.error('Giao dich bi revert.');
          return;
        }

        await updateGift({ status: 'confirmed', error: null });
        toast.success('Tang qua thanh cong.');
        handleClose(false);
      } catch (e) {
        await updateGift({ status: 'pending', error: mapSendError(e) });
        toast.warning('Giao dich da gui. Dang cho xac nhan.');
        handleClose(false);
      }
    } catch (error) {
      const message = mapSendError(error);
      if (giftId) {
        await supabase
          .from('crypto_gifts')
          .update({ status: 'failed', error: message || 'Khong the tang qua.' })
          .eq('id', giftId);
      }
      toast.error(message || 'Khong the tang qua.');
    }
    finally {
      setIsConfirming(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 border-2 border-[#E7C76A]/60 bg-gradient-to-br from-[#FFFBF3] via-[#FFF7E6] to-[#FFF3DA] shadow-2xl overflow-hidden">
        {/* Sparkle animation keyframes */}
        <style>{`
          @keyframes sparkle {
            0%, 100% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Hoa mai - góc trái trên */}
          <ApricotFlower className="absolute -top-2 -left-2 w-16 h-16 opacity-80" />
          <ApricotFlower className="absolute top-8 left-6 w-10 h-10 opacity-60" />
          
          {/* Hoa đào - góc phải trên */}
          <PeachBlossom className="absolute -top-4 -right-4 w-20 h-20 opacity-70" />
          <PeachBlossom className="absolute top-10 right-8 w-12 h-12 opacity-50" />
          
          {/* Hoa mai - góc trái dưới */}
          <ApricotFlower className="absolute -bottom-3 -left-3 w-14 h-14 opacity-70" />
          <ApricotFlower className="absolute bottom-10 left-4 w-8 h-8 opacity-50" />
          
          {/* Pháo - góc phải dưới */}
          <Firecracker className="absolute -bottom-2 right-4 w-8 h-20 opacity-80" />
          <Firecracker className="absolute bottom-8 -right-1 w-6 h-16 opacity-60" />
          
          {/* Sparkles */}
          <Sparkle className="top-16 left-20" delay={0} />
          <Sparkle className="top-24 right-16" delay={0.5} />
          <Sparkle className="bottom-20 left-16" delay={1} />
          <Sparkle className="bottom-28 right-20" delay={1.5} />
          <Sparkle className="top-1/2 left-8" delay={0.8} />
          <Sparkle className="top-1/3 right-10" delay={1.2} />
          
          {/* Gradient overlays */}
          <div className="absolute -top-10 -left-12 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,213,79,0.25),transparent_70%)]" />
          <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(255,182,193,0.25),transparent_70%)]" />
          
          {/* Top border gradient */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FFD54F] via-[#E7C76A] to-[#FFD54F]" />
        </div>

        {/* Close button */}
        <button
          onClick={() => handleClose(false)}
          className="absolute right-4 top-4 z-10 rounded-full p-1 hover:bg-[#E7C76A]/20 transition-colors"
        >
          <X className="h-5 w-5 text-[#5A4F3B]" />
        </button>

        {/* Content */}
        <div className="relative z-10 p-6 pt-8">
          {/* Header */}
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-[#2E2A1F] mb-1">Tặng quà crypto</h2>
            <p className="text-sm text-[#5A4F3B]">
              Chia sẻ món quà token với hương vị Tết ấm áp.
            </p>
          </div>

          {/* Red Envelope Icon */}
          <div className="flex justify-center mb-5">
            <RedEnvelope className="w-20 h-24" />
          </div>

          {/* Recipient Card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 mb-5 border border-[#E7C76A]/40 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-[#E7C76A]/50">
                <AvatarImage src={recipientAvatar || undefined} alt={recipientName || 'Recipient'} />
                <AvatarFallback className="bg-gradient-to-br from-[#FFD54F] to-[#E7C76A] text-[#2E2A1F] font-semibold">
                  {(recipientName || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#8B7355] font-medium">Người nhận</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-[#2E2A1F] truncate">
                    {recipientName || 'User'}
                  </p>
                  <span className="text-[#8B7355]">›</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  {hasRecipientWallet ? (
                    <span className="text-xs text-[#8B7355] font-mono">
                      {shortenAddress(recipientAddress || '')}
                    </span>
                  ) : (
                    <span className="text-xs text-rose-700">
                      Người dùng chưa cập nhật ví Web3
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#E7C76A]/20 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-[#8B7355]" />
                </div>
              </div>
            </div>
          </div>

          {/* Token Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#4E4433]">Token</Label>
              <Select value={token} onValueChange={(value) => setToken(value as TokenSymbol)}>
                <SelectTrigger className="h-12 border-[#E7C76A]/60 bg-white/70 text-[#2E2A1F] focus-visible:ring-[#E7C76A]/60">
                  <SelectValue placeholder="Select token">
                    <div className="flex items-center justify-between w-full">
                      <TokenOption token={token} />
                      <span className="text-[#8B7355] text-sm ml-auto mr-2">0.0 {token}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="BNB">
                  <TokenOption token="BNB" />
                </SelectItem>
                <SelectItem value="BTCB">
                  <TokenOption token="BTCB" />
                </SelectItem>
                <SelectItem value="FUN">
                  <TokenOption token="FUN" />
                </SelectItem>
                  <SelectItem value="CAMLY">
                    <TokenOption token="CAMLY" />
                  </SelectItem>
                  <SelectItem value="USDT">
                    <TokenOption token="USDT" />
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="crypto-amount" className="text-sm font-semibold text-[#4E4433]">
                Số lượng
              </Label>
              <Input
                id="crypto-amount"
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 border-[#E7C76A]/60 bg-white/70 text-base font-semibold text-[#2E2A1F] focus-visible:ring-[#E7C76A]/60"
              />
              <p className="text-xs text-[#6B5A3A]">
                {isTokenDisabled ? FUN_TESTNET_NOTE : SEND_TRANSFER_NOTE}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => handleClose(false)} 
              disabled={isBusy} 
              className="flex-1 h-11 border-2 border-[#D9C184] text-[#4E4433] bg-white/50 hover:bg-[#E7C76A]/20 font-semibold"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isBusy || !hasRecipientWallet || isTokenDisabled}
              className="flex-1 h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold shadow-lg transition-all duration-150 hover:shadow-[0_0_16px_rgba(27,94,32,0.4)]"
            >
              {isBusy ? 'Đang gửi...' : 'Xác nhận'}
            </Button>
          </div>
          {!hasRecipientWallet && (
            <div className="mt-2 text-xs text-rose-700 text-center">
              Người nhận chưa cập nhật ví Web3, nên chưa thể thực hiện tặng tiền.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
