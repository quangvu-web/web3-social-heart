import { encryptSecret } from "./genericCrypto.ts";
import { callAgora, loadAgoraCreds } from "./agoraRecording.ts";
import {
  getRestreamIngest,
  logRestreamApi,
  type SupabaseClient,
} from "./restream.ts";

const STREAM_SECRET_ENV = "RESTREAM_TOKEN_ENCRYPTION_SECRET";

type DestinationRow = {
  id: string;
  live_session_id: string;
  user_id: string;
  platform: string;
  restream_channel_id: string | null;
};

function normalizeChannelIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map(String).map((item) => item.trim()).filter(Boolean)));
}

async function createAgoraEgress(input: {
  channelName: string;
  uid?: number | null;
  rtmpUrl: string;
  streamKey: string;
}) {
  const overrideUrl = (Deno.env.get("AGORA_RTMP_EGRESS_API_URL") || "").trim();
  const targetUrl = `${input.rtmpUrl.replace(/\/+$/, "")}/${input.streamKey}`;

  if (overrideUrl) {
    const started = Date.now();
    const res = await fetch(overrideUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelName: input.channelName,
        uid: input.uid ?? undefined,
        rtmpUrl: targetUrl,
      }),
    });
    const raw = await res.text();
    let body: any = {};
    try { body = JSON.parse(raw); } catch { body = { raw }; }
    if (!res.ok) throw new Error(body?.error || body?.message || "Agora RTMP egress override failed");
    return { id: String(body.id || body.taskId || body.sid || crypto.randomUUID()), raw: body, durationMs: Date.now() - started };
  }

  const converterPath = (Deno.env.get("AGORA_RTMP_CONVERTER_PATH") || "").trim();
  if (!converterPath) {
    throw new Error("egress_unavailable: configure AGORA_RTMP_EGRESS_API_URL or AGORA_RTMP_CONVERTER_PATH");
  }

  const creds = loadAgoraCreds();
  const started = Date.now();
  const result = await callAgora(creds, "POST", converterPath, {
    cname: input.channelName,
    uid: input.uid ? String(input.uid) : undefined,
    rtmpUrl: targetUrl,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.body?.message || result.body?.error || "Agora RTMP egress failed");
  }
  return { id: String(result.body?.sid || result.body?.id || result.body?.taskId || crypto.randomUUID()), raw: result.body, durationMs: Date.now() - started };
}

