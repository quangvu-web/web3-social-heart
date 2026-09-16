import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildDeleteMetadata,
  processDeleteTargets,
  summarizeTargets,
  updateDeleteMetadata,
} from "../_shared/postVideoDelete.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Missing Supabase function configuration" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: authError } = await userClient.auth.getUser();
  const user = userData.user;
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const postId = typeof body.post_id === "string" ? body.post_id : typeof body.postId === "string" ? body.postId : null;
  if (!postId) return json({ error: "Missing post_id" }, 400);

  const { data: post, error: postError } = await serviceClient
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (postError) return json({ error: postError.message }, 500);
  if (!post) return json({ error: "Post not found" }, 404);

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (roleError) console.warn("[delete-post] has_role failed:", roleError.message);

  if (post.user_id !== user.id && !isAdmin) {
    return json({ error: "Forbidden" }, 403);
  }

  if (post.delete_status === "deleted") {
    return json({ status: "deleted", post_id: postId, already_deleted: true });
  }

  const deleteMetadata = await buildDeleteMetadata({ supabase: serviceClient, post });
  const requestedAt = new Date().toISOString();

  await serviceClient
    .from("posts")
    .update({
      delete_status: "deleting",
      delete_requested_at: post.delete_requested_at ?? requestedAt,
      delete_attempts: (post.delete_attempts ?? 0) + 1,
      delete_metadata: deleteMetadata,
      delete_error: null,
      updated_at: requestedAt,
    })
    .eq("id", postId);

  const processedTargets = await processDeleteTargets(deleteMetadata.targets);
  const summary = summarizeTargets(processedTargets);
  const finalMetadata = updateDeleteMetadata(deleteMetadata, processedTargets);
  const completedAt = new Date().toISOString();
  const finalStatus = summary.allDone ? "deleted" : "delete_pending";

  const updatePayload: Record<string, unknown> = {
    deleted_at: post.deleted_at ?? completedAt,
    delete_status: finalStatus,
    delete_error: summary.allDone ? null : summary.error,
    delete_completed_at: summary.allDone ? completedAt : null,
    delete_metadata: finalMetadata,
    cloudflare_deleted_at: summary.hasStream && summary.streamDone ? completedAt : post.cloudflare_deleted_at,
    r2_deleted_at: summary.hasR2 && summary.r2Done ? completedAt : post.r2_deleted_at,
    updated_at: completedAt,
  };

  const { error: updateError } = await serviceClient.from("posts").update(updatePayload).eq("id", postId);
  if (updateError) return json({ error: updateError.message }, 500);

  if (deleteMetadata.live_session_ids.length > 0) {
    await serviceClient
      .from("live_replays")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        delete_error: summary.allDone ? null : summary.error,
        updated_at: completedAt,
      })
      .in("live_session_id", deleteMetadata.live_session_ids);

    await serviceClient
      .from("live_recordings")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        delete_error: summary.allDone ? null : summary.error,
      })
      .in("live_id", deleteMetadata.live_session_ids);

    await serviceClient
      .from("live_sessions")
      .update({
        recording_status: "deleted",
        recording_error: summary.allDone ? null : summary.error,
        updated_at: completedAt,
      })
      .in("id", deleteMetadata.live_session_ids);

    await serviceClient
      .from("creator_library")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        updated_at: completedAt,
      })
      .in("live_session_id", deleteMetadata.live_session_ids);
  }

  await serviceClient
    .from("creator_library")
    .update({
      status: "deleted",
      deleted_at: summary.allDone ? completedAt : null,
      updated_at: completedAt,
    })
    .eq("post_id", postId);

  return json({
    status: finalStatus,
    post_id: postId,
    deleted: {
      stream: processedTargets.filter((target) => target.type === "cloudflare_stream" && target.status === "deleted").length,
      r2: processedTargets.filter((target) => target.type === "r2" && target.status === "deleted").length,
    },
    pending: processedTargets.filter((target) => target.status === "failed").length,
    errors: summary.failed.map((target) => ({
      type: target.type,
      value: target.value,
      error: target.error,
    })),
  }, summary.allDone ? 200 : 202);
});
