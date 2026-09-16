import {
  corsHeaders,
  getClients,
  jsonResponse,
  requireUserFull,
  sha256Hex,
} from "../_shared/walletAuth.ts";

type EmailLinkVerifyRequest = {
  email: string;
  otp: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
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
    const body = (await req.json()) as EmailLinkVerifyRequest;

    const email = normalizeEmail(body?.email ?? "");
    const otp = String(body?.otp ?? "").trim();

    if (!isValidEmail(email)) {
      return jsonResponse({ error: "Invalid email format" }, 400);
    }

    if (!/^\d{6}$/.test(otp)) {
      return jsonResponse({ error: "Invalid OTP format" }, 400);
    }

    const nowIso = new Date().toISOString();
    const { data: otpRow, error: otpQueryError } = await adminClient
      .from("email_link_otps")
      .select("id, otp_hash, expires_at, used_at, created_at")
      .eq("user_id", userId)
      .eq("email", email)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpQueryError) {
      console.error("[email-link-verify] otp query failed", otpQueryError);
      return jsonResponse({ error: "Failed to validate OTP" }, 500);
    }

    if (!otpRow) {
      return jsonResponse({ error: "OTP is invalid, expired, or already used" }, 400);
    }

    const hashSecret = Deno.env.get("EMAIL_OTP_HASH_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!hashSecret) {
      return jsonResponse({ error: "Server OTP hash secret is not configured" }, 500);
    }

    const expectedHash = await sha256Hex(`${userId}:${email}:${otp}:${hashSecret}`);
    if (!timingSafeEqual(expectedHash, otpRow.otp_hash)) {
      return jsonResponse({ error: "Invalid OTP" }, 400);
    }

    // Check if email belongs to another account
    const { data: conflictUserId, error: conflictError } = await adminClient.rpc("find_user_id_by_email", {
      p_email: email,
    });

    if (conflictError) {
      console.error("[email-link-verify] find_user_id_by_email failed", conflictError);
      return jsonResponse({ error: "Unable to validate email ownership" }, 500);
    }

    if (conflictUserId && conflictUserId !== userId) {
      // Check if the conflicting account is a wallet-placeholder
      const { data: conflictUser } = await adminClient.auth.admin.getUserById(conflictUserId);
      const conflictEmail = conflictUser?.user?.email ?? "";
      const isPlaceholder = conflictEmail.endsWith("@wallet.fun.local");

      if (!isPlaceholder) {
        // Real account - user should log in with that account and link wallet from Settings
        return jsonResponse({
          error: "This email is already linked to an existing account. Please log in with that account and connect your wallet from Settings.",
          code: "EMAIL_CONFLICT",
        }, 409);
      }

      // Conflicting account is also a wallet-placeholder → reassign its email
      const placeholderEmail = `wallet+merged_${conflictUserId.substring(0, 8)}_${Date.now()}@wallet.fun.local`;
      await adminClient.auth.admin.updateUserById(conflictUserId, { email: placeholderEmail });
    }

    const { error: markUsedError } = await adminClient
      .from("email_link_otps")
      .update({ used_at: nowIso })
      .eq("id", otpRow.id);

    if (markUsedError) {
      console.error("[email-link-verify] mark otp used failed", markUsedError);
      return jsonResponse({ error: "Failed to consume OTP" }, 500);
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });

    if (authUpdateError) {
      console.error("[email-link-verify] auth update user email failed", authUpdateError);
      return jsonResponse({ error: authUpdateError.message || "Failed to update account email" }, 500);
    }

    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({
        email_claimed: email,
        email_verified_at: nowIso,
        trust_level: 1,
      })
      .eq("id", userId);

    if (profileUpdateError) {
      console.error("[email-link-verify] profile update failed", profileUpdateError);
      return jsonResponse({ error: "Failed to update profile verification state" }, 500);
    }

    return jsonResponse({ ok: true, trust_level: 1 });
  } catch (error) {
    console.error("[email-link-verify] unhandled error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
