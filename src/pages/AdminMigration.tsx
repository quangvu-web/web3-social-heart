import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, Database, CheckCircle, XCircle, AlertTriangle, SkipForward, StopCircle, Wrench, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';

interface MigrationResult {
  total: number;
  migrated: number;
  alreadyOnR2: number;
  errors: Array<{ url: string; error: string }>;
}

interface FixUrlResult {
  total: number;
  fixed: number;
  errors: Array<{ url: string; error: string }>;
  details?: Array<{ table: string; field: string; oldUrl: string; newUrl: string }>;
}

interface CleanupResult {
  dryRun: boolean;
  totalFiles: number;
  totalDeleted: number;
  buckets: Array<{
    bucket: string;
    totalFiles: number;
    deleted: number;
    errors: Array<{ file: string; error: string }>;
  }>;
}

interface OrphanVideoResult {
  totalVideosOnStream: number;
  totalVideosInDb: number;
  orphanVideosFound: number;
  orphanVideosDeleted: number;
  errors: string[];
  deletedUids: string[];
  dryRun: boolean;
}

const AdminMigration = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [fixingUrls, setFixingUrls] = useState(false);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [fixUrlResult, setFixUrlResult] = useState<FixUrlResult | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [cleaningOrphanVideos, setCleaningOrphanVideos] = useState(false);
  const [orphanVideoResult, setOrphanVideoResult] = useState<OrphanVideoResult | null>(null);
  
  // Skip/Stop controls
  const skipCurrentRef = useRef(false);
  const stopProcessRef = useRef(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data: hasRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (!hasRole) {
        toast.error('Bạn không có quyền truy cập trang này');
        navigate('/');
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const getPresignedUrl = async (key: string, contentType: string, fileSize: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-presigned-url`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, contentType, fileSize }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get presigned URL');
    }

    return response.json();
  };

  // Update media URL via edge function (bypasses RLS)
  const updateMediaUrlViaEdgeFunction = async (
    table: string,
    id: string,
    field: string,
    newUrl: string
  ): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-media-url`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ table, id, field, newUrl }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update media URL');
    }
  };

  const uploadWithPresignedUrl = async (
    presignedUrl: string, 
    fileBlob: Blob, 
    contentType: string,
    onProgress?: (percent: number) => void,
    maxRetries = 3
  ): Promise<boolean> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await new Promise<boolean>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Timeout: 5 minutes for large files
          xhr.timeout = 300000;
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(true);
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error(`Network error (attempt ${attempt}/${maxRetries})`));
          });
          xhr.addEventListener('timeout', () => {
            reject(new Error(`Upload timeout (attempt ${attempt}/${maxRetries})`));
          });
          xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', contentType);
          xhr.send(fileBlob);
        });
        
        return true; // Success!
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Upload attempt ${attempt}/${maxRetries} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Upload failed after all retries');
  };

  const downloadFile = async (
    url: string,
    onProgress?: (percent: number) => void,
    maxRetries = 3
  ): Promise<{ blob: Blob; contentType: string }> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await new Promise<{ blob: Blob; contentType: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          // Timeout: 5 minutes (large videos)
          xhr.timeout = 300000;

          xhr.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          });

          xhr.addEventListener('load', () => {
            const status = xhr.status;
            if (status >= 200 && status < 300) {
              const contentType = xhr.getResponseHeader('content-type') || 'application/octet-stream';
              const blob = xhr.response as Blob;
              resolve({ blob, contentType });
              return;
            }

            if (status === 404) {
              reject(new Error('File not found (404)'));
              return;
            }

            reject(new Error(`Download failed with status ${status}`));
          });

          xhr.addEventListener('error', () => reject(new Error('Network error during download')));
          xhr.addEventListener('timeout', () => reject(new Error('Download timeout')));
          xhr.addEventListener('abort', () => reject(new Error('Download aborted')));

          xhr.open('GET', url, true);
          xhr.responseType = 'blob';
          xhr.send();
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Download attempt ${attempt}/${maxRetries} failed:`, lastError.message, url);

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError || new Error('Download failed after all retries');
  };

  const getFileExtension = (url: string, contentType: string): string => {
    try {
      const urlPath = new URL(url).pathname;
      const urlExt = urlPath.split('.').pop()?.toLowerCase();
      if (urlExt && urlExt.length <= 5) return urlExt;
    } catch {}

    const typeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
    };
    return typeMap[contentType] || 'bin';
  };

  // Check if file exists on R2 using HEAD request with timeout
  const checkFileExistsOnR2 = async (r2PublicUrl: string, supabaseUrl: string): Promise<string | null> => {
    try {
      // Extract filename from Supabase URL
      const urlPath = new URL(supabaseUrl).pathname;
      const fileName = urlPath.split('/').pop();
      if (!fileName) return null;

      // Try to find the file on R2 with various possible paths
      const possiblePaths = [
        `migration/posts/${fileName}`,
        `migration/profiles/${fileName}`,
        `migration/comments/${fileName}`,
        `posts/${fileName}`,
        `avatars/${fileName}`,
        `videos/${fileName}`,
        `comment-media/${fileName}`,
      ];

      // Helper function to fetch with timeout
      const fetchWithTimeout = async (url: string, timeoutMs: number = 5000): Promise<Response | null> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
          const response = await fetch(url, { 
            method: 'HEAD',
            signal: controller.signal 
          });
          clearTimeout(timeoutId);
          return response;
        } catch {
          clearTimeout(timeoutId);
          return null;
        }
      };

      for (const path of possiblePaths) {
        // Check if skip was requested
        if (skipCurrentRef.current) {
          console.log('⏭️ Skip requested during R2 check');
          return null;
        }
        
        const r2Url = `${r2PublicUrl}/${path}`;
        try {
          const response = await fetchWithTimeout(r2Url, 5000);
          if (response?.ok) {
            console.log(`✅ Found existing file on R2: ${r2Url}`);
            return r2Url;
          }
        } catch {
          // Continue checking other paths
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking R2:', error);
      return null;
    }
  };

  // Repair Database - Check R2 first, only upload if not exists
  const runRepairDatabase = async () => {
    setRepairing(true);
    setProgress(0);
    setResult(null);
    setCurrentFile('');
    skipCurrentRef.current = false;
    stopProcessRef.current = false;

    const repairResult: MigrationResult = {
      total: 0,
      migrated: 0,
      alreadyOnR2: 0,
      errors: [],
    };

    try {
      toast.info('🔧 Đang quét database và kiểm tra R2...');

      const r2PublicUrl = import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || '';
      
      // Get all URLs that still point to Supabase
      const { data: posts } = await supabase
        .from('posts')
        .select('id, image_url, video_url')
        .or('image_url.not.is.null,video_url.not.is.null');

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, avatar_url, cover_url')
        .or('avatar_url.not.is.null,cover_url.not.is.null');

      const { data: comments } = await supabase
        .from('comments')
        .select('id, image_url, video_url')
        .or('image_url.not.is.null,video_url.not.is.null');

      const urlsToProcess: Array<{
        table: string;
        id: string;
        field: string;
        url: string;
      }> = [];

      const isSupabaseUrl = (url: string | null) => {
        if (!url) return false;
        if (r2PublicUrl && url.includes(r2PublicUrl)) return false;
        if (url.includes('r2.dev')) return false;
        return (
          url.includes('.supabase.co/storage') ||
          url.includes('.supabase.in/storage') ||
          url.includes('supabase.co/storage') ||
          url.includes('supabase.in/storage')
        );
      };

      posts?.forEach(post => {
        if (isSupabaseUrl(post.image_url)) {
          urlsToProcess.push({ table: 'posts', id: post.id, field: 'image_url', url: post.image_url! });
        }
        if (isSupabaseUrl(post.video_url)) {
          urlsToProcess.push({ table: 'posts', id: post.id, field: 'video_url', url: post.video_url! });
        }
      });

      profiles?.forEach(profile => {
        if (isSupabaseUrl(profile.avatar_url)) {
          urlsToProcess.push({ table: 'profiles', id: profile.id, field: 'avatar_url', url: profile.avatar_url! });
        }
        if (isSupabaseUrl(profile.cover_url)) {
          urlsToProcess.push({ table: 'profiles', id: profile.id, field: 'cover_url', url: profile.cover_url! });
        }
      });

      comments?.forEach(comment => {
        if (isSupabaseUrl(comment.image_url)) {
          urlsToProcess.push({ table: 'comments', id: comment.id, field: 'image_url', url: comment.image_url! });
        }
        if (isSupabaseUrl(comment.video_url)) {
          urlsToProcess.push({ table: 'comments', id: comment.id, field: 'video_url', url: comment.video_url! });
        }
      });

      repairResult.total = urlsToProcess.length;

      if (urlsToProcess.length === 0) {
        toast.success('✅ Không còn files nào cần xử lý!');
        setResult(repairResult);
        setRepairing(false);
        return;
      }

      toast.info(`📊 Tìm thấy ${urlsToProcess.length} URLs cần kiểm tra`);

      // Process each URL
      for (let i = 0; i < urlsToProcess.length; i++) {
        // Check if stop was requested
        if (stopProcessRef.current) {
          toast.info('⏹️ Đã dừng quá trình');
          break;
        }
        
        // Reset skip flag for new file
        skipCurrentRef.current = false;
        
        const item = urlsToProcess[i];
        const fileName = item.url.split('/').pop() || `file_${Date.now()}`;
        setCurrentFile(`${i + 1}/${urlsToProcess.length}: Kiểm tra ${fileName}`);
        setProgress(Math.round((i / urlsToProcess.length) * 100));

        try {
          // Step 1: Check if file already exists on R2
          const existingR2Url = await checkFileExistsOnR2(r2PublicUrl, item.url);

          // Check if skip was requested during R2 check
          if (skipCurrentRef.current) {
            console.log(`⏭️ Skipped: ${fileName}`);
            repairResult.errors.push({
              url: item.url,
              error: 'Skipped by user',
            });
            continue;
          }

          if (existingR2Url) {
            // File exists on R2 - just update DB via edge function
            setCurrentFile(`${i + 1}/${urlsToProcess.length}: 📝 Update DB cho ${fileName}`);
            
            await updateMediaUrlViaEdgeFunction(item.table, item.id, item.field, existingR2Url);

            repairResult.alreadyOnR2++;
            console.log(`✅ DB updated (file already on R2): ${fileName} -> ${existingR2Url}`);
          } else {
            // File not on R2 - need to download and upload
            setCurrentFile(`${i + 1}/${urlsToProcess.length}: 📥 Download ${fileName}`);
            
            const { blob, contentType } = await downloadFile(item.url);
            
            // Check if skip was requested during download
            if (skipCurrentRef.current) {
              console.log(`⏭️ Skipped after download: ${fileName}`);
              repairResult.errors.push({
                url: item.url,
                error: 'Skipped by user',
              });
              continue;
            }
            
            const fileSize = blob.size;

            console.log(`📥 Downloaded: ${fileName}, size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

            // Generate unique key for R2
            const ext = getFileExtension(item.url, contentType);
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const key = `migration/${item.table}/${timestamp}_${randomStr}.${ext}`;

            setCurrentFile(`${i + 1}/${urlsToProcess.length}: 📤 Upload ${fileName}`);

            // Get presigned URL
            const { uploadUrl, publicUrl } = await getPresignedUrl(key, contentType, fileSize);

            // Upload to R2
            await uploadWithPresignedUrl(uploadUrl, blob, contentType, (percent) => {
              const baseProgress = (i / urlsToProcess.length) * 100;
              const fileProgress = (percent / urlsToProcess.length);
              setProgress(Math.round(baseProgress + fileProgress));
            });

            // Update database via edge function (bypasses RLS)
            await updateMediaUrlViaEdgeFunction(item.table, item.id, item.field, publicUrl);

            repairResult.migrated++;
            console.log(`✅ Uploaded & DB updated: ${fileName} -> ${publicUrl}`);
          }

          // Small delay
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Error processing ${item.url}:`, error);
          repairResult.errors.push({
            url: item.url,
            error: errorMessage,
          });
        }
      }

      setProgress(100);
      setCurrentFile('');
      setResult(repairResult);

      const total = repairResult.alreadyOnR2 + repairResult.migrated;
      if (repairResult.errors.length === 0) {
        toast.success(`🎉 Hoàn thành! ${repairResult.alreadyOnR2} đã có trên R2, ${repairResult.migrated} uploaded mới!`);
      } else {
        toast.warning(`⚠️ Xử lý ${total} files với ${repairResult.errors.length} lỗi`);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Repair error:', error);
      toast.error(`❌ Lỗi: ${errorMessage}`);
    } finally {
      setRepairing(false);
    }
  };

  // Fix Cloudflare Dashboard URLs
  const runFixCloudflareUrls = async () => {
    setFixingUrls(true);
    setFixUrlResult(null);

    try {
      toast.info('🔧 Đang sửa URLs dash.cloudflare.com...');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vui lòng đăng nhập lại');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fix-cloudflare-urls`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fix URLs');
      }

      setFixUrlResult({
        total: data.total,
        fixed: data.fixed,
        errors: data.errors || [],
        details: data.details,
      });

      if (data.total === 0) {
        toast.success('✅ Không có URLs nào cần sửa!');
      } else if (data.errors?.length === 0) {
        toast.success(`🎉 Đã sửa ${data.fixed} URLs thành công!`);
      } else {
        toast.warning(`⚠️ Đã sửa ${data.fixed}/${data.total} URLs với ${data.errors.length} lỗi`);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Fix URLs error:', error);
      toast.error(`❌ Lỗi: ${errorMessage}`);
    } finally {
      setFixingUrls(false);
    }
  };

  const runCleanupStorage = async (dryRun: boolean, specificBucket?: string) => {
    setCleaningStorage(true);
    if (!specificBucket) {
      setCleanupResult(null);
    }

    // Create AbortController with 3-minute timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

    try {
      const bucketLabel = specificBucket || 'tất cả buckets';
      toast.info(dryRun ? `🔍 Đang kiểm tra ${bucketLabel}...` : `🗑️ Đang xóa ${bucketLabel}... (tối đa 3 phút)`);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vui lòng đăng nhập lại');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-supabase-storage`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            dryRun,
            bucket: specificBucket || null,
            batchSize: 30 // Smaller batch for faster response
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cleanup storage');
      }

      setCleanupResult({
        dryRun: data.dryRun,
        totalFiles: data.totalFiles,
        totalDeleted: data.totalDeleted,
        buckets: data.buckets || [],
      });

      if (dryRun) {
        toast.info(`📊 Tìm thấy ${data.totalFiles} files có thể xóa`);
      } else {
        toast.success(`🎉 Đã xóa ${data.totalDeleted} files từ ${bucketLabel}!`);
      }

    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('⏱️ Timeout! Thử xóa từng bucket riêng để tránh timeout.');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Cleanup error:', error);
        toast.error(`❌ Lỗi: ${errorMessage}`);
      }
    } finally {
      setCleaningStorage(false);
    }
  };

  const runCleanupOrphanVideos = async (dryRun: boolean = true) => {
    setCleaningOrphanVideos(true);
    setOrphanVideoResult(null);

    const controller = new AbortController();
    const timeoutMs = 180_000; // 3 minutes
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Phiên đăng nhập hết hạn');
        return;
      }

      toast.info(dryRun ? '🔍 Đang quét video orphan (preview)...' : '🗑️ Đang xóa video orphan...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-orphan-videos`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ dryRun: dryRun === true ? true : false, maxDelete: 50 }),
        }
      );

      const data = await response.json().catch(() => ({} as OrphanVideoResult));

      if (!response.ok) {
        throw new Error((data as any)?.error || 'Failed to cleanup orphan videos');
      }

      setOrphanVideoResult(data as OrphanVideoResult);

      if ((data as OrphanVideoResult).dryRun) {
        toast.info(`🔍 Tìm thấy ${(data as OrphanVideoResult).orphanVideosFound} video orphan trên ${(data as OrphanVideoResult).totalVideosOnStream} video`);
      } else {
        toast.success(`✅ Đã xóa ${(data as OrphanVideoResult).orphanVideosDeleted} video orphan!`);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('⏱️ Timeout khi dọn dẹp video. Vui lòng chạy lại (mỗi lần xóa tối đa 50 video).');
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Orphan video cleanup error:', error);
      toast.error(`❌ Lỗi: ${errorMessage}`);
    } finally {
      window.clearTimeout(timeoutId);
      setCleaningOrphanVideos(false);
    }
  };

  const runMigration = async () => {
    setMigrating(true);
    setProgress(0);
    setResult(null);
    setCurrentFile('');
    skipCurrentRef.current = false;
    stopProcessRef.current = false;

    const migrationResult: MigrationResult = {
      total: 0,
      migrated: 0,
      alreadyOnR2: 0,
      errors: [],
    };

    try {
      toast.info('🚀 Đang tải danh sách files...');

      const r2PublicUrl = import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || '';
      
      // Get all URLs that need migration
      const { data: posts } = await supabase
        .from('posts')
        .select('id, image_url, video_url')
        .or('image_url.not.is.null,video_url.not.is.null');

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, avatar_url, cover_url')
        .or('avatar_url.not.is.null,cover_url.not.is.null');

      const { data: comments } = await supabase
        .from('comments')
        .select('id, image_url, video_url')
        .or('image_url.not.is.null,video_url.not.is.null');

      const urlsToMigrate: Array<{
        table: string;
        id: string;
        field: string;
        url: string;
      }> = [];

      const isSupabaseUrl = (url: string | null) => {
        if (!url) return false;
        // Skip if already R2
        if (r2PublicUrl && url.includes(r2PublicUrl)) return false;
        // Check for Supabase storage patterns
        return (
          url.includes('.supabase.co/storage') ||
          url.includes('.supabase.in/storage') ||
          url.includes('supabase.co/storage') ||
          url.includes('supabase.in/storage')
        );
      };

      posts?.forEach(post => {
        if (isSupabaseUrl(post.image_url)) {
          urlsToMigrate.push({ table: 'posts', id: post.id, field: 'image_url', url: post.image_url! });
        }
        if (isSupabaseUrl(post.video_url)) {
          urlsToMigrate.push({ table: 'posts', id: post.id, field: 'video_url', url: post.video_url! });
        }
      });

      profiles?.forEach(profile => {
        if (isSupabaseUrl(profile.avatar_url)) {
          urlsToMigrate.push({ table: 'profiles', id: profile.id, field: 'avatar_url', url: profile.avatar_url! });
        }
        if (isSupabaseUrl(profile.cover_url)) {
          urlsToMigrate.push({ table: 'profiles', id: profile.id, field: 'cover_url', url: profile.cover_url! });
        }
      });

      comments?.forEach(comment => {
        if (isSupabaseUrl(comment.image_url)) {
          urlsToMigrate.push({ table: 'comments', id: comment.id, field: 'image_url', url: comment.image_url! });
        }
        if (isSupabaseUrl(comment.video_url)) {
          urlsToMigrate.push({ table: 'comments', id: comment.id, field: 'video_url', url: comment.video_url! });
        }
      });

      migrationResult.total = urlsToMigrate.length;

      if (urlsToMigrate.length === 0) {
        toast.success('✅ Không còn files nào cần migrate!');
        setResult(migrationResult);
        setMigrating(false);
        return;
      }

      toast.info(`📊 Tìm thấy ${urlsToMigrate.length} files cần migrate`);

      // Process each file with presigned URLs
      for (let i = 0; i < urlsToMigrate.length; i++) {
        // Check if stop was requested
        if (stopProcessRef.current) {
          toast.info('⏹️ Đã dừng quá trình');
          break;
        }
        
        // Reset skip flag for new file
        skipCurrentRef.current = false;
        
        const item = urlsToMigrate[i];
        const fileName = item.url.split('/').pop() || `file_${Date.now()}`;
        setCurrentFile(`${i + 1}/${urlsToMigrate.length}: ${fileName}`);
        setProgress(Math.round((i / urlsToMigrate.length) * 100));

        try {
          // Download file from Supabase
          const { blob, contentType } = await downloadFile(item.url);
          
          // Check if skip was requested during download
          if (skipCurrentRef.current) {
            console.log(`⏭️ Skipped: ${fileName}`);
            migrationResult.errors.push({
              url: item.url,
              error: 'Skipped by user',
            });
            continue;
          }
          
          const fileSize = blob.size;

          console.log(`📥 Migrating: ${fileName}, size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

          // Generate unique key for R2
          const ext = getFileExtension(item.url, contentType);
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const key = `migration/${item.table}/${timestamp}_${randomStr}.${ext}`;

          // Get presigned URL from edge function
          const { uploadUrl, publicUrl } = await getPresignedUrl(key, contentType, fileSize);

          // Upload directly to R2 with presigned URL
          await uploadWithPresignedUrl(uploadUrl, blob, contentType, (percent) => {
            const baseProgress = (i / urlsToMigrate.length) * 100;
            const fileProgress = (percent / urlsToMigrate.length);
            setProgress(Math.round(baseProgress + fileProgress));
          });

          // Update database with new R2 URL via edge function (bypasses RLS)
          console.log(`📝 Updating DB: ${item.table}.${item.field} = ${publicUrl}`);
          
          await updateMediaUrlViaEdgeFunction(item.table, item.id, item.field, publicUrl);

          migrationResult.migrated++;
          console.log(`✅ Migrated & verified: ${fileName} -> ${publicUrl}`);

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Error migrating ${item.url}:`, error);
          migrationResult.errors.push({
            url: item.url,
            error: errorMessage,
          });
        }
      }

      setProgress(100);
      setCurrentFile('');
      setResult(migrationResult);

      if (migrationResult.errors.length === 0) {
        toast.success(`🎉 Hoàn thành! Đã migrate ${migrationResult.migrated} files!`);
      } else {
        toast.warning(`⚠️ Migrate ${migrationResult.migrated} files với ${migrationResult.errors.length} lỗi`);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Migration error:', error);
      toast.error(`❌ Lỗi: ${errorMessage}`);
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5]">
        <FacebookNavbar />
        <main className="container max-w-4xl pt-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <FacebookNavbar />
      <main className="container max-w-4xl pt-20 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">🗂️ Migration to Cloudflare R2</h1>
          <p className="text-muted-foreground">
            Migrate files from Supabase Storage to Cloudflare R2 using presigned URLs (no file size limit)
          </p>
        </div>

        <div className="grid gap-6">
          {/* Repair Database Card - Recommended */}
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                🔧 Repair Database (Khuyến nghị)
              </CardTitle>
              <CardDescription>
                Kiểm tra R2 trước khi upload - không bị trùng file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-green-700">✨ Tính năng thông minh:</h4>
                <ul className="text-sm text-green-600 space-y-1">
                  <li>✅ <strong>Kiểm tra file trên R2 trước</strong> - tránh upload trùng</li>
                  <li>✅ File đã có trên R2 → chỉ update DB (nhanh)</li>
                  <li>✅ File chưa có → download & upload mới</li>
                  <li>✅ Tiết kiệm băng thông và dung lượng R2</li>
                </ul>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <Database className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  <strong>💡 Phù hợp khi:</strong> Đã migrate trước đó nhưng DB chưa update đúng (168+ files đã có trên R2 nhưng URL chưa đổi)
                </AlertDescription>
              </Alert>

              <Button 
                onClick={runRepairDatabase}
                disabled={repairing || migrating}
                className="w-full bg-primary hover:bg-primary/90"
                size="lg"
              >
                {repairing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang xử lý... {progress}%
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    🔧 Repair Database (Check R2 First)
                  </>
                )}
              </Button>

              {repairing && (
                <div className="space-y-3">
                  <Progress value={progress} className="h-2" />
                  {currentFile && (
                    <p className="text-sm text-muted-foreground text-center">
                      📁 {currentFile}
                    </p>
                  )}
                  
                  {/* Skip and Stop buttons */}
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => {
                        skipCurrentRef.current = true;
                        toast.info('⏭️ Đang bỏ qua file hiện tại...');
                      }}
                      variant="outline"
                      size="sm"
                      className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                    >
                      <SkipForward className="w-4 h-4 mr-1" />
                      Bỏ qua file này
                    </Button>
                    <Button
                      onClick={() => {
                        stopProcessRef.current = true;
                        toast.info('⏹️ Đang dừng quá trình...');
                      }}
                      variant="outline"
                      size="sm"
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <StopCircle className="w-4 h-4 mr-1" />
                      Dừng lại
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fix Cloudflare Dashboard URLs Card */}
          <Card className="border-2 border-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-500" />
                🔧 Fix Cloudflare Dashboard URLs
              </CardTitle>
              <CardDescription>
                Sửa các URLs đang trỏ về dash.cloudflare.com thay vì R2 public URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-orange-700">🔍 Vấn đề:</h4>
                <p className="text-sm text-orange-600">
                  Có {71} URLs đang trỏ về <code className="bg-orange-100 px-1 rounded">dash.cloudflare.com</code> thay vì R2 public URL đúng.
                </p>
                <h4 className="font-medium text-orange-700 mt-2">✨ Giải pháp:</h4>
                <ul className="text-sm text-orange-600 space-y-1">
                  <li>✅ Tự động trích xuất path từ URL sai</li>
                  <li>✅ Tạo URL đúng với R2 public domain</li>
                  <li>✅ Cập nhật database</li>
                </ul>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono">
                <div className="text-red-600 truncate">❌ https://dash.cloudflare.com/.../buckets/fun-rich-media/posts/...</div>
                <div className="text-green-600 truncate mt-1">✅ https://pub-xxx.r2.dev/posts/...</div>
              </div>

              <Button 
                onClick={runFixCloudflareUrls}
                disabled={fixingUrls || migrating || repairing}
                className="w-full bg-orange-500 hover:bg-orange-600"
                size="lg"
              >
                {fixingUrls ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang sửa URLs...
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4 mr-2" />
                    🔧 Fix Cloudflare Dashboard URLs
                  </>
                )}
              </Button>

              {fixUrlResult && (
                <div className="space-y-3 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                      <div className="text-xl font-bold text-blue-600">{fixUrlResult.total}</div>
                      <div className="text-xs text-muted-foreground">Tổng URLs</div>
                    </div>
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                      <div className="text-xl font-bold text-green-600 flex items-center justify-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        {fixUrlResult.fixed}
                      </div>
                      <div className="text-xs text-muted-foreground">Đã sửa</div>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                      <div className="text-xl font-bold text-red-600 flex items-center justify-center gap-1">
                        <XCircle className="w-4 h-4" />
                        {fixUrlResult.errors.length}
                      </div>
                      <div className="text-xs text-muted-foreground">Lỗi</div>
                    </div>
                  </div>

                  {fixUrlResult.total === 0 && (
                    <Alert className="bg-green-500/10 border-green-500/20">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700">
                        ✅ Không có URLs nào cần sửa!
                      </AlertDescription>
                    </Alert>
                  )}

                  {fixUrlResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        URLs gặp lỗi:
                      </h4>
                      <div className="max-h-32 overflow-y-auto space-y-2">
                        {fixUrlResult.errors.map((err, idx) => (
                          <div key={idx} className="text-xs bg-red-50 p-2 rounded border border-red-200">
                            <div className="font-mono truncate text-red-800">{err.url}</div>
                            <div className="text-red-600">{err.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cleanup Supabase Storage Card */}
          <Card className="border-2 border-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                🗑️ Xóa Supabase Storage
              </CardTitle>
              <CardDescription>
                Xóa tất cả files cũ trên Supabase Storage sau khi migration hoàn tất
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  <strong>⚠️ CẢNH BÁO:</strong> Hành động này không thể hoàn tác! Chỉ thực hiện sau khi đã xác nhận tất cả files đã được migrate sang R2.
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-gray-700">📋 Xóa từng bucket riêng (tránh timeout):</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {['posts', 'videos', 'avatars', 'comment-media'].map((bucket) => (
                    <Button
                      key={bucket}
                      onClick={() => {
                        if (window.confirm(`⚠️ Xóa tất cả files trong bucket "${bucket}"?\n\nHành động này KHÔNG THỂ HOÀN TÁC!`)) {
                          runCleanupStorage(false, bucket);
                        }
                      }}
                      disabled={cleaningStorage || migrating || repairing}
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      {bucket}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => runCleanupStorage(true)}
                  disabled={cleaningStorage || migrating || repairing}
                  className="flex-1"
                  variant="outline"
                  size="lg"
                >
                  {cleaningStorage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      🔍 Kiểm tra trước (Preview)
                    </>
                  )}
                </Button>

                <Button 
                  onClick={() => {
                    if (window.confirm('⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TẤT CẢ FILES?\n\nKHUYẾN NGHỊ: Dùng nút xóa từng bucket ở trên để tránh timeout!\n\nNhấn OK để tiếp tục.')) {
                      runCleanupStorage(false);
                    }
                  }}
                  disabled={cleaningStorage || migrating || repairing}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  size="lg"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  🗑️ Xóa tất cả
                </Button>
              </div>

              {cleanupResult && (
                <div className="space-y-3 mt-4">
                  <Alert className={cleanupResult.dryRun ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"}>
                    <Database className={`h-4 w-4 ${cleanupResult.dryRun ? 'text-blue-600' : 'text-green-600'}`} />
                    <AlertDescription className={cleanupResult.dryRun ? 'text-blue-700' : 'text-green-700'}>
                      {cleanupResult.dryRun 
                        ? `🔍 Preview: Tìm thấy ${cleanupResult.totalFiles} files có thể xóa`
                        : `✅ Đã xóa ${cleanupResult.totalDeleted} files thành công!`
                      }
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {cleanupResult.buckets.map((bucket, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 border rounded-lg text-center">
                        <div className="text-lg font-bold text-gray-700">
                          {cleanupResult.dryRun ? bucket.totalFiles : bucket.deleted}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{bucket.bucket}</div>
                        {!cleanupResult.dryRun && bucket.totalFiles > 0 && (
                          <div className="text-xs text-green-600 mt-1">
                            {bucket.deleted}/{bucket.totalFiles} đã xóa
                          </div>
                        )}
                        {bucket.errors.length > 0 && (
                          <div className="text-xs text-red-500 mt-1">{bucket.errors.length} lỗi</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cleanup Orphan Videos Card */}
          <Card className="border-2 border-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-500" />
                🎬 Dọn dẹp Video Orphan (Cloudflare Stream)
              </CardTitle>
              <CardDescription>
                Xóa video trên Cloudflare Stream không còn được tham chiếu trong database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-purple-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-purple-700">🔍 Chức năng:</h4>
                <ul className="text-sm text-purple-600 space-y-1">
                  <li>✅ Quét tất cả video trên Cloudflare Stream</li>
                  <li>✅ So sánh với video URLs trong database (posts, comments, profiles)</li>
                  <li>✅ Xóa video không còn được sử dụng (orphan)</li>
                  <li>✅ Tiết kiệm dung lượng và chi phí Cloudflare Stream</li>
                </ul>
              </div>

              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-700">
                  <strong>💡 Khuyến nghị:</strong> Chạy Preview trước để xem số lượng video orphan
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button 
                  onClick={() => runCleanupOrphanVideos(true)}
                  disabled={cleaningOrphanVideos || migrating || repairing}
                  className="flex-1"
                  variant="outline"
                  size="lg"
                >
                  {cleaningOrphanVideos ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang quét...
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      🔍 Kiểm tra (Preview)
                    </>
                  )}
                </Button>

                <Button 
                  onClick={() => {
                    if (window.confirm('⚠️ XÓA TẤT CẢ VIDEO ORPHAN?\n\nHành động này không thể hoàn tác!\n\nNhấn OK để tiếp tục.')) {
                      runCleanupOrphanVideos(false);
                    }
                  }}
                  disabled={cleaningOrphanVideos || migrating || repairing}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  🗑️ Xóa Orphan Videos
                </Button>
              </div>

              {orphanVideoResult && (
                <div className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                      <div className="text-lg font-bold text-blue-600">{orphanVideoResult.totalVideosOnStream}</div>
                      <div className="text-xs text-muted-foreground">Videos trên CF</div>
                    </div>
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                      <div className="text-lg font-bold text-green-600">{orphanVideoResult.totalVideosInDb}</div>
                      <div className="text-xs text-muted-foreground">Videos trong DB</div>
                    </div>
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
                      <div className="text-lg font-bold text-yellow-600">{orphanVideoResult.orphanVideosFound}</div>
                      <div className="text-xs text-muted-foreground">Orphan tìm thấy</div>
                    </div>
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
                      <div className="text-lg font-bold text-purple-600 flex items-center justify-center gap-1">
                        {orphanVideoResult.dryRun ? '—' : orphanVideoResult.orphanVideosDeleted}
                      </div>
                      <div className="text-xs text-muted-foreground">Đã xóa</div>
                    </div>
                  </div>

                  {orphanVideoResult.dryRun && orphanVideoResult.orphanVideosFound > 0 && (
                    <Alert className="bg-purple-50 border-purple-200">
                      <Video className="h-4 w-4 text-purple-600" />
                      <AlertDescription className="text-purple-700">
                        🔍 <strong>Preview:</strong> Tìm thấy {orphanVideoResult.orphanVideosFound} video orphan có thể xóa
                      </AlertDescription>
                    </Alert>
                  )}

                  {!orphanVideoResult.dryRun && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700">
                        ✅ Đã xóa {orphanVideoResult.orphanVideosDeleted} video orphan!
                      </AlertDescription>
                    </Alert>
                  )}

                  {orphanVideoResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Lỗi ({orphanVideoResult.errors.length}):
                      </h4>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {orphanVideoResult.errors.map((err, idx) => (
                          <div key={idx} className="text-xs bg-red-50 p-2 rounded border border-red-200 text-red-700">
                            {err}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {orphanVideoResult.deletedUids.length > 0 && orphanVideoResult.deletedUids.length <= 10 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-purple-600 text-sm">
                        {orphanVideoResult.dryRun ? 'Video UIDs sẽ xóa:' : 'Video UIDs đã xóa:'}
                      </h4>
                      <div className="text-xs font-mono bg-gray-50 p-2 rounded space-y-1 max-h-24 overflow-y-auto">
                        {orphanVideoResult.deletedUids.map((uid, idx) => (
                          <div key={idx} className="text-gray-600">{uid}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Standard Migration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-muted-foreground" />
                🚀 Standard Migration
              </CardTitle>
              <CardDescription>
                Migration thông thường - upload tất cả files (có thể tạo file trùng)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-700">
                  <strong>⚠️ Lưu ý:</strong> Sẽ upload lại tất cả files, có thể tạo file trùng trên R2 nếu đã migrate trước đó.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={runMigration}
                disabled={migrating || repairing}
                className="w-full"
                variant="outline"
                size="lg"
              >
                {migrating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang migrate... {progress}%
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    🚀 Standard Migration (Upload All)
                  </>
                )}
              </Button>

              {migrating && (
                <div className="space-y-3">
                  <Progress value={progress} className="h-2" />
                  {currentFile && (
                    <p className="text-sm text-muted-foreground text-center">
                      📁 {currentFile}
                    </p>
                  )}
                  
                  {/* Skip and Stop buttons */}
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => {
                        skipCurrentRef.current = true;
                        toast.info('⏭️ Đang bỏ qua file hiện tại...');
                      }}
                      variant="outline"
                      size="sm"
                      className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                    >
                      <SkipForward className="w-4 h-4 mr-1" />
                      Bỏ qua file này
                    </Button>
                    <Button
                      onClick={() => {
                        stopProcessRef.current = true;
                        toast.info('⏹️ Đang dừng quá trình...');
                      }}
                      variant="outline"
                      size="sm"
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <StopCircle className="w-4 h-4 mr-1" />
                      Dừng lại
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Card */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.errors.length === 0 ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                  Kết Quả
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{result.total}</div>
                    <div className="text-sm text-muted-foreground">Tổng files</div>
                  </div>
                  <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">{result.alreadyOnR2}</div>
                    <div className="text-sm text-muted-foreground">Đã có trên R2</div>
                  </div>
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                      <CheckCircle className="w-5 h-5" />
                      {result.migrated}
                    </div>
                    <div className="text-sm text-muted-foreground">Upload mới</div>
                  </div>
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                      <XCircle className="w-5 h-5" />
                      {result.errors.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Lỗi</div>
                  </div>
                </div>

                {result.total === 0 && (
                  <Alert className="bg-green-500/10 border-green-500/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      ✅ Không còn files nào cần xử lý! Tất cả đã được chuyển sang R2.
                    </AlertDescription>
                  </Alert>
                )}

                {result.alreadyOnR2 > 0 && (
                  <Alert className="bg-purple-500/10 border-purple-500/20">
                    <Database className="h-4 w-4 text-purple-600" />
                    <AlertDescription className="text-purple-700">
                      📝 {result.alreadyOnR2} files đã có trên R2 - chỉ cập nhật URL trong database (không upload lại)
                    </AlertDescription>
                  </Alert>
                )}

                {result.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-red-600 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Files gặp lỗi:
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {result.errors.map((err, idx) => (
                        <div key={idx} className="text-xs bg-red-50 p-2 rounded border border-red-200">
                          <div className="font-mono truncate text-red-800">{err.url}</div>
                          <div className="text-red-600">{err.error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminMigration;
