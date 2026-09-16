import { useState, useEffect } from 'react';
import funProfileLogo from '@/assets/fun-profile-logo.png';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, CheckCircle2, Loader2 } from 'lucide-react';
import { isWalletConnectConfigured } from '@/config/web3';
import {
  connectWalletViaRainbowModal,
  isStandalonePwa,
  MODAL_OPEN_FAILED_HINT,
  PWA_RECONNECT_HINT,
} from '@/utils/mobileWalletConnect';
import { TelegramOtpChallenge } from './TelegramOtpChallenge';
interface WalletLoginContentProps {
  onSuccess: (userId: string, isNewUser: boolean) => void;
}
export const WalletLoginContent = ({
  onSuccess
}: WalletLoginContentProps) => {
  const {
    t
  } = useLanguage();
  const [step, setStep] = useState<'connect' | 'sign' | 'verify'>('connect');
  const [loading, setLoading] = useState(false);
  const [telegramChallenge, setTelegramChallenge] = useState<{
    challengeId: string;
    userId: string;
    isNewUser: boolean;
  } | null>(null);

  // Wagmi hooks
  const {
    address,
    isConnected,
    isConnecting
  } = useAccount();
  const {
    openConnectModal
  } = useConnectModal();
  const {
    signMessageAsync,
    isPending: isSigning
  } = useSignMessage();
  const {
    disconnect
  } = useDisconnect();

  // Auto-transition to sign step when connected
  useEffect(() => {
    if (isConnected && address) {
      setStep('sign');
    } else {
      setStep('connect');
    }
  }, [isConnected, address]);
  const handleConnect = () => {
    if (!isWalletConnectConfigured) {
      toast.error('WalletConnect config missing. Vui long cau hinh VITE_WALLETCONNECT_PROJECT_ID.');
      return;
    }
    if (connectWalletViaRainbowModal(openConnectModal)) {
      return;
    }
    if (isStandalonePwa()) {
      toast.error(`Khong mo duoc vi tu PWA. ${PWA_RECONNECT_HINT}`);
      return;
    }
    toast.error(MODAL_OPEN_FAILED_HINT);
  };
  const handleSignAndVerify = async () => {
    if (!address) return;
    setLoading(true);
    try {
      // Generate nonce and message
      const nonce = Math.random().toString(36).substring(2, 15);
      const timestamp = new Date().toISOString();
      const message = `Welcome to FUN Profile!\n\nSign this message to authenticate.\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

      // Request signature using wagmi hook
      const signature = await signMessageAsync({
        message,
        account: address
      });
      setStep('verify');

      // Call sso-web3-auth edge function
      const {
        data,
        error
      } = await supabase.functions.invoke('sso-web3-auth', {
        body: {
          wallet_address: address,
          signature,
          message,
          nonce
        }
      });
      if (error) throw error;
      if (data?.success && data?.requires_telegram_2fa && data?.challenge_id && data?.user_id) {
        setTelegramChallenge({
          challengeId: data.challenge_id,
          userId: data.user_id,
          isNewUser: Boolean(data.is_new_user),
        });
        toast.success('Telegram OTP sent');
      } else if (data?.success && data?.token_hash) {
        // Verify OTP with token_hash to create session
        const {
          error: verifyError
        } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'email'
        });
        if (verifyError) throw verifyError;

        // Update last_login_platform to 'FUN Profile'
        await supabase.from('profiles').update({
          last_login_platform: 'FUN Profile'
        }).eq('id', data.user_id);
        toast.success(data.is_new_user ? t('welcomeNewUser') : t('welcomeBack'));
        onSuccess(data.user_id, data.is_new_user);
      } else {
        throw new Error(data?.error || 'Verification failed');
      }
    } catch (error: any) {
      console.error('Wallet auth error:', error);

      // Handle user rejection
      if (error.name === 'UserRejectedRequestError' || error.message?.includes('rejected')) {
        toast.error('Signature rejected');
      } else {
        toast.error(error.message || t('errorOccurred'));
      }
      setStep('sign');
    } finally {
      setLoading(false);
    }
  };
  const handleCancel = () => {
    disconnect();
    setStep('connect');
  };
  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };
  const isLoading = loading || isConnecting || isSigning;
  if (telegramChallenge) {
    return (
      <TelegramOtpChallenge
        challengeId={telegramChallenge.challengeId}
        userId={telegramChallenge.userId}
        isNewUser={telegramChallenge.isNewUser}
        onVerified={onSuccess}
        onCancel={() => {
          setTelegramChallenge(null);
          setStep('sign');
        }}
      />
    );
  }

  return <div className="space-y-6">
      {/* Logo */}
      

      {step === 'connect' && <>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-foreground">{t('walletConnect')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('lightCloakDescription')}
            </p>
          </div>

          <Button onClick={handleConnect} disabled={isLoading} className="w-full h-14 text-lg font-bold rounded-full relative overflow-hidden text-white" style={{
        background: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #166534 100%)',
        boxShadow: '0 4px 20px rgba(22, 101, 52, 0.4)'
      }}>
            <span className="relative z-10 flex items-center justify-center gap-2 text-white">
              {isLoading ? <>
                  <Loader2 className="animate-spin" size={20} />
                  {t('walletConnecting')}
                </> : <>
                  <Wallet size={20} />
                  Connect Wallet
                </>}
            </span>
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            MetaMask, Coinbase Wallet, WalletConnect & more
          </p>
        </>}

      {step === 'sign' && address && <>
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-2">
              <CheckCircle2 className="text-emerald-600" size={28} />
            </div>
            <p className="text-muted-foreground">{t('walletConnected')}</p>
            <p className="font-mono text-sm bg-muted px-3 py-2 rounded-lg inline-block">
              {shortenAddress(address)}
            </p>
          </div>

          <Button onClick={handleSignAndVerify} disabled={isLoading} className="w-full h-14 text-lg font-bold rounded-full relative overflow-hidden text-white" style={{
        background: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #166534 100%)',
        boxShadow: '0 4px 20px rgba(22, 101, 52, 0.4)'
      }}>
            <span className="relative z-10 flex items-center justify-center gap-2 text-white">
              {isLoading ? <>
                  <Loader2 className="animate-spin" size={20} />
                  {t('walletSigning')}
                </> : t('walletSign')}
            </span>
          </Button>

          <button onClick={handleCancel} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← {t('cancel')}
          </button>
        </>}

      {step === 'verify' && <div className="text-center space-y-4 py-8">
          <Loader2 className="animate-spin mx-auto text-emerald-500" size={48} />
          <p className="text-muted-foreground font-medium">{t('walletVerifying')}</p>
        </div>}
    </div>;
};
