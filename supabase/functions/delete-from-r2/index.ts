import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_KEY_BUCKETS = new Set(['avatars', 'covers', 'posts', 'videos', 'comment-media']);

function sanitizeKey(key: string): string {
  return key.replace(/\\/g, '/');
}

function isScopedToUser(key: string, userId: string): boolean {
  const clean = sanitizeKey(key);
  return clean.startsWith(`avatars/${userId}/`) ||
    clean.startsWith(`avatars/${userId}_`) ||
    clean.startsWith(`covers/${userId}/`) ||
    clean.startsWith(`covers/${userId}_`) ||
    clean.startsWith(`posts/${userId}/`) ||
    clean.startsWith(`posts/${userId}_`) ||
    clean.startsWith(`comment-media/${userId}/`) ||
    clean.startsWith(`comment-media/${userId}_`) ||
    clean.startsWith(`videos/${userId}/`) ||
    clean.startsWith(`videos/${userId}_`);
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

async function createPresignedUrlForDelete(params: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { accountId, accessKeyId, secretAccessKey, bucketName } = params;
  const cleanKey = sanitizeKey(params.key);
  const expiresIn = params.expiresInSeconds ?? 300; // 5 minutes

  const region = 'auto';
  const service = 's3';
  const host = `${accountId}.r2.cloudflarestorage.com`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const method = 'DELETE';
  const canonicalUri = `/${bucketName}/${cleanKey}`;
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
  return `https://${host}${canonicalUri}?${queryParams.toString()}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Initialize Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Authentication failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid authentication' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { key } = await req.json();

    // Validate input - prevent path traversal attacks
    if (!key || typeof key !== 'string') {
      console.error('Invalid key parameter');
      return new Response(
        JSON.stringify({ error: 'Bad Request: Invalid key parameter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const cleanKey = sanitizeKey(key);

    // Sanitize key - prevent path traversal
    if (cleanKey.includes('..') || cleanKey.startsWith('/') || cleanKey.includes('//')) {
      console.error('Invalid key format - potential path traversal:', key);
      return new Response(
        JSON.stringify({ error: 'Bad Request: Invalid key format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if user is admin (admins can delete any file)
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    // Verify bucket allowlist early
    const keyParts = cleanKey.split('/').filter(Boolean);
    const bucket = keyParts[0];

    if (!bucket || !ALLOWED_KEY_BUCKETS.has(bucket)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: Invalid bucket' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (!isAdmin) {
      // Preferred (new) scheme: user-scoped keys. Allow delete directly.
      if (isScopedToUser(cleanKey, user.id)) {
        // ok
      } else {
        // Legacy scheme fallback: verify ownership by reference checks.
        let hasPermission = false;

        if (bucket === 'avatars' || bucket === 'covers') {
          // For avatars/covers, check if the file belongs to user's profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url, cover_url')
            .eq('id', user.id)
            .single();

          if (profile) {
            hasPermission = 
              (profile.avatar_url && profile.avatar_url.includes(cleanKey)) ||
              (profile.cover_url && profile.cover_url.includes(cleanKey));
          }
        } else if (bucket === 'posts') {
          // For posts, check if the file is in a post owned by the user
          const { data: posts } = await supabase
            .from('posts')
            .select('id, image_url, video_url, media_urls')
            .eq('user_id', user.id);

          if (posts) {
            hasPermission = posts.some(post => 
              (post.image_url && post.image_url.includes(cleanKey)) ||
              (post.video_url && post.video_url.includes(cleanKey)) ||
              (post.media_urls && JSON.stringify(post.media_urls).includes(cleanKey))
            );
          }
        } else if (bucket === 'videos') {
          // For videos, check if the file is in a post owned by the user
          const { data: posts } = await supabase
            .from('posts')
            .select('id, video_url')
            .eq('user_id', user.id);

          if (posts) {
            hasPermission = posts.some(post => 
              post.video_url && post.video_url.includes(cleanKey)
            );
          }
        } else if (bucket === 'comment-media') {
          // For comment media, check if the file is in a comment owned by the user
          const { data: comments } = await supabase
            .from('comments')
            .select('id, image_url, video_url')
            .eq('user_id', user.id);

          if (comments) {
            hasPermission = comments.some(comment =>
              (comment.image_url && comment.image_url.includes(cleanKey)) ||
              (comment.video_url && comment.video_url.includes(cleanKey))
            );
          }
        }

        if (!hasPermission) {
          console.error(`User ${user.id} attempted to delete file they don't own: ${cleanKey}`);
          return new Response(
            JSON.stringify({ error: 'Forbidden: You do not have permission to delete this file' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          );
        }
      }
    }

    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const CLOUDFLARE_ACCESS_KEY_ID = Deno.env.get('CLOUDFLARE_ACCESS_KEY_ID');
    const CLOUDFLARE_SECRET_ACCESS_KEY = Deno.env.get('CLOUDFLARE_SECRET_ACCESS_KEY');
    const CLOUDFLARE_R2_BUCKET_NAME = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME');

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_ACCESS_KEY_ID || !CLOUDFLARE_SECRET_ACCESS_KEY || !CLOUDFLARE_R2_BUCKET_NAME) {
      throw new Error('Missing Cloudflare R2 configuration');
    }

    // Delete from R2 via presigned URL (SigV4). Avoids storing a broken Authorization header scheme.
    const deleteUrl = await createPresignedUrlForDelete({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY,
      bucketName: CLOUDFLARE_R2_BUCKET_NAME,
      key: cleanKey,
      expiresInSeconds: 300,
    });

    const response = await fetch(deleteUrl, { method: 'DELETE' });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`R2 delete failed: ${response.status} ${response.statusText} ${body.slice(0, 200)}`);
    }

    console.log(`User ${user.id} successfully deleted from R2: ${cleanKey}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in delete-from-r2 function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
