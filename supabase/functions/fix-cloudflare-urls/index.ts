import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UrlToFix {
  table: string;
  id: string;
  field: string;
  oldUrl: string;
  newUrl: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT and admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const r2PublicUrl = Deno.env.get('CLOUDFLARE_R2_PUBLIC_URL')!;

    // Verify user with anon key
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role using service key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: hasRole } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Admin ${user.id} running fix-cloudflare-urls`);

    // Find all URLs containing dash.cloudflare.com
    const urlsToFix: UrlToFix[] = [];

    // Check posts - filter directly in SQL to avoid 1000 row limit
    const { data: posts } = await supabaseAdmin
      .from('posts')
      .select('id, image_url, video_url')
      .or('image_url.ilike.%dash.cloudflare.com%,video_url.ilike.%dash.cloudflare.com%');

    console.log(`Found ${posts?.length || 0} posts with dash.cloudflare.com URLs`);

    posts?.forEach(post => {
      if (post.image_url?.includes('dash.cloudflare.com')) {
        const newUrl = extractAndFixUrl(post.image_url, r2PublicUrl);
        if (newUrl) {
          urlsToFix.push({
            table: 'posts',
            id: post.id,
            field: 'image_url',
            oldUrl: post.image_url,
            newUrl,
          });
        }
      }
      if (post.video_url?.includes('dash.cloudflare.com')) {
        const newUrl = extractAndFixUrl(post.video_url, r2PublicUrl);
        if (newUrl) {
          urlsToFix.push({
            table: 'posts',
            id: post.id,
            field: 'video_url',
            oldUrl: post.video_url,
            newUrl,
          });
        }
      }
    });

    // Check profiles - filter directly in SQL to avoid 1000 row limit
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, avatar_url, cover_url')
      .or('avatar_url.ilike.%dash.cloudflare.com%,cover_url.ilike.%dash.cloudflare.com%');

    console.log(`Found ${profiles?.length || 0} profiles with dash.cloudflare.com URLs`);

    profiles?.forEach(profile => {
      if (profile.avatar_url?.includes('dash.cloudflare.com')) {
        const newUrl = extractAndFixUrl(profile.avatar_url, r2PublicUrl);
        if (newUrl) {
          urlsToFix.push({
            table: 'profiles',
            id: profile.id,
            field: 'avatar_url',
            oldUrl: profile.avatar_url,
            newUrl,
          });
        }
      }
      if (profile.cover_url?.includes('dash.cloudflare.com')) {
        const newUrl = extractAndFixUrl(profile.cover_url, r2PublicUrl);
        if (newUrl) {
          urlsToFix.push({
            table: 'profiles',
            id: profile.id,
            field: 'cover_url',
            oldUrl: profile.cover_url,
            newUrl,
          });
        }
      }
    });

    // Check comments - filter directly in SQL to avoid 1000 row limit
    const { data: comments } = await supabaseAdmin
      .from('comments')
      .select('id, image_url, video_url')
      .or('image_url.ilike.%dash.cloudflare.com%,video_url.ilike.%dash.cloudflare.com%');

    console.log(`Found ${comments?.length || 0} comments with dash.cloudflare.com URLs`);

    comments?.forEach(comment => {
      if (comment.image_url?.includes('dash.cloudflare.com')) {
        const newUrl = extractAndFixUrl(comment.image_url, r2PublicUrl);
        if (newUrl) {
          urlsToFix.push({
            table: 'comments',
            id: comment.id,
            field: 'image_url',
            oldUrl: comment.image_url,
            newUrl,
          });
        }
      }
      if (comment.video_url?.includes('dash.cloudflare.com')) {
        const newUrl = extractAndFixUrl(comment.video_url, r2PublicUrl);
        if (newUrl) {
          urlsToFix.push({
            table: 'comments',
            id: comment.id,
            field: 'video_url',
            oldUrl: comment.video_url,
            newUrl,
          });
        }
      }
    });

    console.log(`Found ${urlsToFix.length} URLs to fix`);

    if (urlsToFix.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No URLs need fixing',
        total: 0,
        fixed: 0,
        errors: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fix each URL
    const errors: Array<{ url: string; error: string }> = [];
    let fixed = 0;

    for (const item of urlsToFix) {
      try {
        const { error } = await supabaseAdmin
          .from(item.table)
          .update({ [item.field]: item.newUrl })
          .eq('id', item.id);

        if (error) {
          errors.push({ url: item.oldUrl, error: error.message });
          console.error(`Failed to update ${item.table}.${item.field} for ${item.id}:`, error);
        } else {
          fixed++;
          console.log(`Fixed: ${item.oldUrl} -> ${item.newUrl}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ url: item.oldUrl, error: errorMsg });
      }
    }

    console.log(`Fixed ${fixed}/${urlsToFix.length} URLs`);

    return new Response(JSON.stringify({
      success: true,
      message: `Fixed ${fixed} URLs`,
      total: urlsToFix.length,
      fixed,
      errors,
      details: urlsToFix.map(u => ({
        table: u.table,
        field: u.field,
        oldUrl: u.oldUrl,
        newUrl: u.newUrl,
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fixing URLs:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Extract the path from a dash.cloudflare.com URL and create correct R2 public URL
 * 
 * Input: https://dash.cloudflare.com/6083e34ad429331916b93ba8a5ede81d/r2/default/buckets/fun-rich-media/posts/user-id/filename.jpg
 * Output: https://pub-e83e74b0726742fbb6a60bc08f95624b.r2.dev/posts/user-id/filename.jpg
 */
function extractAndFixUrl(url: string, r2PublicUrl: string): string | null {
  try {
    // Pattern 1: .../buckets/fun-rich-media/path
    const bucketMatch = url.match(/\/buckets\/fun-rich-media\/(.+)$/);
    if (bucketMatch) {
      const path = bucketMatch[1];
      return `${r2PublicUrl}/${path}`;
    }

    // Pattern 2: .../objects/path (some R2 dashboard URLs use this)
    const objectsMatch = url.match(/\/objects\/(.+)$/);
    if (objectsMatch) {
      const path = objectsMatch[1];
      return `${r2PublicUrl}/${path}`;
    }

    // Pattern 3: Try to extract any path after r2/default/
    const r2Match = url.match(/\/r2\/default\/buckets\/[^/]+\/(.+)$/);
    if (r2Match) {
      const path = r2Match[1];
      return `${r2PublicUrl}/${path}`;
    }

    console.warn(`Could not extract path from URL: ${url}`);
    return null;
  } catch (error) {
    console.error(`Error extracting path from URL: ${url}`, error);
    return null;
  }
}
