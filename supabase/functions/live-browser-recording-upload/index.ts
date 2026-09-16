import { createClient } from "npm:@supabase/supabase-js@2";
import { getR2Config, putR2Object, sanitizeR2Key } from "../_shared/r2Archive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-live-session-id",
    "x-post-id",
    "x-chunk-index",
    "x-mime-type",
    "x-duration-ms",
  ].join(", "),
  "Access-Control-Allow-Methods": "PUT, POST, OPTIONS",
};

const MIME_EXT: Record<string, string> = {
  "video/webm": "webm",
  "video/mp4": "mp4",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function baseMime(value: string) {
  return value.split(";")[0].trim().toLowerCase();
}

function parseIntHeader(req: Request, name: string, required = true): number | null {
  const raw = req.headers.get(name);
  if (!raw) {
    if (required) throw new Error(`${name} is required`);
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} is invalid`);
  return value;
}

function chunkKey(sessionId: string, chunkIndex: number, extension: string) {
  const padded = String(chunkIndex).padStart(6, "0");
  return sanitizeR2Key(`temp/browser-recordings/${sessionId}/chunk-${padded}.${extension}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "PUT" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Supabase configuration missing" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Invalid token" }, 401);

    const isJsonStatusUpdate = (req.headers.get("content-type") || "").toLowerCase().includes("application/json");
    const jsonBody = isJsonStatusUpdate ? await req.json().catch(() => ({})) : {};
    const liveSessionId = String(jsonBody.live_session_id || jsonBody.liveSessionId || req.headers.get("x-live-session-id") || "").trim();
    const postId = (req.headers.get("x-post-id") || "").trim() || null;
    if (!liveSessionId) return json({ error: "x-live-session-id is required" }, 400);

    const { data: live, error: liveError } = await serviceClient
      .from("live_sessions")
      .select("id, user_id, host_user_id, owner_id, post_id, live_post_id, status, browser_recording_status")
      .eq("id", liveSessionId)
      .maybeSingle();
    if (liveError) throw liveError;
    if (!live) return json({ error: "Live session not found" }, 404);

    const ownerId = live.user_id || live.host_user_id || live.owner_id;
    if (ownerId !== user.id) return json({ error: "Only host can upload browser recording chunks" }, 403);

    if (isJsonStatusUpdate) {
      const status = String(jsonBody.browser_recording_status || jsonBody.status || "").trim();
      const allowed = new Set(["recording", "uploading", "uploaded", "failed"]);
      if (!allowed.has(status)) return json({ error: "Invalid browser recording status" }, 400);
      const warning = typeof jsonBody.warning === "string" ? jsonBody.warning.slice(0, 500) : null;
      const errorMessage = typeof jsonBody.error_message === "string" ? jsonBody.error_message.slice(0, 1000) : null;
      const updatePayload: Record<string, unknown> = {
        recording_provider: "browser",
        browser_recording_status: status,
        browser_recording_warning: warning,
        updated_at: new Date().toISOString(),
      };
      if (status === "failed") {
        updatePayload.recording_error_code = "BROWSER_RECORDING_FAILED";
        updatePayload.recording_error_message = errorMessage || warning || "Browser recording failed.";
      }
      await serviceClient
        .from("live_sessions")
        .update(updatePayload)
        .eq("id", liveSessionId);
      return json({ success: true, live_session_id: liveSessionId, browser_recording_status: status });
    }

    const chunkIndex = parseIntHeader(req, "x-chunk-index");
    const durationMs = parseIntHeader(req, "x-duration-ms", false);
    const mimeType = (req.headers.get("x-mime-type") || req.headers.get("content-type") || "video/webm").trim();
    const mime = baseMime(mimeType);
    if (chunkIndex === null) return json({ error: "x-chunk-index is required" }, 400);
    if (!MIME_EXT[mime]) return json({ error: "Unsupported recording MIME type" }, 400);

    const configuredMax = Number(Deno.env.get("BROWSER_RECORDING_MAX_CHUNK_BYTES") || "");
    const maxBytes = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 50 * 1024 * 1024;
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > maxBytes) return json({ error: "Recording chunk too large" }, 413);

    const body = new Uint8Array(await req.arrayBuffer());
    if (body.byteLength <= 0) return json({ error: "Empty recording chunk" }, 400);
    if (body.byteLength > maxBytes) return json({ error: "Recording chunk too large" }, 413);

    const { data: previous } = await serviceClient
      .from("live_recording_chunks")
      .select("chunk_index")
      .eq("live_session_id", liveSessionId)
      .eq("provider", "browser")
      .order("chunk_index", { ascending: false })
      .limit(1);
    const previousIndex = previous?.[0]?.chunk_index;
    if (typeof previousIndex === "number" && chunkIndex > previousIndex + 2) {
      return json({ error: "Recording chunk index is out of order" }, 409);
    }

    const r2 = getR2Config();
    const key = chunkKey(liveSessionId, chunkIndex, MIME_EXT[mime]);
    console.log("[live-browser-recording-upload] upload chunk", {
      liveSessionId,
      userId: user.id,
      chunkIndex,
      sizeBytes: body.byteLength,
      mimeType,
      key,
    });

    const putRes = await putR2Object(r2, r2.tempBucket, key, body, mimeType);
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      throw new Error(`R2 upload failed: ${putRes.status} ${text.slice(0, 300)}`);
    }

    const finalPostId = postId || live.post_id || live.live_post_id || null;
    const now = new Date().toISOString();
    const { error: upsertError } = await serviceClient
      .from("live_recording_chunks")
      .upsert({
        live_session_id: liveSessionId,
        post_id: finalPostId,
        provider: "browser",
        chunk_index: chunkIndex,
        r2_bucket: r2.tempBucket,
        r2_key: key,
        mime_type: mimeType,
        size_bytes: body.byteLength,
        duration_ms: durationMs,
        uploaded_at: now,
        status: "uploaded",
        error_message: null,
      }, { onConflict: "live_session_id,provider,chunk_index" });
    if (upsertError) throw upsertError;

    const { data: stats, error: statsError } = await serviceClient
      .from("live_recording_chunks")
      .select("size_bytes")
      .eq("live_session_id", liveSessionId)
      .eq("provider", "browser")
      .eq("status", "uploaded");
    if (statsError) throw statsError;

    const chunkCount = stats?.length ?? 0;
    const totalBytes = (stats ?? []).reduce((sum: number, row: any) => sum + Number(row.size_bytes || 0), 0);
    const nextBrowserStatus = live.status === "live" ? "uploading" : "uploaded";

    await serviceClient
      .from("live_sessions")
      .update({
        recording_provider: "browser",
        browser_recording_status: nextBrowserStatus,
        browser_recording_chunk_count: chunkCount,
        browser_recording_total_bytes: totalBytes,
        updated_at: now,
      })
      .eq("id", liveSessionId);

    return json({
      success: true,
      r2_key: key,
      size_bytes: body.byteLength,
      chunk_index: chunkIndex,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[live-browser-recording-upload] failed", message);
    return json({ error: message }, 500);
  }
});
