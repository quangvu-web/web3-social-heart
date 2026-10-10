import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface ClassicEmailLoginProps {
  onSuccess: (userId: string, isNewUser: boolean) => void;
}

export const ClassicEmailLogin = ({ onSuccess }: ClassicEmailLoginProps) => {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const getAuthSchema = () => z.object({
    email: z.string().email(t('authErrorInvalidEmail')),
    password: z.string().min(6, t('authErrorPasswordShort')),
    username: z.string().min(3, t('authErrorUsernameShort')).max(30, t('authErrorUsernameLong')).refine(
      val => !['admin', 'administrator', 'system', 'root', 'moderator', 'mod', 'support', 'help'].includes(val.toLowerCase()),
      { message: t('authErrorUsernameReserved') }
    ).optional()
  });

  // Translate Supabase errors to Vietnamese
  const translateError = (message: string): string => {
    if (message.includes('Invalid login credentials')) {
      return 'Email hoặc mật khẩu không đúng';
    }
    if (message.includes('Email not confirmed')) {
      return 'Email chưa được xác thực. Vui lòng kiểm tra hộp thư.';
    }
    if (message.includes('User already registered')) {
      return 'Email này đã được đăng ký';
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'Quá nhiều yêu cầu. Vui lòng thử lại sau.';
    }
    if (message.includes('network') || message.includes('fetch')) {
      return 'Lỗi kết nối mạng. Vui lòng kiểm tra internet.';
    }
    return message || t('authErrorGeneric');
  };

  // Check if user exists with OAuth (no password set)
  const checkOAuthUser = async (email: string): Promise<{ exists: boolean; provider?: string }> => {
    try {
      // Get profile by email prefix (username is usually email prefix)
      const emailPrefix = email.split('@')[0].toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('id, oauth_provider, has_password_set, registered_from')
        .or(`username.eq.${emailPrefix},fun_id.eq.${emailPrefix}`)
        .maybeSingle();

      if (data) {
        // Check if this is an OAuth user without password
        const isOAuthWithoutPassword = 
          data.oauth_provider && 
          ['Google', 'Email OTP', 'Wallet'].includes(data.oauth_provider) &&
          !data.has_password_set &&
          data.registered_from !== 'fun_profile_classic';

        if (isOAuthWithoutPassword) {
          return { exists: true, provider: data.oauth_provider };
        }
      }
      return { exists: false };
    } catch (error) {
      console.error('[ClassicEmailLogin] Error checking OAuth user:', error);
      return { exists: false };
    }
  };

  // Wait for profile to be created with retry logic
  const waitForProfile = async (userId: string, maxWaitMs = 5000): Promise<boolean> => {
    const startTime = Date.now();
    const retryInterval = 500;

    while (Date.now() - startTime < maxWaitMs) {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (data) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Timeout after 15 seconds
    const timeoutId = setTimeout(() => {
      setLoading(false);
      toast.error('Yêu cầu quá lâu. Vui lòng thử lại.');
    }, 15000);
    
    try {
      const authSchema = getAuthSchema();
      const validation = authSchema.safeParse({
        email,
        password,
        username: isLogin ? undefined : username
      });

      if (!validation.success) {
        toast.error(validation.error.issues[0].message);
        setLoading(false);
        clearTimeout(timeoutId);
        return;
      }

      if (isLogin) {
        // LOGIN FLOW
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          // Check if this might be an OAuth user without password
          if (error.message?.includes('Invalid login credentials')) {
            const oauthCheck = await checkOAuthUser(email);
            if (oauthCheck.exists) {
              const hint = `Tài khoản này đã đăng ký bằng ${oauthCheck.provider}. Vui lòng đăng nhập bằng ${oauthCheck.provider} trước, sau đó tạo mật khẩu trong Cài đặt.`;
              toast.info(hint, { duration: 6000 });
              clearTimeout(timeoutId);
              setLoading(false);
              return;
            }
          }
          throw error;
        }

        if (data.user) {
          // Check if profile exists, create if missing (fallback for failed trigger)
          const profileExists = await waitForProfile(data.user.id, 2000);
          
          if (!profileExists) {
            // Create profile as fallback
            const fallbackUsername = (data.user.user_metadata?.username 
              || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '');
            
            await supabase.from('profiles').insert({
              id: data.user.id,
              username: fallbackUsername,
              full_name: data.user.user_metadata?.full_name || '',
            }).select().single();
          }

          // Update last_login_platform
          await supabase.from('profiles').update({
            last_login_platform: 'FUN Profile'
          }).eq('id', data.user.id);

          toast.success(t('welcomeBack'));
          onSuccess(data.user.id, false);
        }
      } else {
        // SIGNUP FLOW
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: `${window.location.origin}/`
          }
        });

        if (error) throw error;

        if (data.user) {
          // Check if email needs confirmation
          if (!data.user.email_confirmed_at && !data.session) {
            // Email confirmation required
            toast.success('Vui lòng kiểm tra email để xác nhận tài khoản');
            clearTimeout(timeoutId);
            setLoading(false);
            return;
          }

          // Wait for profile to be created (trigger might take time)
          const profileCreated = await waitForProfile(data.user.id, 5000);
          
          if (profileCreated) {
            // Update last_login_platform
            await supabase.from('profiles').update({
              last_login_platform: 'FUN Profile'
            }).eq('id', data.user.id);
          }

          toast.success(t('authSuccessSignUp'));
          onSuccess(data.user.id, true);
        }
      }
    } catch (error: any) {
      const errorMessage = translateError(error.message);
      toast.error(errorMessage);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error(t('authErrorInvalidEmail'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`
      });
      if (error) throw error;
      toast.success(t('authSuccessPasswordReset'));
      setShowForgotPassword(false);
    } catch (error: any) {
      toast.error(error.message || t('authErrorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-slate-800">
          {isLogin ? t('authWelcomeBack') : t('authCreateAccount')}
        </h3>
        <p className="text-sm text-slate-500">
          {isLogin ? t('authSignInTitle') : t('authJoinUs')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div className="space-y-2">
            <Label htmlFor="classic-username" className="text-slate-700 font-semibold text-sm uppercase tracking-wide">
              {t('authUsername')}
            </Label>
            <Input
              id="classic-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required={!isLogin}
              placeholder={t('authUsernamePlaceholder')}
              className="h-12 rounded-full border-2 border-slate-300 bg-gradient-to-br from-white to-slate-50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/30 transition-all"
            />
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="classic-email" className="text-slate-700 font-semibold text-sm uppercase tracking-wide">
            {t('authEmail')}
          </Label>
          <Input
            id="classic-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder={t('authEmailPlaceholder')}
            className="h-12 rounded-full border-2 border-slate-300 bg-gradient-to-br from-white to-slate-50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/30 transition-all"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="classic-password" className="text-slate-700 font-semibold text-sm uppercase tracking-wide">
            {t('authPassword')}
          </Label>
          <div className="relative">
            <Input
              id="classic-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder={t('authPasswordPlaceholder')}
              className="h-12 rounded-full pr-10 border-2 border-slate-300 bg-gradient-to-br from-white to-slate-50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/30 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-500 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        
        <Button
          type="submit"
          className="w-full h-14 text-lg font-bold rounded-full relative overflow-hidden text-primary-foreground"
          disabled={loading}
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 50%, hsl(var(--primary)) 100%)',
            boxShadow: '0 4px 20px hsl(var(--primary) / 0.4)'
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {t('authInitializing')}
              </>
            ) : isLogin ? t('authSignIn') : t('authSignUp')}
          </span>
        </Button>
      </form>
      
      <div className="space-y-3">
        {isLogin && (
          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => setShowForgotPassword(!showForgotPassword)}
              className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors"
            >
              {t('authForgotPassword')}
            </button>
          </div>
        )}
        
        {showForgotPassword && (
          <div className="space-y-2">
            <Input
              type="email"
              placeholder={t('authEmailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border-2 border-slate-400 bg-card/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/50"
            />
            <Button
              onClick={handleForgotPassword}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
              disabled={loading}
            >
              {t('authSendResetEmail')}
            </Button>
          </div>
        )}
        
        <div className="text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setShowForgotPassword(false);
            }}
            className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors"
          >
            {isLogin ? t('authNoAccount') : t('authHaveAccount')}{' '}
            <span className="font-bold">{isLogin ? t('authSignUpLink') : t('authSignInLink')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
