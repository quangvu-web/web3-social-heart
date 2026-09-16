import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedAuthForm } from '@/components/auth/UnifiedAuthForm';
import { useLanguage } from '@/i18n/LanguageContext';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
// Use direct paths for logos to ensure consistency across all environments
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  
  // SSO flow parameters
  const returnTo = searchParams.get('return_to');
  const ssoFlow = searchParams.get('sso_flow') === 'true';

  useEffect(() => {
    // Check if Law of Light was accepted before allowing access to auth
    const pending = localStorage.getItem('law_of_light_accepted_pending');
    if (!pending) {
      navigate('/law-of-light', { replace: true });
      return;
    }

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // If SSO flow, redirect back to authorize endpoint with token
        if (ssoFlow && returnTo) {
          handleSSORedirect(session.access_token);
        } else {
          navigate('/');
        }
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // If SSO flow, redirect back to authorize endpoint with token
        if (ssoFlow && returnTo) {
          handleSSORedirect(session.access_token);
        }
        // Otherwise handled by UnifiedAuthForm callbacks
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, ssoFlow, returnTo]);

  // Handle SSO redirect back to authorize endpoint
  const handleSSORedirect = (accessToken: string) => {
    if (!returnTo) return;
    
    try {
      // Parse the return_to URL and add authorization
      const authorizeUrl = new URL(returnTo);
      
      // Redirect to authorize endpoint - browser will make the request
      // We need to make a fetch call with the token, then redirect
      fetch(returnTo, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.redirect_uri) {
            window.location.href = data.redirect_uri;
          } else if (data.error) {
            console.error('SSO authorize error:', data);
            navigate('/');
          }
        })
        .catch(err => {
          console.error('SSO redirect error:', err);
          navigate('/');
        });
    } catch (err) {
      console.error('Invalid return_to URL:', err);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-amber-50/20 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Static background - no blur for performance */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-100/40 rounded-full" />
      </div>

      {/* Language Switcher - Top Right with 13 languages */}
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher variant="dropdown" />
      </div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center relative z-10">
        {/* Left Side - Branding */}
        <div className="text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
            {/* LCP Image - 256px with dark green metallic border */}
            <img 
              src="/fun-profile-logo-128.webp" 
              alt="FUN Profile" 
              width={256} 
              height={256}
              loading="eager"
              fetchPriority="high"
              decoding="sync"
              className="w-64 h-64 rounded-full"
              style={{
                border: '5px solid transparent',
                background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #166534 0%, #22c55e 25%, #15803d 50%, #22c55e 75%, #166534 100%) border-box',
                boxShadow: '0 0 25px rgba(22, 101, 52, 0.5), 0 10px 40px rgba(0,0,0,0.15), inset 0 0 20px rgba(22, 101, 52, 0.1)'
              }}
            />
          </div>
          {/* FUN Profile title - Metallic green 3D */}
          <h1 
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{
              background: 'linear-gradient(135deg, #166534 0%, #22c55e 30%, #15803d 50%, #22c55e 70%, #166534 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 2px 4px rgba(22, 101, 52, 0.3)',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))'
            }}
          >
            {t('authBrandTitle')}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            {t('authBrandDescription')}
          </p>
          
          {/* Feature highlights - localized */}
          <div className="mt-8 space-y-3 hidden md:block">
            <FeatureItem icon="✉️" text={t('authFeatureOtp')} />
            <FeatureItem icon="🦊" text={t('authFeatureMetamask')} />
            <FeatureItem icon="🔐" text={t('authFeatureGoogle')} />
            <FeatureItem icon="🔑" text={t('authFeatureClassic')} />
            <FeatureItem icon="💎" text={t('authFeatureSoulNft')} />
          </div>
        </div>

        {/* Right Side - Auth Form with fixed dimensions to prevent CLS */}
        <div className="w-full max-w-lg mx-auto min-h-[560px]">
          <UnifiedAuthForm />
          
          {/* Guest Mode Option */}
          <div className="mt-6 text-center">
            <div className="relative flex items-center gap-4 py-2">
              <div className="flex-1 border-t border-muted" />
              <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">
                {t('orContinueAs')}
              </span>
              <div className="flex-1 border-t border-muted" />
            </div>
            
            {/* View as Guest button with rainbow metallic border, white bg, metallic green text */}
            <div 
              className="relative p-[3px] rounded-full mt-3"
              style={{
                background: 'linear-gradient(90deg, #FF0000 0%, #FF7F00 14%, #FFFF00 28%, #00FF00 42%, #0000FF 57%, #4B0082 71%, #9400D3 85%, #FF0000 100%)',
                boxShadow: '0 0 15px rgba(255, 0, 0, 0.2), 0 0 15px rgba(0, 255, 0, 0.2), 0 0 15px rgba(0, 0, 255, 0.2)'
              }}
            >
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-center gap-3 font-bold text-xl h-14 bg-white hover:bg-slate-50 border-0 rounded-full transition-colors"
              >
                <Eye size={24} className="text-emerald-600" />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #166534 0%, #22c55e 30%, #15803d 50%, #22c55e 70%, #166534 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {t('viewAsGuest')}
                </span>
              </button>
            </div>
          </div>
          
          {/* Last line - same size as left sidebar features */}
          <p className="text-center mt-4 text-base text-muted-foreground font-medium">
            {t('authCreatePage')}
          </p>
        </div>
      </div>
    </div>
  );
};

// Feature highlight component - larger text
const FeatureItem = ({ icon, text }: { icon: string; text: string }) => (
  <div className="flex items-center gap-3 text-muted-foreground">
    <span className="text-2xl">{icon}</span>
    <span className="text-base font-medium">{text}</span>
  </div>
);

export default Auth;