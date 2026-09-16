// Shared helper: generate Agora RTC tokens directly in Edge Functions.
// Uses the official `agora-token` npm package (same version as the legacy Cloudflare Worker).
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@2.0.3";

export type AgoraRole = "host" | "audience" | "recorder" | "publisher" | "subscriber";

export interface BuildRtcTokenInput {
  appId: string;
  appCertificate: string;
  channel: string;
  uid: string | number;
  role: AgoraRole;
  expireSeconds?: number;
}

export interface BuildRtcTokenResult {
  token: string;
  expireAt: number;
  uid: string;
}

function mapRole(role: AgoraRole): number {
  if (role === "audience" || role === "subscriber") return RtcRole.SUBSCRIBER;
  return RtcRole.PUBLISHER; // host / recorder / publisher
}

export function buildRtcToken(input: BuildRtcTokenInput): BuildRtcTokenResult {
  const { appId, appCertificate, channel, uid, role } = input;
  if (!appId || !appCertificate) {
    throw new Error("AGORA_APP_ID / AGORA_APP_CERTIFICATE missing");
  }
  if (!channel) throw new Error("channel is required");
  if (uid === undefined || uid === null || String(uid).length === 0) {
    throw new Error("uid is required");
  }

  const expireSeconds = Math.max(60, Math.min(input.expireSeconds || 3600, 24 * 60 * 60));
  const expireAt = Math.floor(Date.now() / 1000) + expireSeconds;
  const agoraRole = mapRole(role);
  const uidString = String(uid);

  // If uid is a pure positive integer, use numeric uid token (better cross-SDK compatibility).
  const numericUid = /^\d+$/.test(uidString) ? Number(uidString) : null;
  const token = numericUid !== null && numericUid <= 0xFFFFFFFF
    ? RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channel,
        numericUid,
        agoraRole,
        expireSeconds,
        expireSeconds,
      )
    : RtcTokenBuilder.buildTokenWithUserAccount(
        appId,
        appCertificate,
        channel,
        uidString,
        agoraRole,
        expireSeconds,
        expireSeconds,
      );

  return { token, expireAt, uid: uidString };
}
