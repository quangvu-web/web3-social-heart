import { Resend } from "https://esm.sh/resend@2.0.0";
import {
  corsHeaders,
  getClients,
  jsonResponse,
  requireUserFull,
  sha256Hex,
} from "../_shared/walletAuth.ts";

type EmailLinkStartRequest = {
  email: string;
};

const OTP_TTL_SECONDS = 5 * 60;
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireUserFull(req);
  if ("error" in auth) {
    return auth.error;
  }

  const { userId } = auth;

  try {
    const { adminClient } = getClients(req);
    const body = (await req.json()) as EmailLinkStartRequest;

    const email = normalizeEmail(body?.email ?? "");
    if (!isValidEmail(email)) {
      return jsonResponse({ error: "Invalid email format" }, 400);
    }

    if (email.endsWith("@wallet.fun.local")) {
      return jsonResponse({ error: "Please use a real email address" }, 400);
    }

    const ipRaw = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
    const ipHash = await sha256Hex(ipRaw.split(",")[0]?.trim() ?? "0.0.0.0");

    const rateKey = `email_link_start:${userId}:${ipHash}`;
    const { data: rateLimitData, error: rateLimitError } = await adminClient.rpc("check_rate_limit", {
      p_key: rateKey,
      p_limit: RATE_LIMIT,
      p_window_ms: RATE_WINDOW_MS,
    });

    if (rateLimitError) {
      console.error("[email-link-start] rate-limit check failed", rateLimitError);
    }

    if (rateLimitData && !rateLimitData.allowed) {
      return jsonResponse({ error: "Too many OTP requests. Please try later." }, 429);
    }

    const otp = generateOtp();
    const hashSecret = Deno.env.get("EMAIL_OTP_HASH_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!hashSecret) {
      return jsonResponse({ error: "Server OTP hash secret is not configured" }, 500);
    }

    const otpHash = await sha256Hex(`${userId}:${email}:${otp}:${hashSecret}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    await adminClient
      .from("email_link_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("email", email)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString());

    const { error: insertError } = await adminClient.from("email_link_otps").insert({
      user_id: userId,
      email,
      otp_hash: otpHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("[email-link-start] otp insert failed", insertError);
      return jsonResponse({ error: "Failed to create email verification OTP" }, 500);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return jsonResponse({ error: "RESEND_API_KEY is not configured" }, 500);
    }

    const resend = new Resend(resendApiKey);
    const { error: sendError } = await resend.emails.send({
      from: "FUN Profile <noreply@funprofile.funecosystem.org>",
      to: [email],
      subject: "Your FUN Profile email verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto;">
          <h2>Verify your email</h2>
          <p>Use this OTP to verify your email and unlock full features:</p>
          <div style="font-size: 36px; letter-spacing: 8px; font-weight: 700; color: #16a34a;">${otp}</div>
          <p>This OTP expires in 5 minutes.</p>
        </div>
      `,
    });

    if (sendError) {
      console.error("[email-link-start] resend send failed", sendError);
      return jsonResponse({ error: "Failed to send OTP email" }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("[email-link-start] unhandled error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
