import { supabase } from '@/integrations/supabase/client';
import { retryUploadOperation } from './uploadRetry';

export interface R2UploadResult {
  url: string;
  key: string;
}

export interface R2VideoUploadResult {
  publicUrl: string;
  key: string;
  contentType: string;
  size: number;
}

const ALLOWED_R2_KEY_BUCKETS = new Set(['avatars', 'covers', 'posts', 'videos', 'comment-media']);

function sanitizeKeySegment(input: string): string {
  return input
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('/');
}

export function extractR2KeyFromUrl(urlOrKey: string): string | null {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;

  const asKey = (candidate: string): string | null => {
    const clean = sanitizeKeySegment(candidate);
    const bucket = clean.split('/')[0];
    if (!bucket || !ALLOWED_R2_KEY_BUCKETS.has(bucket)) return null;
    return clean;
  };

  try {
    const u = new URL(urlOrKey);
    return asKey(u.pathname.replace(/^\/+/, ''));
  } catch {
    return asKey(urlOrKey);
  }
}

function getExtensionFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || 'bin';
  return ext.replace(/[^a-z0-9]/g, '') || 'bin';
}

async function getCurrentUserId(accessToken?: string): Promise<string> {
  // Prefer explicit token (when provided) so uploads work even if local session isn't hydrated.
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user?.id) throw new Error('Chưa đăng nhập');
  return user.id;
}

function buildScopedKey(bucket: string, userId: string, customPath?: string): string {
  const cleanCustom = customPath ? sanitizeKeySegment(customPath) : '';

  // Allow passing only a filename or a nested path; always scope under `<bucket>/<userId>/...`.
  // If caller accidentally includes the userId prefix, strip it to avoid double nesting.
  const stripped =
    cleanCustom === userId
      ? ''
      : cleanCustom.startsWith(`${userId}/`)
        ? cleanCustom.slice(userId.length + 1)
        : cleanCustom.startsWith(`${userId}_`)
          ? cleanCustom.slice(userId.length + 1) // keep rest of filename after `${userId}_`
          : cleanCustom;

  if (stripped) return `${bucket}/${userId}/${stripped}`;
  return `${bucket}/${userId}`;
}

/**
 * Get presigned URL from edge function with timeout
 */
async function getPresignedUrl(
  key: string,
  contentType: string,
  fileSize: number,
  accessToken?: string,
  timeoutMs: number = 30000
): Promise<{ uploadUrl: string; publicUrl: string }> {
  return retryUploadOperation(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Use provided token or get fresh one
      let token = accessToken;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Chưa đăng nhập');
        }
        token = session.access_token;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/get-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ key, contentType, fileSize }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Không thể chuẩn bị upload: ${errorData.error || `HTTP ${response.status}`}`);
      }

      const data = await response.json();
      if (!data.uploadUrl || !data.publicUrl) {
        throw new Error('Máy chủ trả về URL upload không hợp lệ');
      }

      return { uploadUrl: data.uploadUrl, publicUrl: data.publicUrl };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Hết thời gian chuẩn bị upload ảnh');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

/**
 * Upload file directly to R2 using presigned URL
 */
async function uploadWithPresignedUrl(
  file: File,
  uploadUrl: string,
  timeoutMs: number = 120000
): Promise<void> {
  await retryUploadOperation(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Upload ảnh thất bại: HTTP ${response.status}`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TypeError('Hết thời gian upload ảnh');
      }
      if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
        throw new TypeError('Không thể kết nối tới kho lưu trữ ảnh (CORS hoặc mạng)');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

/**
 * Upload video to R2 with progress tracking
 * Uses XHR for upload progress support
 */
export async function uploadVideoToR2(
  file: File,
  onProgress?: (progress: { bytesUploaded: number; bytesTotal: number; percentage: number }) => void,
  accessToken?: string
): Promise<R2VideoUploadResult> {
  const userId = await getCurrentUserId(accessToken);
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = getExtensionFromName(file.name);
  const filename = `${timestamp}-${randomString}.${extension}`;
  const key = buildScopedKey('videos', userId, filename);
  const contentType = file.type || 'video/mp4';

  const { uploadUrl, publicUrl } = await getPresignedUrl(
    key,
    contentType,
    file.size,
    accessToken,
    45000
  );

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const percentage = Math.round((event.loaded / event.total) * 100);
      onProgress({
        bytesUploaded: event.loaded,
        bytesTotal: event.total,
        percentage,
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed - network error'));
    };

    xhr.send(file);
  });

  return {
    publicUrl,
    key,
    contentType,
    size: file.size,
  };
}

/**
 * Upload file directly to Cloudflare R2 via presigned URL
 * Much more efficient than base64 - supports large files
 * @param accessToken Optional access token to avoid multiple getSession calls
 */
export async function uploadToR2(
  file: File,
  bucket: 'posts' | 'avatars' | 'videos' | 'comment-media',
  customPath?: string,
  accessToken?: string
): Promise<R2UploadResult> {
  const userId = await getCurrentUserId(accessToken);
  // Generate unique filename
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = getExtensionFromName(file.name);
  const fallbackFilename = `${timestamp}-${randomString}.${extension}`;
  const filenameOrPath = customPath || fallbackFilename;
  const key = buildScopedKey(bucket, userId, filenameOrPath);

  // Step 1: Get presigned URL from edge function
  const { uploadUrl, publicUrl } = await getPresignedUrl(
    key,
    file.type,
    file.size,
    accessToken,
    45000 // 45s timeout for getting URL (increased)
  );

  // Step 2: Upload directly to R2 using presigned URL
  await uploadWithPresignedUrl(
    file,
    uploadUrl,
    180000 // 3 min timeout for upload (large files)
  );

  return {
    url: publicUrl,
    key: key,
  };
}

/**
 * Delete file from Cloudflare R2 via edge function
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('delete-from-r2', {
      body: { key },
    });

    if (error) throw error;
  } catch (error) {
    throw error;
  }
}
