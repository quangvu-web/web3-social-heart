import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { linkWallet as linkWalletApi, unlinkWallet as unlinkWalletApi, type UserWallet } from "../unifiedAuth";

type UnifiedProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  has_password_set: boolean | null;
  external_wallet_address: string | null;
  trust_level: number;
  email_claimed: string | null;
  email_verified_at: string | null;
  wallet_verified_at: string | null;
};

export function useUnifiedAuth() {
  const isMountedRef = useRef(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const userId = user?.id ?? null;

  const profileQuery = useQuery({
    queryKey: ['unified-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, has_password_set, external_wallet_address, trust_level, email_claimed, email_verified_at, wallet_verified_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.error("[useUnifiedAuth] profile load failed:", error);
        return null;
      }
      return (data ?? null) as UnifiedProfile | null;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const walletsQuery = useQuery({
    queryKey: ['unified-wallets', userId],
    queryFn: async () => {
      if (!userId) return [] as UserWallet[];
      const { data, error } = await supabase
        .from("user_wallets")
        .select("id, user_id, address, chain_id, is_primary, verified_at, created_at")
        .eq("user_id", userId)
        .order("is_primary", { ascending: false })
        .order("verified_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[useUnifiedAuth] wallets load failed:", error);
        return [] as UserWallet[];
      }
      return (data ?? []) as UserWallet[];
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const profile = profileQuery.data ?? null;
  const wallets = walletsQuery.data ?? [];

  const refresh = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    if (currentSession?.user) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['unified-profile', currentSession.user.id] }),
        queryClient.invalidateQueries({ queryKey: ['unified-wallets', currentSession.user.id] }),
      ]);
    }
  }, [queryClient]);

  const linkWallet = useCallback(async () => {
    const wallet = await linkWalletApi();
    await refresh();
    return wallet;
  }, [refresh]);

  const unlinkWallet = useCallback(
    async (input: { chainId?: number | null; address?: string; walletId?: string }) => {
      await unlinkWalletApi(input);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    isMountedRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMountedRef.current) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        queryClient.invalidateQueries({ queryKey: ['unified-profile', newSession.user.id] });
        queryClient.invalidateQueries({ queryKey: ['unified-wallets', newSession.user.id] });
      }
    });

    void (async () => {
      try {
        await refresh();
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [queryClient, refresh]);

  return {
    session,
    user,
    profile,
    wallets,
    isLoading,
    linkWallet,
    unlinkWallet,
    refresh,
  };
}
