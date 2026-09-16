import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface StreamVideo {
  uid: string;
  created: string;
  modified: string;
  meta?: {
    name?: string;
  };
  status?: {
    state: string;
  };
}

interface CleanupResult {
  totalVideosOnStream: number;
  totalVideosInDb: number;
  orphanVideosFound: number;
  orphanVideosDeleted: number;
  errors: string[];
  deletedUids: string[];
  dryRun: boolean;
}

// Extract Stream UID from various URL formats
function extractStreamUid(url: string): string | null {
  if (!url) return null;
  
  // Format: https://customer-xxx.cloudflarestream.com/uid/...
  const customerMatch = url.match(/cloudflarestream\.com\/([a-f0-9]{32})/i);
  if (customerMatch) return customerMatch[1];
  
  // Format: https://iframe.videodelivery.net/uid
  const iframeMatch = url.match(/videodelivery\.net\/([a-f0-9]{32})/i);
  if (iframeMatch) return iframeMatch[1];
  
  // Format: https://watch.videodelivery.net/uid
  const watchMatch = url.match(/watch\.videodelivery\.net\/([a-f0-9]{32})/i);
  if (watchMatch) return watchMatch[1];
  
  return null;
}

// List all videos from Cloudflare Stream
async function listAllStreamVideos(): Promise<StreamVideo[]> {
  const allVideos: StreamVideo[] = [];
  let cursor: string | undefined;
  
  do {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`);
    url.searchParams.set('per_page', '100');
    if (cursor) {
      url.searchParams.set('after', cursor);
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list videos: ${response.status} ${await response.text()}`);
    }
    
    const data = await response.json();
    
    if (data.result && Array.isArray(data.result)) {
      allVideos.push(...data.result);
      
      // Get cursor for next page
      if (data.result.length === 100 && data.result_info?.cursor) {
        cursor = data.result_info.cursor;
      } else {
        cursor = undefined;
      }
    } else {
      cursor = undefined;
    }
  } while (cursor);
  
  return allVideos;
}

// Get all video UIDs referenced in the database
async function getDbVideoUids(supabase: any): Promise<Set<string>> {
  const uids = new Set<string>();
  
  // Get video_url from posts
  const { data: postsWithVideo } = await supabase
    .from('posts')
    .select('video_url')
    .not('video_url', 'is', null);
  
  if (postsWithVideo) {
    for (const post of postsWithVideo as { video_url: string }[]) {
      const uid = extractStreamUid(post.video_url);
      if (uid) uids.add(uid);
    }
  }
  
  // Get videos from media_urls in posts
  const { data: postsWithMedia } = await supabase
    .from('posts')
    .select('media_urls')
    .not('media_urls', 'is', null);
  
  if (postsWithMedia) {
    for (const post of postsWithMedia as { media_urls: any[] }[]) {
      if (Array.isArray(post.media_urls)) {
        for (const media of post.media_urls) {
          if (typeof media === 'object' && media !== null) {
            const mediaObj = media as { type?: string; url?: string };
            if (mediaObj.type === 'video' && mediaObj.url) {
              const uid = extractStreamUid(mediaObj.url);
              if (uid) uids.add(uid);
            }
          }
        }
      }
    }
  }
  
  // Get video_url from comments
  const { data: commentsWithVideo } = await supabase
    .from('comments')
    .select('video_url')
    .not('video_url', 'is', null);
  
  if (commentsWithVideo) {
    for (const comment of commentsWithVideo as { video_url: string }[]) {
      const uid = extractStreamUid(comment.video_url);
      if (uid) uids.add(uid);
    }
  }
  
  // Get cover_url from profiles (in case videos are used as covers)
  const { data: profilesWithCover } = await supabase
    .from('profiles')
    .select('cover_url')
    .not('cover_url', 'is', null);
  
  if (profilesWithCover) {
    for (const profile of profilesWithCover as { cover_url: string }[]) {
      const uid = extractStreamUid(profile.cover_url);
      if (uid) uids.add(uid);
    }
  }
  
  return uids;
}

// Delete a video from Cloudflare Stream
async function deleteStreamVideo(uid: string): Promise<boolean> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
      },
    }
  );
  
  return response.ok || response.status === 404;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Check environment variables
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
      throw new Error('Missing Cloudflare Stream credentials');
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }
    
    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    
    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    
    if (!roles) {
      throw new Error('Only admins can run cleanup');
    }
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run for safety
    const maxDelete = body.maxDelete || 50; // Limit deletions per run
    
    console.log(`[cleanup-orphan-videos] Starting cleanup (dryRun: ${dryRun}, maxDelete: ${maxDelete})`);
    
    // Get all videos from Cloudflare Stream
    console.log('[cleanup-orphan-videos] Fetching videos from Cloudflare Stream...');
    const streamVideos = await listAllStreamVideos();
    console.log(`[cleanup-orphan-videos] Found ${streamVideos.length} videos on Stream`);
    
    // Get all video UIDs from database
    console.log('[cleanup-orphan-videos] Fetching video references from database...');
    const dbVideoUids = await getDbVideoUids(supabase);
    console.log(`[cleanup-orphan-videos] Found ${dbVideoUids.size} video references in database`);
    
    // Find orphan videos
    const orphanVideos = streamVideos.filter(video => !dbVideoUids.has(video.uid));
    console.log(`[cleanup-orphan-videos] Found ${orphanVideos.length} orphan videos`);
    
    const result: CleanupResult = {
      totalVideosOnStream: streamVideos.length,
      totalVideosInDb: dbVideoUids.size,
      orphanVideosFound: orphanVideos.length,
      orphanVideosDeleted: 0,
      errors: [],
      deletedUids: [],
      dryRun,
    };
    
    // Delete orphan videos (with limit)
    const videosToDelete = orphanVideos.slice(0, maxDelete);
    
    for (const video of videosToDelete) {
      if (dryRun) {
        console.log(`[cleanup-orphan-videos] [DRY RUN] Would delete: ${video.uid} (created: ${video.created})`);
        result.deletedUids.push(video.uid);
        result.orphanVideosDeleted++;
      } else {
        try {
          console.log(`[cleanup-orphan-videos] Deleting: ${video.uid}`);
          const success = await deleteStreamVideo(video.uid);
          if (success) {
            result.deletedUids.push(video.uid);
            result.orphanVideosDeleted++;
          } else {
            result.errors.push(`Failed to delete ${video.uid}`);
          }
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Error deleting ${video.uid}: ${errorMsg}`);
        }
      }
    }
    
    if (orphanVideos.length > maxDelete) {
      console.log(`[cleanup-orphan-videos] Limited to ${maxDelete} deletions. ${orphanVideos.length - maxDelete} orphans remaining.`);
    }
    
    console.log(`[cleanup-orphan-videos] Cleanup complete. Deleted: ${result.orphanVideosDeleted}, Errors: ${result.errors.length}`);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[cleanup-orphan-videos] Error:', errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
