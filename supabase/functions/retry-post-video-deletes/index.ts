import { createClient } from "npm:@supabase/supabase-js@2";
import {
  processDeleteTargets,
  summarizeTargets,
  updateDeleteMetadata,
} from "../_shared/postVideoDelete.ts";
import type { DeleteMetadata } from "../_shared/postVideoDelete.ts";

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

  const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
  if (cronSecret) {
    const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const headerToken = req.headers.get("x-cron-secret");
    if (authToken !== cronSecret && headerToken !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing Supabase function configuration" }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 50) : 20;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: posts, error } = await serviceClient
    .from("posts")
    .select("id, delete_attempts, delete_metadata, cloudflare_deleted_at, r2_deleted_at")
    .eq("delete_status", "delete_pending")
    .not("deleted_at", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) return json({ error: error.message }, 500);

  const results: Array<Record<string, unknown>> = [];

  for (const post of posts ?? []) {
    const metadata = post.delete_metadata as DeleteMetadata | null;
    if (!metadata?.targets?.length) {
      results.push({ post_id: post.id, status: "skipped", reason: "missing delete metadata" });
      continue;
    }

    const startedAt = new Date().toISOString();
    await serviceClient
      .from("posts")
      .update({
        delete_status: "deleting",
        delete_attempts: (post.delete_attempts ?? 0) + 1,
        updated_at: startedAt,
      })
      .eq("id", post.id);

    const processedTargets = await processDeleteTargets(metadata.targets);
    const summary = summarizeTargets(processedTargets);
    const finalMetadata = updateDeleteMetadata(metadata, processedTargets);
    const completedAt = new Date().toISOString();
    const finalStatus = summary.allDone ? "deleted" : "delete_pending";

    await serviceClient
      .from("posts")
      .update({
        delete_status: finalStatus,
        delete_error: summary.allDone ? null : summary.error,
        delete_completed_at: summary.allDone ? completedAt : null,
        delete_metadata: finalMetadata,
        cloudflare_deleted_at: summary.hasStream && summary.streamDone ? completedAt : post.cloudflare_deleted_at,
        r2_deleted_at: summary.hasR2 && summary.r2Done ? completedAt : post.r2_deleted_at,
        updated_at: completedAt,
      })
      .eq("id", post.id);

    if (metadata.live_session_ids.length > 0) {
      await serviceClient
        .from("live_replays")
        .update({
          status: "deleted",
          deleted_at: summary.allDone ? completedAt : null,
          delete_error: summary.allDone ? null : summary.error,
          updated_at: completedAt,
        })
        .in("live_session_id", metadata.live_session_ids);

      await serviceClient
        .from("live_recordings")
        .update({
          status: "deleted",
          deleted_at: summary.allDone ? completedAt : null,
          delete_error: summary.allDone ? null : summary.error,
        })
        .in("live_id", metadata.live_session_ids);

      await serviceClient
        .from("live_sessions")
        .update({
          recording_status: "deleted",
          recording_error: summary.allDone ? null : summary.error,
          updated_at: completedAt,
        })
        .in("id", metadata.live_session_ids);

      await serviceClient
        .from("creator_library")
        .update({
          status: "deleted",
          deleted_at: summary.allDone ? completedAt : null,
          updated_at: completedAt,
        })
        .in("live_session_id", metadata.live_session_ids);
    }

    await serviceClient
      .from("creator_library")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        updated_at: completedAt,
      })
      .eq("post_id", post.id);

    results.push({
      post_id: post.id,
      status: finalStatus,
      pending: summary.failed.length,
    });
  }

  return json({ processed: results.length, results });
});
