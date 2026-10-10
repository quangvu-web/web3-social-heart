import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { AuthTabs } from '@/features/auth/AuthTabs';
import { EmailVerifyGate } from '@/features/auth/wallet/EmailVerifyGate';

export const UnifiedAuthForm = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupStep, setSetupStep] = useState<'wallet' | 'complete' | null>(null);
  const [emailGateOpen, setEmailGateOpen] = useState(false);

  const maybeShowWalletLinkCta = async (userId: string) => {
    if (!userId) return;

    const { count, error } = await supabase
      .from('user_wallets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!error && (count ?? 0) === 0) {
      toast.info('Liên kết ví để nhận Camly/BNB', { duration: 4500 });
    }
  };

  const applyLawOfLightIfPending = async (userId: string) => {
    const lawOfLightPending = localStorage.getItem('law_of_light_accepted_pending');
    if (lawOfLightPending !== 'true') return;

    await supabase
      .from('profiles')
      .update({
        law_of_light_accepted: true,
        law_of_light_accepted_at: new Date().toISOString(),
      })
      .eq('id', userId);

    localStorage.removeItem('law_of_light_accepted_pending');
  };

  const handleNewUserSetup = async (userId: string, hasExternalWallet: boolean) => {
    setIsSettingUp(true);

    try {
      await applyLawOfLightIfPending(userId);

      if (!hasExternalWallet) {
        setSetupStep('wallet');

        const { error: walletError } = await supabase.functions.invoke('create-custodial-wallet', {
          body: { user_id: userId },
        });

        if (walletError) {
          toast.error(t('walletCreationFailed') || 'Failed to create wallet');
        }
      }

      setSetupStep('complete');
      toast.success(t('accountSetupComplete'));
      await maybeShowWalletLinkCta(userId);
      await new Promise((resolve) => setTimeout(resolve, 800));
      navigate('/');
    } catch (error) {
      console.error('[Setup] Setup error:', error);
      navigate('/');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleAuthSuccess = async (userId: string, isNewUser: boolean, hasExternalWallet = false) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      toast.error(t('authErrorGeneric'));
      return;
    }

    if (isNewUser) {
      await handleNewUserSetup(userId, hasExternalWallet);
      return;
    }

    toast.success(t('welcomeBack'));
    await maybeShowWalletLinkCta(userId);
    navigate('/');
  };

  const handleOtpSuccess = (userId: string, isNewUser: boolean) => {
    void handleAuthSuccess(userId, isNewUser, false);
  };

  const handleWalletSuccess = async (
    userId: string,
    isNewUser: boolean,
    needsEmailVerification: boolean,
  ) => {
    if (needsEmailVerification) {
      await applyLawOfLightIfPending(userId);
      toast.info('Please verify your email to unlock posting, comments, shares, and rewards.');
      setEmailGateOpen(true);
      return;
    }

    void handleAuthSuccess(userId, isNewUser, true);
  };

  const handleSocialSuccess = (userId: string, isNewUser: boolean) => {
    void handleAuthSuccess(userId, isNewUser, false);
  };

  const handleClassicSuccess = (userId: string, isNewUser: boolean) => {
    void handleAuthSuccess(userId, isNewUser, false);
  };

  if (isSettingUp) {
    return (
      <div className="w-full max-w-md relative">
        <div className="relative p-2 rounded-3xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-500 shadow-lg">
          <Card className="relative border-0 overflow-hidden rounded-2xl bg-card">
            <CardContent className="p-8">
              <div className="text-center space-y-6 py-8">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
                  <Sparkles className="text-primary-foreground" size={40} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground">{t('welcomeNewUser')}</h3>
                  <div className="space-y-3 mt-6">
                    <SetupStepIndicator step="wallet" currentStep={setupStep} label={t('creatingWallet')} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg relative">
      <div
        className="relative p-[4px] rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-glow)) 25%, hsl(var(--primary)) 50%, hsl(var(--primary-glow)) 75%, hsl(var(--primary)) 100%)',
          boxShadow: '0 0 25px hsl(var(--primary) / 0.5), 0 4px 20px hsl(var(--foreground) / 0.2), inset 0 1px 0 hsl(var(--card) / 0.2)',
        }}
      >
        <Card className="relative border-0 overflow-hidden rounded-[20px] bg-card shadow-inner p-2">
          <CardHeader className="pb-4">
            <CardTitle
              className="text-4xl font-bold text-center"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-glow)) 30%, hsl(var(--primary)) 50%, hsl(var(--primary-glow)) 70%, hsl(var(--primary)) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))',
              }}
            >
              {t('lightCloakWelcome')}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground text-base mt-2">
              {t('lightCloakDescription')}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <AuthTabs
              onOtpSuccess={handleOtpSuccess}
              onWalletLoginSuccess={handleWalletSuccess}
              onSocialSuccess={handleSocialSuccess}
              onClassicSuccess={handleClassicSuccess}
            />

            <EmailVerifyGate
              open={emailGateOpen}
              onOpenChange={setEmailGateOpen}
              onVerified={async () => {
                const { data } = await supabase.auth.getUser();
                if (data.user?.id) {
                  await maybeShowWalletLinkCta(data.user.id);
                }
                navigate('/');
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const SetupStepIndicator = ({
  step,
  currentStep,
  label,
}: {
  step: 'wallet';
  currentStep: 'wallet' | 'complete' | null;
  label: string;
}) => {
  const stepOrder = ['wallet', 'complete'];
  const currentIndex = currentStep ? stepOrder.indexOf(currentStep) : -1;
  const stepIndex = stepOrder.indexOf(step);

  const isActive = currentStep === step;
  const isComplete = currentIndex > stepIndex;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl ${
        isActive ? 'bg-primary/10 border border-primary/20' : isComplete ? 'bg-primary/5' : 'bg-muted'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isComplete
            ? 'bg-primary text-primary-foreground'
            : isActive
              ? 'bg-primary/20 text-primary'
              : 'bg-muted-foreground/20 text-muted-foreground'
        }`}
      >
        {isComplete ? 'OK' : isActive ? <Loader2 className="animate-spin" size={16} /> : '...'}
      </div>
      <span className={`text-sm ${isActive ? 'text-primary font-medium' : isComplete ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
};
