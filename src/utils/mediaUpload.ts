/**
 * Media Upload Utility
 * 
 * Triển khai theo hướng dẫn của Cha:
 * 1. Cache Busting: Đổi tên file với hash/timestamp
 * 2. Nén ảnh client-side trước khi upload
 * 3. Upload trực tiếp lên R2 qua presigned URL
 * 4. URL hiển thị qua Cloudflare Resizing
 */

import { supabase } from '@/integrations/supabase/client';
import { compressImage, FILE_LIMITS } from './imageCompression';
import { rewriteChatAttachmentUrl } from '@/lib/urlFix';

// NOTE: Use publicUrl returned by edge function. The new R2 public bucket
// is not mapped to media.fun.rich, so we must not hardcode that domain.

export interface MediaUploadResult {
  url: string;
  key: string;
  transformedUrl?: string;
}

export interface UploadOptions {
  bucket: 'posts' | 'avatars' | 'videos' | 'comment-media' | 'covers';
  compress?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

function inferContentType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'm4v':
      return 'video/x-m4v';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'txt':
      return 'text/plain';
    case 'zip':
      return 'application/zip';
    case 'rar':
      return 'application/x-rar-compressed';
    case 'apk':
      return 'application/vnd.android.package-archive';
    default:
      return null;
  }
}

/**
 * Generate unique filename with hash for cache busting
 * Format: [userId]_[timestamp]_[randomHash].[ext]
 */
export function generateCacheBustFilename(
  originalName: string,
  userId?: string
): string {
  const timestamp = Date.now();
  const randomHash = Math.random().toString(36).substring(2, 10);
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  
  // Clean extension
  const cleanExt = ext.replace(/[^a-z0-9]/g, '');
  
  if (userId) {
    return `${userId}_${timestamp}_${randomHash}.${cleanExt}`;
  }
  return `${timestamp}_${randomHash}.${cleanExt}`;
}

/**
 * Calculate file hash (SHA-256) for deduplication
 */
export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Upload media to R2 with presigned URL (Direct upload - không qua base64)
 * 
 * Flow:
 * 1. Nén ảnh nếu cần (client-side)
 * 2. Gọi API lấy presigned URL
 * 3. Upload trực tiếp lên R2
 * 4. Return URL đã transform qua Cloudflare
 */
export async function uploadMedia(
  file: File,
  options: UploadOptions
): Promise<MediaUploadResult> {
  const { bucket, compress = true, maxWidth, maxHeight, quality } = options;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');

  let processedFile = file;

  // Nén ảnh client-side nếu là ảnh
  if (compress && file.type.startsWith('image/')) {
    processedFile = await compressImage(file, {
      maxWidth: maxWidth || FILE_LIMITS.POST_IMAGE_MAX_WIDTH,
      maxHeight: maxHeight || FILE_LIMITS.POST_IMAGE_MAX_HEIGHT,
      quality: quality || 0.85,
    });
  }

  // Generate cache-busting filename
  const filename = generateCacheBustFilename(processedFile.name, user.id);
  const key = `${bucket}/${filename}`;

  const inferred = inferContentType(processedFile.name);
  const contentType = processedFile.type || inferred || 'application/octet-stream';

  // Get presigned URL từ edge function
  const { data: presignedData, error: presignedError } = await supabase.functions.invoke(
    'get-upload-url',
    {
      body: {
        key,
        contentType: contentType,
        fileSize: processedFile.size,
      },
    }
  );

  if (presignedError || !presignedData?.uploadUrl || !presignedData?.publicUrl) {
    const message = presignedError?.message || 'Không thể lấy URL upload';
    if (message.includes('File type not allowed') || message.includes('Missing key or contentType')) {
      throw new Error('FILE_TYPE_NOT_SUPPORTED');
    }
    throw new Error(message);
  }

  // Upload trực tiếp lên R2 (không qua base64)
  const uploadResponse = await fetch(presignedData.uploadUrl, {
    method: 'PUT',
    body: processedFile,
    headers: {
      'Content-Type': contentType,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload thất bại: ${uploadResponse.status}`);
  }

  const safeUrl = rewriteChatAttachmentUrl(presignedData.publicUrl);

  return {
    url: safeUrl,
    key,
    transformedUrl: safeUrl, // Caller can use imageTransform.ts for transforms
  };
}

/**
 * Upload avatar với compression tối ưu
 */
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<MediaUploadResult> {
  // Avatar luôn nén về max 512x512 với quality cao
  return uploadMedia(file, {
    bucket: 'avatars',
    compress: true,
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.9,
  });
}

/**
 * Upload cover photo
 */
export async function uploadCover(
  file: File,
  userId: string
): Promise<MediaUploadResult> {
  return uploadMedia(file, {
    bucket: 'covers',
    compress: true,
    maxWidth: 1920,
    maxHeight: 640,
    quality: 0.85,
  });
}

/**
 * Upload post image với compression hợp lý
 */
export async function uploadPostImage(file: File): Promise<MediaUploadResult> {
  return uploadMedia(file, {
    bucket: 'posts',
    compress: true,
    maxWidth: FILE_LIMITS.POST_IMAGE_MAX_WIDTH,
    maxHeight: FILE_LIMITS.POST_IMAGE_MAX_HEIGHT,
    quality: 0.85,
  });
}

/**
 * Upload video (không nén, chỉ validate size)
 */
export async function uploadVideo(file: File): Promise<MediaUploadResult> {
  if (file.size > FILE_LIMITS.VIDEO_MAX_SIZE) {
    throw new Error(`Video phải nhỏ hơn ${FILE_LIMITS.VIDEO_MAX_SIZE / (1024 * 1024)}MB`);
  }

  return uploadMedia(file, {
    bucket: 'videos',
    compress: false,
  });
}

/**
 * Upload comment media
 */
export async function uploadCommentMedia(file: File): Promise<MediaUploadResult> {
  if (file.type.startsWith('image/')) {
    return uploadMedia(file, {
      bucket: 'comment-media',
      compress: true,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
    });
  }
  
  return uploadMedia(file, {
    bucket: 'comment-media',
    compress: false,
  });
}





