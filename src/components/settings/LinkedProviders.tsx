import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Wallet, Chrome, Smartphone, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';

export const LinkedProviders = () => {
  const { t } = useLanguage();
  const { user, profile } = useAuth();

  // Build a normalized set of linked providers from all available sources
  const linkedProviderSet = new Set<string>();
  // Source 1: user.identities (most reliable, comes from auth system)
  if (Array.isArray(user?.identities)) {
    user.identities.forEach((id: any) => {
      if (id.provider) linkedProviderSet.add(id.provider.toLowerCase());
    });
  }
  // Source 2: app_metadata.providers array
  if (Array.isArray(user?.app_metadata?.providers)) {
    user.app_metadata.providers.forEach((p: string) => linkedProviderSet.add(p.toLowerCase()));
  }
  // Source 3: app_metadata.provider (initial registration provider)
  if (user?.app_metadata?.provider) {
    linkedProviderSet.add(user.app_metadata.provider.toLowerCase());
  }
  // Source 4: profile.oauth_provider
  if (profile?.oauth_provider) {
    linkedProviderSet.add(profile.oauth_provider.toLowerCase());
  }

  // Determine which providers are linked based on profile data
  const providers = [
    {
      id: 'email',
      name: t('emailOtp') || 'Email OTP',
      icon: Mail,
      isLinked: !!user?.email && !user.email.includes('@wallet.fun'),
      detail: user?.email && !user.email.includes('@wallet.fun') ? user.email : null,
      color: 'bg-blue-500',
    },
    {
      id: 'google',
      name: 'Google',
      icon: Chrome,
      isLinked: linkedProviderSet.has('google'),
      detail: linkedProviderSet.has('google') ? user?.email : null,
      color: 'bg-red-500',
    },
    {
      id: 'wallet',
      name: t('wallet') || 'Wallet',
      icon: Wallet,
      isLinked: !!profile?.external_wallet_address || !!profile?.custodial_wallet_address,
      detail: profile?.external_wallet_address 
        ? `${profile.external_wallet_address.slice(0, 6)}...${profile.external_wallet_address.slice(-4)}`
        : profile?.custodial_wallet_address
          ? `${profile.custodial_wallet_address.slice(0, 6)}...${profile.custodial_wallet_address.slice(-4)}`
          : null,
      color: 'bg-orange-500',
    },
    {
      id: 'classic',
      name: t('classicLogin') || 'Email & Password',
      icon: Smartphone,
      isLinked: profile?.has_password_set === true || profile?.registered_from === 'fun_profile_classic',
      detail: profile?.has_password_set ? (t('passwordSet') || 'Password set') : null,
      color: 'bg-green-500',
    },
  ];

  const linkedCount = providers.filter(p => p.isLinked).length;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('linkedProviders') || 'Linked Login Methods'}</span>
          <Badge variant="secondary">
            {linkedCount} {t('linked') || 'linked'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {t('linkedProvidersDesc') || 'Login methods connected to your account'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                provider.isLinked 
                  ? 'border-primary/30 bg-primary/5' 
                  : 'border-border bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${provider.color} flex items-center justify-center`}>
                  <provider.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">{provider.name}</p>
                  {provider.detail && (
                    <p className="text-sm text-muted-foreground">{provider.detail}</p>
                  )}
                </div>
              </div>
              {provider.isLinked ? (
                <Badge variant="default" className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                  <Check className="w-3 h-3 mr-1" />
                  {t('connected') || 'Connected'}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  {t('notConnected') || 'Not connected'}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
