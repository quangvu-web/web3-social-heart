/**
 * Get Upload URL Edge Function
 * 
 * Tạo presigned URL để client upload trực tiếp lên R2
 * - Có authentication check (không cần admin)
 * - Validate file type và size
 * - Cache-Control headers cho cache vĩnh viễn (vì filename có hash)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Allowed content types - comprehensive list for all file types
const ALLOWED_CONTENT_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif',
  'image/bmp', 'image/tiff', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
  // Videos
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/x-msvideo', 'video/mpeg',
  'video/ogg', 'video/3gpp', 'video/x-matroska', 'video/x-flv', 'video/x-ms-wmv',
  // Documents - Office
  'application/pdf',
  'application/msword', 'application/vnd.ms-word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/x-msexcel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/html', 'text/xml',
  // Archives - all variants browsers may send
  'application/zip', 'application/x-zip', 'application/x-zip-compressed',
  'application/x-rar-compressed', 'application/vnd.rar', 'application/rar',
  'application/x-7z-compressed', 'application/x-tar', 'application/gzip', 'application/x-gzip',
  // Mobile / APK
  'application/vnd.android.package-archive',
  // Fallback for unknown types
  'application/octet-stream',
];

// Max sizes
const MAX_IMAGE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024; // 4GB
const MAX_DOCUMENT_SIZE = 4 * 1024 * 1024 * 1024; // 4GB

const ALLOWED_KEY_BUCKETS = new Set(['avatars', 'covers', 'posts', 'videos', 'comment-media']);

function inferContentTypeFromKey(key: string): string | null {
  const ext = key.split('.').pop()?.toLowerCase();
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
    case 'heic':
      return 'image/heic';
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

function isValidKeyForUser(key: string, userId: string): { ok: boolean; reason?: string } {
  if (!key || typeof key !== 'string') return { ok: false, reason: 'Missing key' };
  if (key.includes('..') || key.startsWith('/') || key.includes('//') || key.includes('\\')) {
    return { ok: false, reason: 'Invalid file path' };
  }

  const parts = key.split('/').filter(Boolean);
  if (parts.length < 2) return { ok: false, reason: 'Invalid file path' };

  const bucket = parts[0];
  if (!ALLOWED_KEY_BUCKETS.has(bucket)) return { ok: false, reason: 'Invalid bucket' };

  const second = parts[1] || '';
  // Enforce per-user prefix to prevent IDOR overwrites:
  // - <bucket>/<userId>/... (folder scoping)
  // - <bucket>/<userId>_... (filename prefix scoping)
  const scoped =
    second === userId ||
    second.startsWith(`${userId}_`);

  if (!scoped) return { ok: false, reason: 'Invalid key scope' };
  return { ok: true };
}

// HMAC-SHA256 helper
async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

// Get signing key for AWS Signature V4
async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ AUTHENTICATION CHECK
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Unauthorized:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { key, contentType, fileSize } = await req.json();

    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Missing key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize <= 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid fileSize' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedContentType =
      (typeof contentType === 'string' && contentType.trim()) ||
      inferContentTypeFromKey(key) ||
      'application/octet-stream';

    // ✅ VALIDATE CONTENT TYPE (strip codec params like "video/webm;codecs=vp9,opus")
    const baseContentType = normalizedContentType.split(';')[0].trim();
    if (!ALLOWED_CONTENT_TYPES.includes(baseContentType)) {
      console.error(`Invalid content type: ${normalizedContentType}`);
      return new Response(
        JSON.stringify({ error: 'File type not allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ VALIDATE KEY FORMAT + SCOPE (prevent path traversal + IDOR overwrites)
    const { data: isAdmin } = await supabaseUser.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (!isAdmin) {
      const scopeCheck = isValidKeyForUser(key, user.id);
      if (!scopeCheck.ok) {
        return new Response(
          JSON.stringify({ error: scopeCheck.reason || 'Invalid file path' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Even admins: keep basic path traversal protection + bucket allowlist.
      if (key.includes('..') || key.startsWith('/') || key.includes('//') || key.includes('\\')) {
        return new Response(
          JSON.stringify({ error: 'Invalid file path' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const bucket = key.split('/').filter(Boolean)[0];
      if (!bucket || !ALLOWED_KEY_BUCKETS.has(bucket)) {
        return new Response(
          JSON.stringify({ error: 'Invalid bucket' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ✅ VALIDATE FILE SIZE
    const isVideo = baseContentType.startsWith('video/');
    const isImage = baseContentType.startsWith('image/');
    const maxSize = isImage ? MAX_IMAGE_SIZE : (isVideo ? MAX_VIDEO_SIZE : MAX_DOCUMENT_SIZE);
    if (fileSize > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return new Response(
        JSON.stringify({ error: `File too large. Max ${maxSizeMB}MB for ${isVideo ? 'videos' : (isImage ? 'images' : 'documents')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // R2 credentials
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!;
    const accessKeyId = Deno.env.get('CLOUDFLARE_ACCESS_KEY_ID')!;
    const secretAccessKey = Deno.env.get('CLOUDFLARE_SECRET_ACCESS_KEY')!;
    const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME')!;
    // NOTE: Ensure CLOUDFLARE_R2_PUBLIC_URL is set to the new public bucket:
    // https://pub-fe745f8832684f4198a9b0e88e8d451a.r2.dev
    const publicUrl = Deno.env.get('CLOUDFLARE_R2_PUBLIC_URL')!;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Missing R2 configuration');
    }

    // AWS Signature V4 for presigned URL
    const region = 'auto';
    const service = 's3';
    const host = `${accountId}.r2.cloudflarestorage.com`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    
    // URL expires in 15 minutes
    const expiresIn = 900;

    const method = 'PUT';
    const canonicalUri = `/${bucketName}/${key}`;
    const signedHeaders = 'host';
    
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${accessKeyId}/${credentialScope}`;
    
    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': algorithm,
      'X-Amz-Credential': credential,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expiresIn.toString(),
      'X-Amz-SignedHeaders': signedHeaders,
    });
    
    queryParams.sort();
    const canonicalQueryString = queryParams.toString();
    const canonicalHeaders = `host:${host}\n`;
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const canonicalRequestHash = toHex(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))
    );
    
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join('\n');

    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    queryParams.append('X-Amz-Signature', signature);
    const uploadUrl = `https://${host}${canonicalUri}?${queryParams.toString()}`;
    const filePublicUrl = `${publicUrl}/${key}`;
    const warning =
      !publicUrl || publicUrl.includes('media.fun.rich')
        ? 'CLOUDFLARE_R2_PUBLIC_URL is missing or points to media.fun.rich'
        : undefined;
    if (warning) {
      console.warn(`[get-upload-url] ${warning}`);
    }

    console.log(`Generated presigned URL for ${key} by user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        uploadUrl,
        publicUrl: filePublicUrl,
        key,
        contentType: baseContentType,
        size: fileSize,
        warning,
        expiresIn,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating upload URL:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});






