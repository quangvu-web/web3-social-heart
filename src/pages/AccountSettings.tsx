import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { PasswordManager } from '@/components/settings/PasswordManager';
import { LinkedProviders } from '@/components/settings/LinkedProviders';
import { WalletLinkSection } from '@/components/settings/WalletLinkSection';
import { TelegramSecuritySection } from '@/components/settings/TelegramSecuritySection';
import { DeleteAccountDialog } from '@/components/profile/DeleteAccountDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Mail, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const AccountSettings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, profile, isAuthenticated, isLoading } = useAuth();
  const [hasPassword, setHasPassword] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(true);

  // Check if user has password set
  useEffect(() => {
    const checkPasswordStatus = async () => {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from('profiles')
          .select('has_password_set, registered_from, oauth_provider')
          .eq('id', user.id)
          .single();

        // User has password if:
        // 1. has_password_set is true, OR
        // 2. registered via classic email/password
        const passwordSet = data?.has_password_set === true || 
          data?.registered_from === 'fun_profile_classic';
        
        setHasPassword(passwordSet);
      } catch (error) {
        console.error('[AccountSettings] Error checking password status:', error);
      } finally {
        setIsLoadingPassword(false);
      }
    };

    checkPasswordStatus();
  }, [user?.id]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      
      <main className="pt-14 pb-20 md:pb-6">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                {t('accountSettings') || 'Account Settings'}
              </h1>
              <p className="text-muted-foreground">
                {t('accountSettingsDesc') || 'Manage your account security and login methods'}
              </p>
            </div>
          </div>

          {/* Email Section */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email
              </CardTitle>
              <CardDescription>
                {t('yourEmailAddress') || 'Your email address'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="font-medium">{user?.email || 'No email'}</span>
                {user?.email_confirmed_at && (
                  <span className="text-sm text-primary">
                    {t('verified') || 'Verified'} ✓
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Password Manager */}
          {isLoadingPassword ? (
            <Card className="border-border bg-card">
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <PasswordManager 
              hasPassword={hasPassword} 
              onPasswordSet={() => setHasPassword(true)}
            />
          )}

          {/* Linked Providers */}
          <LinkedProviders />

          {/* Telegram 2FA */}
          <TelegramSecuritySection />

          {/* Web3 Wallet Link */}
          <WalletLinkSection />

          <Separator />

          {/* Danger Zone */}
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                {t('dangerZone') || 'Danger Zone'}
              </CardTitle>
              <CardDescription>
                {t('dangerZoneDesc') || 'Irreversible actions for your account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteAccountDialog username={profile?.username || 'user'} />
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default AccountSettings;
