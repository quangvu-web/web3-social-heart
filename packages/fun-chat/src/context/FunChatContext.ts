import { createContext } from 'react';
import type { FunChatContextValue } from '../config/types';

export const FunChatContext = createContext<FunChatContextValue | null>(null);