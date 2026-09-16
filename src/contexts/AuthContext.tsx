import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/asyncTimeout';

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  cover_url: string | null;
  law_of_light_accepted: boolean;
  law_of_light_accepted_at: string | null;
  custodial_wallet_address: string | null;
  external_wallet_address: string | null;
  default_wallet_type: string | null;
  wallet_address: string | null;
  soul_level: number;
  pending_reward: number;
  approved_reward: number;
  total_rewards: number;
  // New fields for unified auth
  oauth_provider: string | null;
  registered_from: string | null;
  has_password_set: boolean;
  trust_level: number;
  email_claimed: string | null;
  email_verified_at: string | null;
  wallet_verified_at: string | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  telegram_2fa_enabled: boolean;
  telegram_linked_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  bootstrapError: Error | null;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retryBootstrap: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);

  // Refs to avoid closure stale-state issues
  const isMountedRef = useRef(true);
  const inflightFetchRef = useRef<Promise<Profile | null> | null>(null);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Share in-flight promise to avoid races between concurrent auth events
    if (inflightFetchRef.current) {
      return inflightFetchRef.current;
    }

    const run = (async (): Promise<Profile | null> => {
      try {
        const { data, error } = await withTimeout(supabase
          .from('profiles')
          .select(`
            id,
            username,
            full_name,
            avatar_url,
            bio,
            cover_url,
            law_of_light_accepted,
            law_of_light_accepted_at,
            custodial_wallet_address,
            external_wallet_address,
            default_wallet_type,
            wallet_address,
            soul_level,
            pending_reward,
            approved_reward,
            total_rewards,
            oauth_provider,
            registered_from,
            has_password_set,
            trust_level,
            email_claimed,
            email_verified_at,
            wallet_verified_at,
            telegram_chat_id,
            telegram_username,
            telegram_2fa_enabled,
            telegram_linked_at
          `)
          .eq('id', userId)
          .maybeSingle(), 8_000, 'profile fetch timeout');

        if (error) {
          console.error('[AuthContext] Error fetching profile:', error);
          return null;
        }

        if (isMountedRef.current && data) {
          setProfile(data);
        }
        return data;
      } catch (err) {
        console.error('[AuthContext] Profile fetch error:', err);
        return null;
      }
    })();

    inflightFetchRef.current = run;
    try {
      return await run;
    } finally {
      inflightFetchRef.current = null;
    }
  }, []);

  // Reserved usernames that cannot be used directly
  const RESERVED_USERNAMES = [
    'admin','administrator','system','root','moderator','mod',
    'support','help','lovable','supabase','null','undefined',
    'api','www','mail','email','test','demo'
  ];

  const generateSafeUsername = useCallback((user: User): string => {
    const MAX_BASE = 24; // leave room for `_xxxxxx` suffix; constraint is 3..30
    const rawSource = user.user_metadata?.username
      || user.email?.split('@')[0]
      || `user_${user.id.slice(0, 8)}`;

    let base = String(rawSource).toLowerCase().replace(/[^a-z0-9_]/g, '');

    // Pad too-short bases with user id slice
    if (base.length < 3) {
      base = `user_${user.id.slice(0, 8)}`.replace(/[^a-z0-9_]/g, '');
    }

    // Truncate to leave room for random suffix
    if (base.length > MAX_BASE) {
      base = base.slice(0, MAX_BASE);
    }

    // If reserved, append user id prefix then re-truncate
    if (RESERVED_USERNAMES.includes(base)) {
      base = `${base}_${user.id.slice(0, 8)}`.slice(0, MAX_BASE);
    }

    return base;
  }, []);

  // Ensure profile exists - create if missing (fallback for when trigger fails)
  const ensureProfile = useCallback(async (user: User): Promise<Profile | null> => {
    // Try to fetch first
    let profile = await fetchProfile(user.id);
    if (profile) return profile;

    console.log('[AuthContext] Profile not found, creating fallback...');

    const username = generateSafeUsername(user);
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let finalUsername = attempt === 0
        ? username
        : `${username}_${Math.random().toString(36).slice(2, 8)}`;

      // Defensive: enforce 3..30 constraint client-side
      if (finalUsername.length > 30) finalUsername = finalUsername.slice(0, 30);
      if (finalUsername.length < 3) {
        finalUsername = `${finalUsername}${user.id.slice(0, 8)}`.slice(0, 30);
      }

      try {
        const { data, error } = await withTimeout(supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: finalUsername,
            full_name: user.user_metadata?.full_name || '',
            avatar_url: user.user_metadata?.avatar_url || null,
            law_of_light_accepted: false,
          })
          .select(`
            id, username, full_name, avatar_url, bio, cover_url,
            law_of_light_accepted, law_of_light_accepted_at,
            custodial_wallet_address, external_wallet_address,
            default_wallet_type, wallet_address, soul_level,
            pending_reward, approved_reward, total_rewards,
            oauth_provider, registered_from, has_password_set,
            trust_level, email_claimed, email_verified_at, wallet_verified_at,
            telegram_chat_id, telegram_username, telegram_2fa_enabled, telegram_linked_at
          `)
          .maybeSingle(), 8_000, 'profile create timeout');

        if (!error && data) {
          console.log('[AuthContext] Fallback profile created:', finalUsername);
          if (isMountedRef.current) {
            setProfile(data);
          }
          return data;
        }

        if (error) {
          console.warn('[AuthContext] Insert profile failed (attempt', attempt, '):', error.code, error.message);
          // Any insert error → maybe profile already exists, try fetch by id
          const existing = await fetchProfile(user.id);
          if (existing) return existing;
          // Otherwise retry with a new suffix
          continue;
        }
      } catch (err) {
        console.error('[AuthContext] Fallback profile creation error:', err);
        const existing = await fetchProfile(user.id);
        if (existing) return existing;
      }
    }

    console.warn('[AuthContext] Could not create or fetch profile after retries; continuing without profile');
    return null;
  }, [fetchProfile, generateSafeUsername]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
      }
    } catch (error) {
      console.error('[AuthContext] Sign out error:', error);
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    setBootstrapError(null);
    try {
      const { data: { session: initialSession }, error } = await withTimeout(
        supabase.auth.getSession(),
        8_000,
        'auth session timeout',
      );
      
      if (error) {
        console.error('[AuthContext] Get session error:', error);
      }

      if (!isMountedRef.current) return;

      let freshUser = initialSession?.user ?? null;
      if (initialSession) {
        try {
          const { data: { user: latestUser } } = await withTimeout(
            supabase.auth.getUser(),
            8_000,
            'auth user timeout',
          );
          if (latestUser && isMountedRef.current) {
            freshUser = latestUser;
          }
        } catch (userError) {
          console.warn('[AuthContext] Fresh user fetch failed, using session user:', userError);
        }
      }

      setSession(initialSession);
      setUser(freshUser);

      if (initialSession?.user) {
        await withTimeout(
          ensureProfile(initialSession.user),
          10_000,
          'profile bootstrap timeout',
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Auth bootstrap failed');
      console.error('[AuthContext] Initialize auth error:', error);
      if (isMountedRef.current) {
        setBootstrapError(error);
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [ensureProfile]);

  useEffect(() => {
    isMountedRef.current = true;

    // 1. Set up auth state change listener FIRST (as per Supabase docs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMountedRef.current) return;

        console.log('[AuthContext] Auth state change:', event, newSession?.user?.id);

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid potential Supabase deadlock
          // See: https://github.com/supabase/supabase-js/issues/870
          setTimeout(() => {
            if (isMountedRef.current) {
              ensureProfile(newSession.user);
            }
          }, 0);

          // Fire-and-forget: sync user to FUN Core API on sign-in (only if not yet synced).
          if (event === 'SIGNED_IN') {
            setTimeout(() => {
              void (async () => {
                try {
                  const { data: prof } = await supabase
                    .from('profiles')
                    .select('fun_id')
                    .eq('id', newSession.user.id)
                    .maybeSingle();
                  if (prof?.fun_id) return;
                  const { error } = await supabase.functions.invoke('sync-fun-user');
                  if (error) console.warn('[AuthContext] sync-fun-user failed', error);
                } catch (e) {
                  console.warn('[AuthContext] sync-fun-user threw', e);
                }
              })();
            }, 500);
          }
        } else {
          setProfile(null);
        }
      }
    );

    initializeAuth();

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [ensureProfile, initializeAuth]);

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    bootstrapError,
    isAuthenticated: !!session && !!user,
    signOut,
    refreshProfile,
    retryBootstrap: initializeAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
