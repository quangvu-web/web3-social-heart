/**
 * Modules Index
 * 
 * Central export point for all feature modules.
 * Import from specific modules for better tree-shaking:
 * 
 * ```tsx
 * import { AuthPage, useAuth } from '@/modules/auth';
 * import { ChatPage, useMessages } from '@/modules/chat';
 * ```
 */

export * from './auth';
export * from './chat';
export * from './feed';
export * from './live';
// export * from './friends';
// export * from './wallet';
// export * from './profile';
// export * from './admin';
