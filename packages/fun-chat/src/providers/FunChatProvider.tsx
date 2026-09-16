import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { FunChatContext } from '../context/FunChatContext';
import type { FunChatConfig, FunChatResolvedFeatures } from '../config/types';
import type { User } from '@supabase/supabase-js';

const defaultFeatures: FunChatResolvedFeatures = {
  calls: false,
  attachments: false,
  reactions: true,
  readReceipts: true,
};

function resolveFeatures(config: FunChatConfig): FunChatResolvedFeatures {
  return {
    calls: config.features?.calls ?? defaultFeatures.calls,
    attachments: config.features?.attachments ?? defaultFeatures.attachments,
    reactions: config.features?.reactions ?? defaultFeatures.reactions,
    readReceipts: config.features?.readReceipts ?? defaultFeatures.readReceipts,
  };
}

function ProviderInner({ config, children }: { config: FunChatConfig; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const client = useMemo(() => {
    if (config.supabaseClient) return config.supabaseClient;
    if (config.supabaseUrl && config.supabaseAnonKey) {
      return createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    throw new Error('FunChatProvider requires either supabaseClient or supabaseUrl + supabaseAnonKey');
  }, [config]);

  const features = useMemo(() => resolveFeatures(config), [config]);

  useEffect(() => {
    let mounted = true;

    client.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) {
          config.callbacks?.onError?.(error);
          return;
        }
        if (!mounted) return;
        setUser(data.user ?? null);
        if (!data.user) config.callbacks?.onRequireAuth?.();
      })
      .catch((error) => {
        config.callbacks?.onError?.(error);
      });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) config.callbacks?.onRequireAuth?.();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [client, config]);

  const value = useMemo(
    () => ({
      config,
      client,
      user,
      features,
    }),
    [config, client, user, features]
  );

  return <FunChatContext.Provider value={value}>{children}</FunChatContext.Provider>;
}

function QueryBoundary({ config, children }: { config: FunChatConfig; children: ReactNode }) {
  let existingQueryClient: QueryClient | null = null;
  try {
    existingQueryClient = useQueryClient();
  } catch {
    existingQueryClient = null;
  }

  const localClient = useMemo(() => new QueryClient(), []);

  if (existingQueryClient) {
    return <ProviderInner config={config}>{children}</ProviderInner>;
  }

  return (
    <QueryClientProvider client={localClient}>
      <ProviderInner config={config}>{children}</ProviderInner>
    </QueryClientProvider>
  );
}

export function FunChatProvider({ config, children }: { config: FunChatConfig; children: ReactNode }) {
  return <QueryBoundary config={config}>{children}</QueryBoundary>;
}