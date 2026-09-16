import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Gift, Wallet, ExternalLink, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useClaimReward } from '@/hooks/useClaimReward';

const MINIMUM_CLAIM = 1; // Tối thiểu 1 CAMLY (không giới hạn)

interface ClaimRewardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimableAmount: number;
  externalWallet: string | null;
  camlyPrice: number;
  onSuccess: () => void;
}

type ClaimStep = 'input' | 'confirming' | 'success' | 'error';

export const ClaimRewardDialog = ({
  open,
  onOpenChange,
  claimableAmount,
  externalWallet,
  camlyPrice,
  onSuccess,
}: ClaimRewardDialogProps) => {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<ClaimStep>('input');

  const { claimReward, isLoading, error, result, reset } = useClaimReward();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAmount('');
      setStep('input');
      reset();
    }
  }, [open, reset]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('vi-VN');
  };

  const formatUsd = (num: number) => {
    return `$${(num * camlyPrice).toFixed(2)}`;
  };

  const handleMaxClick = () => {
    setAmount(claimableAmount.toString());
  };

  const handleAmountChange = (value: string) => {
    // Only allow numbers
    const cleanValue = value.replace(/[^0-9]/g, '');
    setAmount(cleanValue);
  };

  const isValidAmount = () => {
    const numAmount = Number(amount);
    return numAmount >= MINIMUM_CLAIM && numAmount <= claimableAmount;
  };

  const handleClaim = async () => {
    if (!externalWallet) return;

    setStep('confirming');
    
    const claimResult = await claimReward(Number(amount), externalWallet);
    
    if (claimResult) {
      setStep('success');
      // Trigger confetti animation
      triggerConfetti();
      onSuccess();
    } else {
      setStep('error');
    }
  };

  // Simple confetti effect using CSS animations
  const triggerConfetti = () => {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'fixed inset-0 pointer-events-none z-[200] overflow-hidden';
    confettiContainer.id = 'claim-confetti';
    
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    
    for (let i = 0; i < 100; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'absolute w-3 h-3 rounded-sm';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.top = '-10px';
      confetti.style.animation = `confetti-fall ${2 + Math.random() * 2}s linear forwards`;
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      confettiContainer.appendChild(confetti);
    }
    
    document.body.appendChild(confettiContainer);
    
    // Add keyframes if not exists
    if (!document.getElementById('confetti-styles')) {
      const style = document.createElement('style');
      style.id = 'confetti-styles';
      style.textContent = `
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Remove after animation
    setTimeout(() => {
      confettiContainer.remove();
    }, 4000);
  };

  const renderInputStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <Gift className="w-6 h-6 text-yellow-500" />
          Claim CAMLY Rewards
        </DialogTitle>
        <DialogDescription>
          Chuyển phần thưởng CAMLY vào ví của bạn
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Available Balance */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-700 mb-1">Số dư khả dụng</p>
          <p className="text-2xl font-bold text-yellow-800">
            {formatNumber(claimableAmount)} CAMLY
          </p>
          <p className="text-sm text-yellow-600">~{formatUsd(claimableAmount)}</p>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount">Số lượng claim</Label>
          <div className="relative">
            <Input
              id="amount"
              type="text"
              placeholder="Nhập số lượng CAMLY"
              value={amount ? formatNumber(Number(amount)) : ''}
              onChange={(e) => handleAmountChange(e.target.value.replace(/\./g, ''))}
              className="pr-16 text-lg font-medium"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleMaxClick}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80"
            >
              MAX
            </Button>
          </div>
          {amount && Number(amount) > 0 && (
            <p className="text-sm text-muted-foreground">
              ~{formatUsd(Number(amount))}
            </p>
          )}
          {amount && Number(amount) < 1 && (
            <p className="text-sm text-red-500">
              Số lượng phải lớn hơn 0
            </p>
          )}
          {amount && Number(amount) > claimableAmount && (
            <p className="text-sm text-red-500">
              Vượt quá số dư khả dụng
            </p>
          )}
        </div>

        {/* Wallet Info */}
        {externalWallet ? (
          <div className="space-y-2">
            <Label>Ví nhận</Label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
              <Wallet className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-mono">
                {externalWallet.slice(0, 6)}...{externalWallet.slice(-4)}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <p className="text-sm text-red-600">
              Vui lòng kết nối ví để claim reward
            </p>
          </div>
        )}

        {/* Network Info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-gray-50 rounded-lg p-3">
          <Wallet className="w-4 h-4" />
          <span>Mạng: BNB Smart Chain (BSC)</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1"
        >
          Hủy
        </Button>
        <Button
          onClick={handleClaim}
          disabled={!isValidAmount() || !externalWallet}
          className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white"
        >
          <Gift className="w-4 h-4 mr-2" />
          Claim {amount ? formatNumber(Number(amount)) : ''} CAMLY
        </Button>
      </div>
    </>
  );

  const renderConfirmingStep = () => (
    <div className="py-12 text-center">
      <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
        <Loader2 className="w-10 h-10 text-yellow-600 animate-spin" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Đang xử lý giao dịch...</h3>
      <p className="text-muted-foreground mb-4">
        Vui lòng chờ trong khi giao dịch được xác nhận trên blockchain
      </p>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="py-8 text-center">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-14 h-14 text-green-600" />
      </div>
      <h3 className="text-2xl font-bold text-green-700 mb-2">Claim Thành Công! 🎉</h3>
      <p className="text-lg text-gray-600 mb-4">
        Đã chuyển <span className="font-bold text-yellow-600">{formatNumber(result?.amount || 0)} CAMLY</span>
      </p>
      <p className="text-sm text-muted-foreground mb-6">
        vào ví {result?.wallet_address?.slice(0, 8)}...{result?.wallet_address?.slice(-6)}
      </p>

      {result?.bscscan_url && (
        <a
          href={result.bscscan_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-primary hover:underline mb-6"
        >
          <ExternalLink className="w-4 h-4" />
          Xem trên BscScan
        </a>
      )}

      <Button
        onClick={() => onOpenChange(false)}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
      >
        Đóng
      </Button>
    </div>
  );

  const renderErrorStep = () => (
    <div className="py-8 text-center">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertCircle className="w-12 h-12 text-red-600" />
      </div>
      <h3 className="text-xl font-semibold text-red-700 mb-2">Claim Thất Bại</h3>
      <p className="text-muted-foreground mb-6">
        {error || 'Đã xảy ra lỗi, vui lòng thử lại sau'}
      </p>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1"
        >
          Đóng
        </Button>
        <Button
          onClick={() => setStep('input')}
          className="flex-1"
        >
          Thử lại
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'input' && renderInputStep()}
        {step === 'confirming' && renderConfirmingStep()}
        {step === 'success' && renderSuccessStep()}
        {step === 'error' && renderErrorStep()}
      </DialogContent>
    </Dialog>
  );
};

export default ClaimRewardDialog;
