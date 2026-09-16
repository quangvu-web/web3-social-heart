import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/i18n/LanguageContext';

interface PasswordManagerProps {
  hasPassword: boolean;
  onPasswordSet?: () => void;
}

export const PasswordManager = ({ hasPassword, onPasswordSet }: PasswordManagerProps) => {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Password validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      toast({
        title: t('passwordValidationError') || 'Validation Error',
        description: t('passwordRequirements') || 'Please meet all password requirements',
        variant: 'destructive',
      });
      return;
    }

    if (hasPassword && !currentPassword) {
      toast({
        title: t('currentPasswordRequired') || 'Current Password Required',
        description: t('enterCurrentPassword') || 'Please enter your current password',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: t('errorOccurred') || 'Error',
          description: t('pleaseLoginAgain') || 'Please login again',
          variant: 'destructive',
        });
        return;
      }

      const response = await supabase.functions.invoke('update-password', {
        body: {
          current_password: hasPassword ? currentPassword : undefined,
          new_password: newPassword,
          is_first_password: !hasPassword,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data.success) {
        throw new Error(response.data.error);
      }

      toast({
        title: hasPassword 
          ? (t('passwordChanged') || 'Password Changed')
          : (t('passwordCreated') || 'Password Created'),
        description: hasPassword 
          ? (t('passwordChangedSuccess') || 'Your password has been changed successfully')
          : (t('passwordCreatedSuccess') || 'You can now login with email and password'),
      });

      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      onPasswordSet?.();

    } catch (error: any) {
      console.error('[PasswordManager] Error:', error);
      toast({
        title: t('errorOccurred') || 'Error',
        description: error.message || t('tryAgain') || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ValidationItem = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-sm ${valid ? 'text-green-500' : 'text-muted-foreground'}`}>
      {valid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      <span>{text}</span>
    </div>
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          {hasPassword 
            ? (t('changePassword') || 'Change Password')
            : (t('createPassword') || 'Create Password')
          }
        </CardTitle>
        <CardDescription>
          {hasPassword 
            ? (t('changePasswordDesc') || 'Update your password to keep your account secure')
            : (t('createPasswordDesc') || 'Create a password to login with email and password')
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password - only show if user already has password */}
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="current-password">
                {t('currentPassword') || 'Current Password'}
              </Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">
              {t('newPassword') || 'New Password'}
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">
              {t('confirmPassword') || 'Confirm Password'}
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          {newPassword.length > 0 && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">{t('passwordRequirements') || 'Password Requirements'}:</p>
              <ValidationItem valid={hasMinLength} text={t('atLeast8Chars') || 'At least 8 characters'} />
              <ValidationItem valid={hasUppercase} text={t('atLeastOneUppercase') || 'At least one uppercase letter'} />
              <ValidationItem valid={hasLowercase} text={t('atLeastOneLowercase') || 'At least one lowercase letter'} />
              <ValidationItem valid={hasNumber} text={t('atLeastOneNumber') || 'At least one number'} />
              <ValidationItem valid={passwordsMatch} text={t('passwordsMustMatch') || 'Passwords must match'} />
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full"
            disabled={!isPasswordValid || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('loading') || 'Loading...'}
              </>
            ) : hasPassword ? (
              t('changePassword') || 'Change Password'
            ) : (
              t('createPassword') || 'Create Password'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
