import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ChatCallAdapter } from '../adapters/ChatCallAdapter';
import type { FunChatConfig } from '../config/types';

interface FunChatContextValue {
  config: FunChatConfig;
  adapter: ChatCallAdapter;
}

const FunChatContext = createContext<FunChatContextValue | null>(null);

interface FunChatProviderProps {
  config: FunChatConfig;
  adapter: ChatCallAdapter;
  children: ReactNode;
}

export function FunChatProvider({ config, adapter, children }: FunChatProviderProps) {
  const value = useMemo(
    () => ({
      config,
      adapter,
    }),
    [config, adapter]
  );

  return <FunChatContext.Provider value={value}>{children}</FunChatContext.Provider>;
}

export function useFunChatContext() {
  const ctx = useContext(FunChatContext);
  if (!ctx) {
    throw new Error('useFunChatContext must be used inside <FunChatProvider>');
  }
  return ctx;
}

