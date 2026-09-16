import { useContext } from 'react';
import { FunChatContext } from '../context/FunChatContext';

export function useFunChat() {
  const ctx = useContext(FunChatContext);
  if (!ctx) {
    throw new Error('useFunChat must be used within <FunChatProvider>');
  }
  return ctx;
}

export function useFunChatClient() {
  return useFunChat().client;
}