/**
 * Common Types
 * Shared type definitions used across the application
 */

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

export interface User {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name?: string | null;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string | null;
  hasMore: boolean;
  total?: number;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export type MediaType = 'image' | 'video';

export interface MediaItem {
  url: string;
  type: MediaType;
  thumbnail?: string;
}