export async function startRestreamMultistream(
  client: SupabaseClient,
  input: {
    userId: string;
    liveSessionId: string;
    channelIds: unknown;
  },
) {
  const channelIds = normalizeChannelIds(input.channelIds);
  if (!channelIds.length) return { success: true, skipped: true, reason: "no_destinations", destinations: [] };

  const { data: live, error: liveError } = await client
    .from("live_sessions")
    .select("id, user_id, host_user_id, owner_id, status, agora_channel, channel_name, agora_uid, agora_uid_host")
    .eq("id", input.liveSessionId)
    .maybeSingle();
  if (liveError) throw liveError;
  if (!live) throw new Error("Live session not found");
  const ownerId = live.user_id || live.host_user_id || live.owner_id;
  if (ownerId !== input.userId) throw new Error("Only host can start Restream multistream");
  if (String(live.status) !== "live") throw new Error("Live session is not live");

  const { data: channels, error: channelError } = await client
    .from("restream_channels")
    .select("restream_channel_id, platform, display_name, enabled")
    .eq("user_id", input.userId)
    .in("restream_channel_id", channelIds);
  if (channelError) throw channelError;
  const selected = (channels ?? []).filter((channel: any) => channel.enabled !== false);
  if (!selected.length) throw new Error("No connected Restream channels selected");

  const now = new Date().toISOString();
  const rows = selected.map((channel: any) => ({
    live_session_id: input.liveSessionId,
    user_id: input.userId,
    provider: "restream",
    platform: channel.platform || "unknown",
    restream_channel_id: String(channel.restream_channel_id),
    display_name: channel.display_name || channel.platform || "Restream",
    status: "starting",
    signal_status: "inactive",
    updated_at: now,
  }));
  await client.from("live_multistream_destinations").insert(rows);

  const { data: destinationRows } = await client
    .from("live_multistream_destinations")
    .select("id, live_session_id, user_id, platform, restream_channel_id")
    .eq("live_session_id", input.liveSessionId)
    .eq("user_id", input.userId)
    .eq("status", "starting")
    .in("restream_channel_id", selected.map((channel: any) => String(channel.restream_channel_id)));

  const destinations = (destinationRows ?? []) as DestinationRow[];

  try {
    const ingest = await getRestreamIngest(client, input.userId);
    const egress = await createAgoraEgress({
      channelName: String(live.agora_channel || live.channel_name),
      uid: Number(live.agora_uid || live.agora_uid_host || 0) || null,
      rtmpUrl: ingest.rtmpUrl,
      streamKey: ingest.streamKey,
    });
    await logRestreamApi(client, {
      userId: input.userId,
      liveSessionId: input.liveSessionId,
      action: "agora_egress_start",
      method: "POST",
      endpoint: Deno.env.get("AGORA_RTMP_EGRESS_API_URL") || Deno.env.get("AGORA_RTMP_CONVERTER_PATH") || "not_configured",
      success: true,
      durationMs: egress.durationMs,
      details: { egress_id: egress.id },
    });

    const patch = {
      status: "live",
      signal_status: "healthy",
      restream_ingest_id: ingest.ingestId || null,
      restream_ingest_url_encrypted: await encryptSecret(ingest.rtmpUrl, STREAM_SECRET_ENV),
      restream_stream_key_encrypted: await encryptSecret(ingest.streamKey, STREAM_SECRET_ENV),
      agora_egress_id: egress.id,
      started_at: new Date().toISOString(),
      last_signal_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      raw: { restream_server: ingest.server, agora_egress: egress.raw },
    };
    await client.from("live_multistream_destinations").update(patch).in("id", destinations.map((row) => row.id));
    return { success: true, destinations: destinations.map((row) => ({ ...row, status: "live", signal_status: "healthy" })) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restream multistream failed";
    await client.from("live_multistream_destinations").update({
      status: "failed",
      signal_status: "lost",
      last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).in("id", destinations.map((row) => row.id));
    await logRestreamApi(client, {
      userId: input.userId,
      liveSessionId: input.liveSessionId,
      action: "multistream_start_failed",
      success: false,
      errorCode: message.includes("egress_unavailable") ? "egress_unavailable" : "multistream_failed",
      errorMessage: message,
    });
    throw error;
  }
}

export async function stopRestreamMultistream(
  client: SupabaseClient,
  input: { userId?: string | null; liveSessionId: string },
) {
  const { data: rows } = await client
    .from("live_multistream_destinations")
    .select("id, user_id, agora_egress_id, status")
    .eq("live_session_id", input.liveSessionId)
    .in("status", ["pending", "starting", "live", "failed"]);

  const ids = (rows ?? []).map((row: any) => row.id);
  if (!ids.length) return { success: true, stopped: 0 };

  const stopUrl = (Deno.env.get("AGORA_RTMP_EGRESS_STOP_API_URL") || "").trim();
  if (stopUrl) {
    for (const row of rows ?? []) {
      if (!row.agora_egress_id) continue;
      try {
        await fetch(stopUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.agora_egress_id, liveSessionId: input.liveSessionId }),
        });
      } catch {
        // Stop remains best-effort.
      }
    }
  }

  await client.from("live_multistream_destinations").update({
    status: "stopped",
    signal_status: "inactive",
    stopped_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).in("id", ids);
  await logRestreamApi(client, {
    userId: input.userId ?? null,
    liveSessionId: input.liveSessionId,
    action: "multistream_stop",
    method: "POST",
    endpoint: stopUrl || "best_effort_db_only",
    success: true,
    details: { count: ids.length },
  });
  return { success: true, stopped: ids.length };
}
