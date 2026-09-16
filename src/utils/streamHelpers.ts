/**
 * Cloudflare Stream Video Helpers
 * Centralized utilities for video deletion and management
 */

import { supabase } from '@/integrations/supabase/client';
import { extractStreamUid, isStreamUrl } from './streamUpload';

/**
 * Delete a video from Cloudflare Stream by URL
 * Extracts UID and calls the stream-video edge function
 * 
 * @param videoUrl - Cloudflare Stream video URL
 * @returns true if deletion was successful, false otherwise
 */
export async function deleteStreamVideoByUrl(videoUrl: string): Promise<boolean> {
  const uid = extractStreamUid(videoUrl);
  if (!uid) {
    console.warn('[streamHelpers] Could not extract UID from URL:', videoUrl);
    return false;
  }
  
  return deleteStreamVideoByUid(uid);
}

/**
 * Delete a video from Cloudflare Stream by UID
 * 
 * @param uid - Cloudflare Stream video UID
 * @returns true if deletion was successful, false otherwise
 */
export async function deleteStreamVideoByUid(uid: string): Promise<boolean> {
  try {
    console.log('[streamHelpers] Deleting Stream video:', uid);
    const { data, error } = await supabase.functions.invoke('stream-video', {
      body: { action: 'delete', uid },
    });
    
    if (error) {
      console.error('[streamHelpers] Stream video delete error:', error);
      return false;
    }
    
    console.log('[streamHelpers] Stream video deleted successfully:', uid, data);
    return true;
  } catch (error) {
    console.error('[streamHelpers] Failed to delete Stream video:', error);
    return false;
  }
}

/**
 * Delete multiple Stream videos in parallel
 * 
 * @param videoUrls - Array of Cloudflare Stream video URLs
 * @returns Object with success count and total count
 */
export async function deleteStreamVideos(videoUrls: string[]): Promise<{ 
  successCount: number; 
  totalCount: number 
}> {
  if (videoUrls.length === 0) {
    return { successCount: 0, totalCount: 0 };
  }
  
  console.log('[streamHelpers] Deleting', videoUrls.length, 'videos');
  const results = await Promise.all(videoUrls.map(deleteStreamVideoByUrl));
  const successCount = results.filter(Boolean).length;
  console.log('[streamHelpers] Deleted', successCount, 'of', videoUrls.length, 'videos');
  
  return { successCount, totalCount: videoUrls.length };
}

/**
 * Extract all Stream video URLs from a post's media
 */
export function extractPostStreamVideos(post: {
  video_url?: string | null;
  media_urls?: Array<{ url: string; type: 'image' | 'video' }> | null;
}): string[] {
  const videoUrls: string[] = [];
  if (post.video_url && isStreamUrl(post.video_url)) {
    videoUrls.push(post.video_url);
  }
  if (post.media_urls && Array.isArray(post.media_urls)) {
    post.media_urls.forEach((media) => {
      if (media.type === 'video' && isStreamUrl(media.url)) {
        videoUrls.push(media.url);
      }
    });
  }
  return videoUrls;
}

/**
 * Collect all unique Cloudflare Stream UIDs from a post,
 * including those embedded in metadata (e.g. live replays).
 */
export function collectPostStreamUids(post: {
  video_url?: string | null;
  media_urls?: Array<{ url: string; type: 'image' | 'video' }> | null;
  metadata?: Record<string, any> | null;
}): string[] {
  const uids = new Set<string>();

  for (const url of extractPostStreamVideos(post)) {
    const uid = extractStreamUid(url);
    if (uid) uids.add(uid);
  }

  const md = post.metadata || {};
  const directUid = typeof md.stream_uid === 'string' ? md.stream_uid : null;
  if (directUid && /^[a-f0-9]{32}$/i.test(directUid)) uids.add(directUid);

  for (const key of ['playback_hls', 'playback_mp4', 'playback_url', 'playback_dash']) {
    const v = md[key];
    if (typeof v === 'string' && isStreamUrl(v)) {
      const uid = extractStreamUid(v);
      if (uid) uids.add(uid);
    }
  }

  return Array.from(uids);
}

/**
 * Delete every Cloudflare Stream video referenced by a post (legacy URLs + live metadata).
 */
export async function deleteStreamVideosByPost(post: {
  video_url?: string | null;
  media_urls?: Array<{ url: string; type: 'image' | 'video' }> | null;
  metadata?: Record<string, any> | null;
}): Promise<{ successCount: number; totalCount: number }> {
  const uids = collectPostStreamUids(post);
  if (uids.length === 0) return { successCount: 0, totalCount: 0 };
  const results = await Promise.all(uids.map(deleteStreamVideoByUid));
  return { successCount: results.filter(Boolean).length, totalCount: uids.length };
}

// Re-export commonly used functions for convenience
export { extractStreamUid, isStreamUrl } from './streamUpload';
