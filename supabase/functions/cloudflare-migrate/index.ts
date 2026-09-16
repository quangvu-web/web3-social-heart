import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MigrationResult {
  url: string;
  type: 'image' | 'video';
  status: 'success' | 'failed' | 'skipped';
  newUrl?: string;
  error?: string;
}

interface MigrationStats {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
}

/**
 * R2 to Cloudflare Images/Stream Migration Worker
 * 
 * Actions:
 * - list-media: List all media URLs from R2 in database
 * - migrate-images: Migrate images from R2 to Cloudflare Images
 * - migrate-videos: Migrate videos from R2 to Cloudflare Stream
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list-media';

    // Get required env vars
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const cfApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const streamApiToken = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN');
    const r2PublicUrl = Deno.env.get('CLOUDFLARE_R2_PUBLIC_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} - Action: ${action}`);

    switch (action) {
      case 'list-media': {
        // List all R2 media URLs from database
        const { data: posts } = await supabase
          .from('posts')
          .select('id, image_url, video_url, media_urls')
          .or('video_url.not.is.null,image_url.not.is.null');

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, avatar_url, cover_url')
          .or('avatar_url.not.is.null,cover_url.not.is.null');

        const { data: comments } = await supabase
          .from('comments')
          .select('id, image_url, video_url')
          .or('image_url.not.is.null,video_url.not.is.null');

        const images: string[] = [];
        const videos: string[] = [];

        // Collect from posts
        posts?.forEach(post => {
          if (post.image_url && isR2Url(post.image_url, r2PublicUrl)) {
            images.push(post.image_url);
          }
          if (post.video_url && isR2Url(post.video_url, r2PublicUrl)) {
            videos.push(post.video_url);
          }
          if (post.media_urls) {
            const mediaUrls = post.media_urls as any[];
            mediaUrls?.forEach(m => {
              if (m.type === 'image' && isR2Url(m.url, r2PublicUrl)) {
                images.push(m.url);
              } else if (m.type === 'video' && isR2Url(m.url, r2PublicUrl)) {
                videos.push(m.url);
              }
            });
          }
        });

        // Collect from profiles
        profiles?.forEach(profile => {
          if (profile.avatar_url && isR2Url(profile.avatar_url, r2PublicUrl)) {
            images.push(profile.avatar_url);
          }
          if (profile.cover_url && isR2Url(profile.cover_url, r2PublicUrl)) {
            images.push(profile.cover_url);
          }
        });

        // Collect from comments
        comments?.forEach(comment => {
          if (comment.image_url && isR2Url(comment.image_url, r2PublicUrl)) {
            images.push(comment.image_url);
          }
          if (comment.video_url && isR2Url(comment.video_url, r2PublicUrl)) {
            videos.push(comment.video_url);
          }
        });

        // Remove duplicates
        const uniqueImages = [...new Set(images)];
        const uniqueVideos = [...new Set(videos)];

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              images: uniqueImages.length,
              videos: uniqueVideos.length,
              total: uniqueImages.length + uniqueVideos.length,
            },
            images: uniqueImages,
            videos: uniqueVideos,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'migrate-images': {
        if (!accountId || !cfApiToken) {
          return new Response(
            JSON.stringify({ error: 'Cloudflare Images not configured. Need CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const imageUrls = body.urls as string[];
        const batchSize = body.batchSize || 5;

        if (!imageUrls || !Array.isArray(imageUrls)) {
          return new Response(
            JSON.stringify({ error: 'urls array required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const results: MigrationResult[] = [];
        const stats: MigrationStats = {
          total: imageUrls.length,
          processed: 0,
          success: 0,
          failed: 0,
          skipped: 0,
        };

        // Process in batches to avoid rate limits
        for (let i = 0; i < imageUrls.length; i += batchSize) {
          const batch = imageUrls.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (imageUrl) => {
            try {
              // Upload to Cloudflare Images via URL
              const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${cfApiToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    url: imageUrl,
                    requireSignedURLs: false,
                  }),
                }
              );

              const data = await response.json();

              if (data.success && data.result) {
                stats.success++;
                return {
                  url: imageUrl,
                  type: 'image' as const,
                  status: 'success' as const,
                  newUrl: data.result.variants?.[0] || `https://imagedelivery.net/${accountId}/${data.result.id}/public`,
                };
              } else {
                stats.failed++;
                return {
                  url: imageUrl,
                  type: 'image' as const,
                  status: 'failed' as const,
                  error: data.errors?.[0]?.message || 'Unknown error',
                };
              }
            } catch (error: any) {
              stats.failed++;
              return {
                url: imageUrl,
                type: 'image' as const,
                status: 'failed' as const,
                error: error.message,
              };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
          stats.processed += batch.length;

          // Rate limit delay between batches (1 second)
          if (i + batchSize < imageUrls.length) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        return new Response(
          JSON.stringify({ success: true, stats, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'migrate-videos': {
        if (!accountId || !streamApiToken) {
          return new Response(
            JSON.stringify({ error: 'Cloudflare Stream not configured. Need CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const videoUrls = body.urls as string[];
        const batchSize = body.batchSize || 1; // Process videos one at a time

        if (!videoUrls || !Array.isArray(videoUrls)) {
          return new Response(
            JSON.stringify({ error: 'urls array required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const results: MigrationResult[] = [];
        const stats: MigrationStats = {
          total: videoUrls.length,
          processed: 0,
          success: 0,
          failed: 0,
          skipped: 0,
        };

        // Process videos one at a time
        for (const videoUrl of videoUrls) {
          try {
            // Use Stream Copy API to pull from R2 URL
            const response = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${streamApiToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: videoUrl,
                  meta: {
                    source: 'r2_migration',
                    original_url: videoUrl,
                  },
                }),
              }
            );

            const data = await response.json();

            if (data.success && data.result) {
              stats.success++;
              const videoId = data.result.uid;
              results.push({
                url: videoUrl,
                type: 'video',
                status: 'success',
                newUrl: `https://customer-${accountId.slice(0,8)}.cloudflarestream.com/${videoId}/manifest/video.m3u8`,
              });
            } else {
              stats.failed++;
              results.push({
                url: videoUrl,
                type: 'video',
                status: 'failed',
                error: data.errors?.[0]?.message || 'Unknown error',
              });
            }
          } catch (error: any) {
            stats.failed++;
            results.push({
              url: videoUrl,
              type: 'video',
              status: 'failed',
              error: error.message,
            });
          }

          stats.processed++;

          // Delay between videos (2 seconds)
          if (stats.processed < videoUrls.length) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        return new Response(
          JSON.stringify({ success: true, stats, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-urls': {
        // Update database URLs with new Cloudflare URLs
        const body = await req.json();
        const mappings = body.mappings as { oldUrl: string; newUrl: string; type: 'image' | 'video' }[];

        if (!mappings || !Array.isArray(mappings)) {
          return new Response(
            JSON.stringify({ error: 'mappings array required: [{oldUrl, newUrl, type}]' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Updating ${mappings.length} URLs in database...`);

        const updateResults: { url: string; updated: boolean; tables: string[]; error?: string }[] = [];

        for (const mapping of mappings) {
          const { oldUrl, newUrl, type } = mapping;
          const tablesUpdated: string[] = [];
          
          try {
            // Update posts
            if (type === 'image') {
              const { data: postsImg } = await supabase
                .from('posts')
                .update({ image_url: newUrl })
                .eq('image_url', oldUrl)
                .select('id');
              if (postsImg?.length) tablesUpdated.push(`posts.image_url (${postsImg.length})`);
            } else {
              const { data: postsVid } = await supabase
                .from('posts')
                .update({ video_url: newUrl })
                .eq('video_url', oldUrl)
                .select('id');
              if (postsVid?.length) tablesUpdated.push(`posts.video_url (${postsVid.length})`);
            }

            // Update profiles (images only)
            if (type === 'image') {
              const { data: avatars } = await supabase
                .from('profiles')
                .update({ avatar_url: newUrl })
                .eq('avatar_url', oldUrl)
                .select('id');
              if (avatars?.length) tablesUpdated.push(`profiles.avatar_url (${avatars.length})`);

              const { data: covers } = await supabase
                .from('profiles')
                .update({ cover_url: newUrl })
                .eq('cover_url', oldUrl)
                .select('id');
              if (covers?.length) tablesUpdated.push(`profiles.cover_url (${covers.length})`);
            }

            // Update comments
            if (type === 'image') {
              const { data: commentImgs } = await supabase
                .from('comments')
                .update({ image_url: newUrl })
                .eq('image_url', oldUrl)
                .select('id');
              if (commentImgs?.length) tablesUpdated.push(`comments.image_url (${commentImgs.length})`);
            } else {
              const { data: commentVids } = await supabase
                .from('comments')
                .update({ video_url: newUrl })
                .eq('video_url', oldUrl)
                .select('id');
              if (commentVids?.length) tablesUpdated.push(`comments.video_url (${commentVids.length})`);
            }

            // Update media_urls in posts (JSON array)
            const { data: postsWithMedia } = await supabase
              .from('posts')
              .select('id, media_urls')
              .not('media_urls', 'is', null);

            if (postsWithMedia) {
              for (const post of postsWithMedia) {
                const mediaUrls = post.media_urls as any[];
                if (!Array.isArray(mediaUrls)) continue;
                
                let updated = false;
                const newMediaUrls = mediaUrls.map(m => {
                  if (m.url === oldUrl) {
                    updated = true;
                    return { ...m, url: newUrl };
                  }
                  return m;
                });

                if (updated) {
                  await supabase
                    .from('posts')
                    .update({ media_urls: newMediaUrls })
                    .eq('id', post.id);
                  tablesUpdated.push(`posts.media_urls (${post.id})`);
                }
              }
            }

            updateResults.push({
              url: oldUrl,
              updated: tablesUpdated.length > 0,
              tables: tablesUpdated,
            });

          } catch (error: any) {
            updateResults.push({
              url: oldUrl,
              updated: false,
              tables: [],
              error: error.message,
            });
          }
        }

        const successCount = updateResults.filter(r => r.updated).length;
        console.log(`Updated ${successCount}/${mappings.length} URLs`);

        return new Response(
          JSON.stringify({
            success: true,
            stats: {
              total: mappings.length,
              updated: successCount,
              failed: mappings.length - successCount,
            },
            results: updateResults,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Invalid action',
            availableActions: ['list-media', 'migrate-images', 'migrate-videos', 'update-urls'],
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function isR2Url(url: string, r2PublicUrl?: string): boolean {
  if (!url) return false;
  if (r2PublicUrl && url.includes(r2PublicUrl)) return true;
  // Also check for common R2 patterns
  return url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com');
}
