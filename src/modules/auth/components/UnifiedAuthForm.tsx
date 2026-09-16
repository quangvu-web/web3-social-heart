import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EmailOtpLogin } from './EmailOtpLogin';
import { WalletLogin } from './WalletLogin';
import { SocialLogin } from './SocialLogin';
import { ClassicEmailLogin } from './ClassicEmailLogin';
import { Mail, Wallet, Users, Loader2, Sparkles, KeyRound } from 'lucide-react';

export const UnifiedAuthForm = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('email');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupStep, setSetupStep] = useState<'wallet' | 'complete' | null>(null);

  const handleNewUserSetup = async (userId: string, hasExternalWallet: boolean) => {
    setIsSettingUp(true);

    try {
      // Step 1: Update law_of_light_accepted if pending
      const lawOfLightPending = localStorage.getItem('law_of_light_accepted_pending');
      if (lawOfLightPending === 'true') {
        console.log('[Setup] Updating law_of_light_accepted for user:', userId);
        await supabase.from('profiles').update({
          law_of_light_accepted: true,
          law_of_light_accepted_at: new Date().toISOString()
        }).eq('id', userId);
        localStorage.removeItem('law_of_light_accepted_pending');
      }

      // Step 2: Create custodial wallet (only if NOT using external wallet)
      if (!hasExternalWallet) {
        setSetupStep('wallet');
        console.log('[Setup] Creating custodial wallet for user:', userId);
        
        const { data: walletData, error: walletError } = await supabase.functions.invoke('create-custodial-wallet', {
          body: { user_id: userId },
        });

        if (walletError) {
          console.error('[Setup] Wallet creation error:', walletError);
          toast.error(t('walletCreationFailed') || 'Failed to create wallet');
        } else {
          console.log('[Setup] Custodial wallet created:', walletData);
        }
      } else {
        console.log('[Setup] Skipping wallet creation - user has external wallet');
      }

      // Note: Soul NFT minting will be done later when user meets conditions

      setSetupStep('complete');
      toast.success(t('accountSetupComplete'));
      
      // Small delay to show completion state
      await new Promise(resolve => setTimeout(resolve, 800));
      navigate('/');
    } catch (error) {
      console.error('[Setup] Setup error:', error);
      // Still navigate even if setup fails
      navigate('/');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleAuthSuccess = async (userId: string, isNewUser: boolean, hasExternalWallet = false) => {
    // Verify session is properly set before proceeding
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('[Auth] No session found after auth success');
      toast.error(t('authErrorGeneric'));
      return;
    }

    console.log('[Auth] Session verified for user:', userId, 'isNewUser:', isNewUser, 'hasExternalWallet:', hasExternalWallet);

    if (isNewUser) {
      await handleNewUserSetup(userId, hasExternalWallet);
    } else {
      toast.success(t('welcomeBack'));
      navigate('/');
    }
  };

  // Callback handlers for each auth method
  const handleOtpSuccess = (userId: string, isNewUser: boolean) => {
    handleAuthSuccess(userId, isNewUser, false); // No external wallet
  };

  const handleWalletSuccess = (userId: string, isNewUser: boolean) => {
    handleAuthSuccess(userId, isNewUser, true); // Has external wallet
  };

  const handleSocialSuccess = (userId: string, isNewUser: boolean) => {
    handleAuthSuccess(userId, isNewUser, false); // No external wallet
  };

  const handleClassicSuccess = (userId: string, isNewUser: boolean) => {
    handleAuthSuccess(userId, isNewUser, false); // No external wallet
  };

  // Show setup progress overlay - simplified for performance
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
                  <h3 className="text-xl font-bold text-foreground">
                    {t('welcomeNewUser')}
                  </h3>
                  
                  <div className="space-y-3 mt-6">
                    <SetupStepIndicator
                      step="wallet"
                      currentStep={setupStep}
                      label={t('creatingWallet')}
                    />
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
      {/* Outer Frame - Premium dark green metallic with shine */}
      <div 
        className="relative p-[4px] rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #166534 0%, #22c55e 25%, #15803d 50%, #22c55e 75%, #166534 100%)',
          boxShadow: '0 0 25px rgba(22, 101, 52, 0.5), 0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
        }}
      >
        
        {/* Inner Card - clean white background */}
        <Card className="relative border-0 overflow-hidden rounded-[20px] bg-card shadow-inner p-2">
          <CardHeader className="pb-4">
            {/* Step into the Light - Metallic green 3D - 40% larger */}
            <CardTitle 
              className="text-4xl font-bold text-center"
              style={{
                background: 'linear-gradient(135deg, #166534 0%, #22c55e 30%, #15803d 50%, #22c55e 70%, #166534 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))'
              }}
            >
              {t('lightCloakWelcome')}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground text-base mt-2">
              {t('lightCloakDescription')}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6 bg-muted/50 p-1.5 rounded-full border border-[#166534]/30">
                <TabsTrigger 
                  value="email" 
                  className="flex items-center gap-1.5 rounded-full data-[state=active]:bg-card data-[state=active]:shadow-md transition-colors text-sm sm:text-base font-semibold"
                  style={{
                    color: '#166534'
                  }}
                >
                  <Mail size={16} />
                  <span className="hidden sm:inline">OTP</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="wallet"
                  className="flex items-center gap-1.5 rounded-full data-[state=active]:bg-card data-[state=active]:shadow-md transition-colors text-sm sm:text-base font-semibold"
                  style={{
                    color: '#166534'
                  }}
                >
                  <Wallet size={16} />
                  <span className="hidden sm:inline">{t('authMethodWallet')}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="social"
                  className="flex items-center gap-1.5 rounded-full data-[state=active]:bg-card data-[state=active]:shadow-md transition-colors text-sm sm:text-base font-semibold"
                  style={{
                    color: '#166534'
                  }}
                >
                  <Users size={16} />
                  <span className="hidden sm:inline">{t('authMethodSocial')}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="classic"
                  className="flex items-center gap-1.5 rounded-full data-[state=active]:bg-card data-[state=active]:shadow-md transition-colors text-sm sm:text-base font-semibold"
                  style={{
                    color: '#166534'
                  }}
                >
                  <KeyRound size={16} />
                  <span className="hidden sm:inline">{t('classicLogin')}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="mt-0">
                <EmailOtpLogin onSuccess={handleOtpSuccess} />
              </TabsContent>

              <TabsContent value="wallet" className="mt-0">
                <WalletLogin onSuccess={handleWalletSuccess} />
              </TabsContent>

              <TabsContent value="social" className="mt-0">
                <SocialLogin onSuccess={handleSocialSuccess} />
              </TabsContent>

              <TabsContent value="classic" className="mt-0">
                <ClassicEmailLogin onSuccess={handleClassicSuccess} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Helper component for setup progress - simplified styles
const SetupStepIndicator = ({ 
  step, 
  currentStep, 
  label 
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
    <div className={`flex items-center gap-3 p-3 rounded-xl ${
      isActive ? 'bg-primary/10 border border-primary/20' : 
      isComplete ? 'bg-primary/5' : 'bg-muted'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        isComplete ? 'bg-primary text-primary-foreground' :
        isActive ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'
      }`}>
        {isComplete ? '✓' : isActive ? <Loader2 className="animate-spin" size={16} /> : '○'}
      </div>
      <span className={`text-sm ${
        isActive ? 'text-primary font-medium' : 
        isComplete ? 'text-primary' : 'text-muted-foreground'
      }`}>
        {label}
      </span>
    </div>
  );
};
