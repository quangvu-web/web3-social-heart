/**
 * Cleanup Stream Videos Edge Function
 * 
 * Cleans up orphaned/pending videos from Cloudflare Stream
 * that are older than 24 hours and haven't been attached to any post.
 * 
 * Can be called manually or scheduled via a cron job.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN');

interface StreamVideo {
  uid: string;
  status: { state: string };
  created: string;
  meta?: { userId?: string };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    // Validate environment
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
      throw new Error('Missing Cloudflare Stream configuration');
    }

    // Authenticate user (must be admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Admin access required');
    }

    console.log('[cleanup-stream-videos] Starting cleanup by admin:', user.id);

    // Get all videos from Cloudflare Stream
    const listResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error(`Failed to list videos: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    const videos: StreamVideo[] = listData.result || [];

    console.log('[cleanup-stream-videos] Found', videos.length, 'videos in Stream');

    // Get all video URLs from posts
    const { data: posts } = await supabaseClient
      .from('posts')
      .select('video_url, media_urls');

    const usedVideoUids = new Set<string>();
    
    posts?.forEach((post: any) => {
      // Check video_url
      if (post.video_url) {
        const match = post.video_url.match(/videodelivery\.net\/([a-f0-9]+)/);
        if (match) usedVideoUids.add(match[1]);
      }
      
      // Check media_urls
      if (post.media_urls && Array.isArray(post.media_urls)) {
        post.media_urls.forEach((media: any) => {
          if (media.type === 'video' && media.url) {
            const match = media.url.match(/videodelivery\.net\/([a-f0-9]+)/);
            if (match) usedVideoUids.add(match[1]);
          }
        });
      }
    });

    console.log('[cleanup-stream-videos] Found', usedVideoUids.size, 'videos in use');

    // Find orphan videos (not in any post and older than 24 hours)
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const orphanVideos: StreamVideo[] = [];
    const pendingVideos: StreamVideo[] = [];

    videos.forEach((video) => {
      const createdAt = new Date(video.created).getTime();
      const age = now - createdAt;
      
      // Check if video is orphaned (not in any post and older than 24 hours)
      if (!usedVideoUids.has(video.uid) && age > ONE_DAY_MS) {
        orphanVideos.push(video);
      }
      
      // Check for pending upload status (older than 24 hours)
      if (video.status?.state === 'pendingupload' && age > ONE_DAY_MS) {
        pendingVideos.push(video);
      }
    });

    console.log('[cleanup-stream-videos] Found', orphanVideos.length, 'orphan videos');
    console.log('[cleanup-stream-videos] Found', pendingVideos.length, 'pending videos');

    // Parse request for action
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run for safety

    const deletedVideos: string[] = [];
    const failedDeletions: string[] = [];

    if (!dryRun) {
      // Delete orphan videos
      for (const video of [...orphanVideos, ...pendingVideos]) {
        // Skip if already counted (some might be in both lists)
        if (deletedVideos.includes(video.uid)) continue;

        try {
          const deleteResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${video.uid}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
              },
            }
          );

          if (deleteResponse.ok || deleteResponse.status === 404) {
            deletedVideos.push(video.uid);
            console.log('[cleanup-stream-videos] Deleted:', video.uid);
          } else {
            failedDeletions.push(video.uid);
            console.error('[cleanup-stream-videos] Failed to delete:', video.uid);
          }
        } catch (err) {
          failedDeletions.push(video.uid);
          console.error('[cleanup-stream-videos] Error deleting:', video.uid, err);
        }
      }
    }

    const result = {
      dryRun,
      totalVideos: videos.length,
      videosInUse: usedVideoUids.size,
      orphanVideos: orphanVideos.map(v => ({
        uid: v.uid,
        created: v.created,
        status: v.status?.state,
      })),
      pendingVideos: pendingVideos.map(v => ({
        uid: v.uid,
        created: v.created,
      })),
      deletedCount: deletedVideos.length,
      failedCount: failedDeletions.length,
    };

    console.log('[cleanup-stream-videos] Cleanup complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cleanup-stream-videos] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: errorMessage === 'Unauthorized' || errorMessage === 'Admin access required' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
