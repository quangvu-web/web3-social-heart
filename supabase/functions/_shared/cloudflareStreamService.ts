type CloudflareEnv = {
  accountId: string;
  token: string;
  customerCode: string;
};

export type CloudflareLiveInputStatus =
  | string
  | null
  | {
      current?: { state?: string; reason?: string; statusEnteredAt?: string };
      history?: Array<{ state?: string; reason?: string }>;
    };

export type CloudflareLiveInput = {
  uid: string;
  enabled?: boolean;
  status?: CloudflareLiveInputStatus;
  rtmps?: {
    url?: string;
    streamKey?: string;
  };
  recording?: {
    mode?: string;
  };
  playback?: {
    hls?: string;
    dash?: string;
  };
  webRTCPlayback?: {
    url?: string;
  };
};

export function getCloudflareStreamEnv(): CloudflareEnv {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const token =
    Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
    Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
    Deno.env.get("CLOUDFLARE_API_TOKEN") ??
    "";
  const customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "";
  if (!accountId || !token) throw new Error("Missing Cloudflare Stream configuration");
  return { accountId, token, customerCode };
}

export function buildStreamPlaybackUrls(uid: string, customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "") {
  const base = customerCode
    ? `https://customer-${customerCode}.cloudflarestream.com/${uid}`
    : `https://videodelivery.net/${uid}`;
  return {
    hls: `${base}/manifest/video.m3u8`,
    dash: `${base}/manifest/video.mpd`,
    mp4: `${base}/downloads/default.mp4`,
    thumbnail: `${base}/thumbnails/thumbnail.jpg?time=3s`,
  };
}

async function streamApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const env = getCloudflareStreamEnv();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/stream${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const detail =
      payload?.errors?.map((item: { message?: string }) => item.message).filter(Boolean).join("; ") ||
      payload?.error ||
      `HTTP ${response.status}`;
    throw new Error(`Cloudflare Stream API failed: ${detail}`);
  }
  return payload?.result as T;
}

export async function createLiveInput(input: {
  liveSessionId: string;
  userId: string;
  title: string;
  description?: string;
}): Promise<CloudflareLiveInput> {
  const result = await streamApi<CloudflareLiveInput>("/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: {
        live_session_id: input.liveSessionId,
        user_id: input.userId,
        title: input.title,
        description: input.description ?? "",
        source: "funprofile_obs_rtmp",
      },
      recording: {
        mode: "automatic",
        requireSignedURLs: false,
      },
    }),
  });

  if (!result?.uid || !result.rtmps?.url || !result.rtmps?.streamKey) {
    throw new Error("Cloudflare Live Input response missing RTMPS credentials");
  }

  return result;
}

export async function getLiveInput(inputId: string): Promise<CloudflareLiveInput> {
  return streamApi<CloudflareLiveInput>(`/live_inputs/${inputId}`, { method: "GET" });
}

export async function updateLiveInput(inputId: string, body: Record<string, unknown>): Promise<CloudflareLiveInput> {
  return streamApi<CloudflareLiveInput>(`/live_inputs/${inputId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function enableLiveInput(inputId: string): Promise<void> {
  await updateLiveInput(inputId, { enabled: true });
}

export async function disableLiveInput(inputId: string): Promise<void> {
  await updateLiveInput(inputId, { enabled: false });
}

export type CloudflareLiveInputVideo = {
  uid: string;
  status?: { state?: string; pctComplete?: string } | string | null;
  duration?: number;
  created?: string;
  modified?: string;
  readyToStream?: boolean;
};

export function cloudflareStatusText(status: unknown) {
  if (!status) return "";
  if (typeof status === "string") return status.toLowerCase();
  if (typeof status === "object") {
    const record = status as Record<string, unknown>;
    const current = record.current;
    if (current && typeof current === "object") {
      const state = (current as Record<string, unknown>).state;
      if (typeof state === "string") return state.toLowerCase();
    }
    const state = record.state;
    if (typeof state === "string") return state.toLowerCase();
  }
  return "";
}

export function isLiveInputConnected(status: unknown) {
  const state = cloudflareStatusText(status);
  return ["connected", "reconnected", "live", "live-inprogress", "inprogress"].includes(state) || state.includes("live");
}

export function isLiveInputDisconnected(status: unknown) {
  const state = cloudflareStatusText(status);
  return ["disconnected", "idle", "ended", "stopped", "disabled"].includes(state);
}

export function isLiveInputStatusKnown(status: unknown) {
  return cloudflareStatusText(status).length > 0;
}

export function isCloudflareVideoLive(video: CloudflareLiveInputVideo) {
  const state = cloudflareStatusText(video.status);
  return state.includes("live") || state.includes("inprogress") || state === "queued";
}

/**
 * List recorded videos attached to a Cloudflare Stream Live Input,
 * sorted newest first by created timestamp.
 */
export async function listLiveInputVideos(inputId: string): Promise<CloudflareLiveInputVideo[]> {
  const result = await streamApi<CloudflareLiveInputVideo[]>(`/live_inputs/${inputId}/videos`, {
    method: "GET",
  });
  if (!Array.isArray(result)) return [];
  return [...result].sort((a, b) => {
    const ta = a.created ? Date.parse(a.created) : 0;
    const tb = b.created ? Date.parse(b.created) : 0;
    return tb - ta;
  });
}

/**
 * Try to resolve the most recent recorded video UID for a Live Input.
 * Returns null if Cloudflare has not produced a video yet.
 */
export async function resolveLatestVideoUidForLiveInput(inputId: string): Promise<string | null> {
  try {
    const videos = await listLiveInputVideos(inputId);
    return videos[0]?.uid ?? null;
  } catch (err) {
    console.warn("[cloudflareStreamService] resolveLatestVideoUidForLiveInput failed", err);
    return null;
  }
}

