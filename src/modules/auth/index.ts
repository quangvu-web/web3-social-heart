/**
 * Auth Module
 * 
 * Handles all authentication-related functionality:
 * - Email OTP login
 * - Classic email/password login
 * - Social login (Google)
 * - Web3 wallet login
 * - Law of Light acceptance guard
 * - Centralized auth state management via AuthContext
 * 
 * Usage:
 * ```tsx
 * import { UnifiedAuthForm, LawOfLightGuard, useAuth } from '@/modules/auth';
 * ```
 */

// Components
export { UnifiedAuthForm } from './components/UnifiedAuthForm';
export { EmailOtpLogin } from './components/EmailOtpLogin';
export { ClassicEmailLogin } from './components/ClassicEmailLogin';
export { SocialLogin } from './components/SocialLogin';
export { WalletLogin } from './components/WalletLogin';
export { WalletLoginProviders } from './components/WalletLoginProviders';
export { WalletLoginContent } from './components/WalletLoginContent';
export { LawOfLightGuard } from './components/LawOfLightGuard';

// Context & Hooks
export { useAuth, AuthProvider } from '@/contexts/AuthContext';
export { useUnifiedAuth } from './hooks/useUnifiedAuth';
export {
  loginWithOtp,
  loginWithOAuth,
  loginWithPassword,
  linkWallet,
  unlinkWallet,
} from './unifiedAuth';

// Pages
export { default as AuthPage } from './pages/Auth';
export { default as LawOfLightPage } from './pages/LawOfLight';
export { default as SetPasswordPage } from './pages/SetPassword';

// Types
export type { 
  AuthUser, 
  AuthSession, 
  OtpLoginResult, 
  Web3AuthResult,
  AuthFormState,
  AuthMethod,
  AuthStep 
} from './types';
