/**
 * Feed Module Types
 * Centralized type definitions for the feed feature
 */

// Post types
export interface PostProfile {
  username: string;
  avatar_url: string | null;
  full_name?: string | null;
}

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

export interface Post {
  id: string;
  content: string;
  image_url: string | null;
  video_url?: string | null;
  media_urls?: MediaItem[] | null;
  post_type?: 'text' | 'live' | 'live_replay' | string;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at?: string;
  user_id: string;
  visibility?: string;
  location?: string | null;
  profiles: PostProfile;
}

export interface FeedPost extends Post {
  visibility: string;
}

// Reaction types
export interface PostReaction {
  id: string;
  user_id: string;
  type: string;
}

export interface PostStats {
  reactions: PostReaction[];
  commentCount: number;
  shareCount: number;
}

export interface ReactionCount {
  type: string;
  count: number;
}

export type ReactionType = 'like' | 'love' | 'care' | 'haha' | 'wow' | 'pray' | 'sad' | 'angry';

// Comment types
export interface Comment {
  id: string;
  content: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  profiles: PostProfile;
  replies?: Comment[];
}

// Feeling/Activity types
export interface FeelingActivity {
  type: 'feeling' | 'activity';
  emoji: string;
  text: string;
}

// Tagged friend type
export interface TaggedFriend {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

// Upload state types
export type VideoUploadState = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

// Privacy types
export interface PrivacyOption {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Draft attachment for composer (before upload)
export interface DraftAttachment {
  id: string;
  kind: 'image' | 'video';
  file?: File;
  previewUrl?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  storageKey?: string;
  width?: number;
  height?: number;
  duration?: number;
  sizeBytes: number;
  mimeType: string;
  uploadStatus: 'local' | 'uploading' | 'uploaded' | 'error';
  progress?: number;
  error?: string;
  sortOrder: number;
  source: 'picker' | 'paste' | 'drop';
  altText: string;
  transformMeta?: Record<string, unknown> | null;
}

export interface AttachmentPayload {
  file_url: string;
  storage_key: string | null;
  file_type: 'image' | 'video';
  mime_type: string;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  size_bytes?: number | null;
  sort_order: number;
  alt_text?: string | null;
  transform_meta?: Record<string, unknown> | null;
}
