import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CONTENT_LENGTH = 20000;

interface MediaUrl {
  url: string;
  type: "image" | "video";
}

interface CreatePostRequest {
  content: string;
  media_urls: MediaUrl[];
  image_url?: string | null;
  video_url?: string | null;
  location?: string | null;
  tagged_user_ids?: string[];
  visibility?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[create-post] Start");

  try {
    // Check authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[create-post] No auth header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log("[create-post] Invalid token:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log("[create-post] User verified:", userId.substring(0, 8) + "...");

    // Parse request body
    const body: CreatePostRequest = await req.json();
    console.log("[create-post] Body received:", {
      contentLength: body.content?.length || 0,
      mediaCount: body.media_urls?.length || 0,
    });

    // Validate content
    if (!body.content?.trim() && (!body.media_urls || body.media_urls.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Nội dung hoặc media là bắt buộc" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate content length
    if (body.content && body.content.length > MAX_CONTENT_LENGTH) {
      console.log("[create-post] Content too long:", body.content.length);
      return new Response(
        JSON.stringify({ 
          error: `Nội dung quá dài (${body.content.length.toLocaleString()}/${MAX_CONTENT_LENGTH.toLocaleString()} ký tự)`,
          code: "CONTENT_TOO_LONG"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit via anti-sybil system
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: rateCheck } = await supabaseAdminClient.rpc("log_user_action", {
      p_user_id: userId,
      p_action_type: "post",
    });

    if (rateCheck && !(rateCheck as any).allowed) {
      const rc = rateCheck as any;
      console.log("[create-post] Rate limited:", rc);
      return new Response(
        JSON.stringify({
          error: `Bạn đã đạt giới hạn ${rc.limit} bài/ngày. Vui lòng thử lại sau.`,
          code: "RATE_LIMITED",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert post
    console.log("[create-post] Inserting post...");
    const insertStart = Date.now();
    
    // Validate visibility value
    const validVisibilities = ['public', 'friends', 'private'];
    const visibility = validVisibilities.includes(body.visibility || '') 
      ? body.visibility 
      : 'public';

    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content: body.content?.trim() || "",
        image_url: body.image_url || null,
        video_url: body.video_url || null,
        media_urls: body.media_urls || [],
        location: body.location || null,
        visibility: visibility,
      })
      .select("id")
      .single();

    const insertDuration = Date.now() - insertStart;
    
    if (insertError) {
      console.error("[create-post] Insert error:", insertError.message, insertError.code);
      
      // Parse constraint errors to friendly messages
      let errorMessage = insertError.message || "Không thể lưu bài viết";
      if (insertError.message?.includes("content_length")) {
        errorMessage = "Nội dung bài viết quá dài. Vui lòng rút gọn nội dung.";
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: insertError.code,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert tagged users if any
    if (post?.id && body.tagged_user_ids && body.tagged_user_ids.length > 0) {
      const tagsToInsert = body.tagged_user_ids.map(taggedUserId => ({
        post_id: post.id,
        tagged_user_id: taggedUserId,
      }));
      
      const { error: tagError } = await supabase
        .from("post_tags")
        .insert(tagsToInsert);
      
      if (tagError) {
        console.warn("[create-post] Tag insert error (non-fatal):", tagError.message);
      } else {
        console.log("[create-post] Tagged", tagsToInsert.length, "users");
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log("[create-post] Success!", {
      postId: post?.id,
      insertMs: insertDuration,
      totalMs: totalDuration,
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        postId: post?.id,
        timing: { insertMs: insertDuration, totalMs: totalDuration },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-post] Unexpected error:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message || "Lỗi không xác định" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
