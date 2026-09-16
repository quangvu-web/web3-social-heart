// Shared helpers for talking to the Agora Cloud Recording REST API
// and normalising the response into a shape the frontend already understands.

export interface AgoraCreds {
  appId: string;
  customerId: string;
  customerSecret: string;
}

export function loadAgoraCreds(): AgoraCreds {
  const appId = Deno.env.get("AGORA_APP_ID") || "";
  const customerId = Deno.env.get("AGORA_CUSTOMER_ID") || "";
  const customerSecret = Deno.env.get("AGORA_CUSTOMER_SECRET") || "";
  if (!appId || !customerId || !customerSecret) {
    throw new Error("Missing AGORA_APP_ID / AGORA_CUSTOMER_ID / AGORA_CUSTOMER_SECRET");
  }
  return { appId, customerId, customerSecret };
}

export function basicAuth(creds: AgoraCreds): string {
  return `Basic ${btoa(`${creds.customerId}:${creds.customerSecret}`)}`;
}

export async function callAgora(
  creds: AgoraCreds,
  method: "GET" | "POST",
  path: string,
  payload?: Record<string, unknown>,
): Promise<{ status: number; body: any; rawText: string }> {
  const url = `https://api.agora.io/v1/apps/${creds.appId}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(creds),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const rawText = await res.text();
  let body: any = {};
  try { body = JSON.parse(rawText); } catch { body = { raw: rawText }; }
  return { status: res.status, body, rawText };
}

export interface RecordingStorageConfig {
  vendor: number;
  region: number;
  bucket: string;
  accessKey: string;
  secretKey: string;
  fileNamePrefix: string[];
  extensionParams?: Record<string, unknown>;
}

export function getStorageConfig(sessionId: string, fileNamePrefix?: string[]): RecordingStorageConfig {
  const accountId = (Deno.env.get("R2_ACCOUNT_ID") || Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "").trim();
  const bucket = (
    Deno.env.get("R2_TEMP_BUCKET") ||
    Deno.env.get("AGORA_STORAGE_BUCKET") ||
    ""
  ).trim();
  const accessKey = (
    Deno.env.get("R2_ACCESS_KEY_ID") ||
    Deno.env.get("AGORA_STORAGE_ACCESS_KEY") ||
    ""
  ).trim();
  const secretKey = (
    Deno.env.get("R2_SECRET_ACCESS_KEY") ||
    Deno.env.get("AGORA_STORAGE_SECRET_KEY") ||
    ""
  ).trim();
  const endpoint = (
    Deno.env.get("R2_ENDPOINT") ||
    Deno.env.get("AGORA_STORAGE_ENDPOINT") ||
    Deno.env.get("CLOUDFLARE_R2_ENDPOINT") ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")
  ).trim();
  const regionRaw = (Deno.env.get("AGORA_STORAGE_REGION") || "0").trim();
  const region = Number.isFinite(Number(regionRaw)) ? Number(regionRaw) : 0;

  if (!bucket || !accessKey || !secretKey) {
    throw new Error("Missing R2_TEMP_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
  }
  if (!endpoint) {
    throw new Error("Missing R2_ACCOUNT_ID or R2_ENDPOINT");
  }

  return {
    // Agora Cloud Recording requires vendor as integer and region as integer.
    // Use vendor=1 (AWS S3) with extensionParams.endpoint to target Cloudflare R2 (S3-compatible).
    vendor: 1,
    region,
    bucket,
    accessKey,
    secretKey,
    fileNamePrefix: fileNamePrefix?.length ? fileNamePrefix : ["funprofile", "live", sessionId],
    extensionParams: { endpoint },
  };
}

// ---- Normalising helpers (ported from worker/src/recording.ts) ----

export type RecordingLifecycleStatus = "ready" | "pending" | "failed";

export interface NormalizedRecording {
  status: RecordingLifecycleStatus;
  uploadingStatus: string | null;
  files: unknown[];
  mediaKey: string | null;
  mediaUrl: string | null;
  message?: string;
  rawAgoraResponse: unknown;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
}

function parseFileList(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      const trimmed = raw.trim();
      return trimmed ? [{ fileName: trimmed }] : [];
    }
  }
  if (typeof raw === "object") {
    const nested = raw as Record<string, unknown>;
    for (const candidate of [nested.fileList, nested.files, nested.file_list]) {
      const parsed = parseFileList(candidate);
      if (parsed.length > 0) return parsed;
    }
  }
  return [];
}

function normalizeStatus(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  return t || null;
}

function extractFileName(file: unknown): string | null {
  if (!file || typeof file !== "object") return null;
  const f = file as any;
  const name = f.fileName || f.filename || f.name || f.objectName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function extractFileStatus(file: unknown): string | null {
  if (!file || typeof file !== "object") return null;
  const f = file as any;
  return normalizeStatus(f.uploadingStatus || f.status);
}

function selectPlayableFileName(files: unknown[]): string | null {
  const names = files.map(extractFileName).filter((n): n is string => !!n);
  if (names.length === 0) return null;
  const lower = names.map((fn) => ({ fn, l: fn.toLowerCase() }));
  return (
    lower.find((e) => e.l.endsWith(".m3u8"))?.fn ||
    lower.find((e) => e.l.endsWith(".mp4"))?.fn ||
    names[0]
  );
}

function buildMediaKey(fileName: string | null, sessionId?: string): string | null {
  if (!fileName) return null;
  const trimmed = fileName.replace(/^\/+/, "");
  if (!trimmed) return null;
  if (trimmed.includes("/")) return trimmed;
  if (sessionId) return `funprofile/live/${sessionId}/${trimmed}`;
  return trimmed;
}

function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

function buildMediaUrl(mediaKey: string | null, base: string): string | null {
  if (!mediaKey || !base) return null;
  try {
    const cleanBase = base.replace(/\/+$/, "");
    const baseUrl = new URL(cleanBase);
    const basePath = baseUrl.pathname.replace(/^\/+|\/+$/g, "");
    let keyPath = mediaKey.replace(/^\/+/, "");
    if (basePath && keyPath.startsWith(`${basePath}/`)) {
      keyPath = keyPath.slice(basePath.length + 1);
    }
    return `${cleanBase}/${encodePath(keyPath)}`;
  } catch {
    return null;
  }
}

function resolveOverallStatus(
  global: string | null,
  files: string[],
): RecordingLifecycleStatus {
  if (global === "uploaded") {
    if (files.length === 0) return "ready";
    return files.every((s) => s === "uploaded") ? "ready" : "pending";
  }
  if (global && global !== "uploaded") return "pending";
  if (files.length === 0) return "pending";
  return files.every((s) => s === "uploaded") ? "ready" : "pending";
}

function getDurationSeconds(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const sr = (body as any).serverResponse as Record<string, unknown> | undefined;
  const ess = sr?.extensionServiceState as Record<string, unknown> | undefined;
  const payload = ess?.payload as Record<string, unknown> | undefined;
  const d = payload?.durationMs;
  return typeof d === "number" ? Math.floor(d / 1000) : null;
}

function getThumbnailUrl(mediaUrl: string | null): string | null {
  if (!mediaUrl) return null;
  const lastDot = mediaUrl.lastIndexOf(".");
  if (lastDot < 0) return null;
  return `${mediaUrl.slice(0, lastDot)}.jpg`;
}

export function normalizeRecordingResult(
  agoraBody: unknown,
  sessionId?: string,
  alreadyGone = false,
): NormalizedRecording {
  const publicBaseUrl =
    Deno.env.get("AGORA_RECORDING_PLAYBACK_BASE_URL") ||
    Deno.env.get("R2_PUBLIC_BASE_URL") ||
    Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL") ||
    "";

  if (alreadyGone) {
    return {
      status: "failed",
      uploadingStatus: null,
      files: [],
      mediaKey: null,
      mediaUrl: null,
      message: "Recorder instance already gone before stop.",
      rawAgoraResponse: agoraBody,
      durationSeconds: null,
      thumbnailUrl: null,
    };
  }

  const root = (agoraBody && typeof agoraBody === "object")
    ? (agoraBody as Record<string, unknown>) : {};
  const serverResponse = (root.serverResponse && typeof root.serverResponse === "object")
    ? (root.serverResponse as Record<string, unknown>) : root;

  const files = parseFileList(serverResponse.fileList ?? root.fileList);
  const globalUploadingStatus = normalizeStatus(
    serverResponse.uploadingStatus ?? root.uploadingStatus ?? (serverResponse as any).upload_status,
  );
  const fileStatuses = files.map(extractFileStatus).filter((s): s is string => !!s);

  const overall = resolveOverallStatus(globalUploadingStatus, fileStatuses);
  const playable = selectPlayableFileName(files);
  const mediaKey = buildMediaKey(playable, sessionId);
  const mediaUrl = overall === "ready" ? buildMediaUrl(mediaKey, publicBaseUrl) : null;
  const durationSeconds = getDurationSeconds(agoraBody);
  const thumbnailUrl = getThumbnailUrl(mediaUrl);

  if (overall === "ready" && !mediaUrl) {
    return {
      status: "pending",
      uploadingStatus: globalUploadingStatus,
      files,
      mediaKey,
      mediaUrl: null,
      message: "Upload marked uploaded but playable file is not available yet.",
      rawAgoraResponse: agoraBody,
      durationSeconds,
      thumbnailUrl: null,
    };
  }

  if (overall === "pending") {
    return {
      status: "pending",
      uploadingStatus: globalUploadingStatus || "backuped",
      files,
      mediaKey,
      mediaUrl: null,
      message: "Upload in progress. Poll query endpoint.",
      rawAgoraResponse: agoraBody,
      durationSeconds,
      thumbnailUrl: null,
    };
  }

  return {
    status: "ready",
    uploadingStatus: "uploaded",
    files,
    mediaKey,
    mediaUrl,
    rawAgoraResponse: agoraBody,
    durationSeconds,
    thumbnailUrl,
  };
}
