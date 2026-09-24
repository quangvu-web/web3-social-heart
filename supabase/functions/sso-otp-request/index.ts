import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Database-backed rate limiting for OTP requests
// SECURITY FIX: Uses persistent rate limiting instead of in-memory (which resets on cold start)
const OTP_RATE_LIMIT = 3; // max 3 OTP requests per hour per identifier
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

async function checkDatabaseRateLimit(supabase: ReturnType<typeof createClient>, identifier: string) {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: `otp_request:${identifier}`,
    p_limit: OTP_RATE_LIMIT,
    p_window_ms: OTP_RATE_WINDOW_MS,
  });
  // A broken limiter must not silently remove the per-user quota.
  if (error || typeof data?.allowed !== 'boolean') return null;
  return data as { allowed: boolean; remaining: number };
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input = await req.json().catch(() => null);
    const identifier = typeof input?.identifier === 'string' ? input.identifier.trim().toLowerCase() : '';
    const type = input?.type ?? 'email';
    if (type !== 'email' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'invalid_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const rateLimit = await checkDatabaseRateLimit(supabase, identifier);
    if (!rateLimit) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'service_unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!rateLimit.allowed) {
      console.warn('[OTP-REQUEST] Rate limit exceeded');
      return new Response(
        JSON.stringify({ success: false, error_code: 'rate_limited', retry_after_seconds: 3600 }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' } }
      );
    }

    // Generate OTP and expiry (5 minutes)
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Delete any existing unused OTP for this identifier
    const { error: deleteError } = await supabase
      .from('otp_codes')
      .delete()
      .eq('identifier', identifier.toLowerCase())
      .eq('is_used', false);

    if (deleteError) {
      console.error('[OTP-REQUEST] Failed to invalidate old OTP', { code: deleteError.code });
      return new Response(
        JSON.stringify({ success: false, error_code: 'service_unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        identifier: identifier.toLowerCase(),
        code: otp,
        type: type,
        expires_at: expiresAt,
        is_used: false,
        attempts: 0,
        max_attempts: 5
      });

    if (insertError) {
      console.error('[OTP-REQUEST] Failed to store OTP', { code: insertError.code });
      return new Response(
        JSON.stringify({ success: false, error_code: 'service_unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: "FUN Profile <noreply@profile.funecosystem.org>",
          to: [identifier],
          subject: "🔐 Mã xác thực OTP của bé - FUN Profile",
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🌟 FUN Profile</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Light Cloak Authentication</p>
              </div>
              
              <div style="padding: 40px 32px;">
                <h2 style="color: #f1f5f9; margin: 0 0 16px 0; font-size: 22px;">Xin chào! 👋</h2>
                <p style="color: #94a3b8; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                  Đây là mã OTP để xác thực tài khoản của bé. Mã này sẽ hết hạn sau <strong style="color: #10b981;">5 phút</strong>.
                </p>
                
                <div style="background: rgba(16, 185, 129, 0.1); border: 2px solid #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #10b981; font-family: 'Courier New', monospace;">
                    ${otp}
                  </span>
                </div>
                
                <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                  <p style="color: #fca5a5; margin: 0; font-size: 14px;">
                    ⚠️ <strong>Bảo mật:</strong> Không chia sẻ mã này với bất kỳ ai. Nhân viên FUN Profile sẽ không bao giờ yêu cầu mã OTP của bé.
                  </p>
                </div>
              </div>
              
              <div style="background: rgba(0,0,0,0.3); padding: 24px 32px; text-align: center;">
                <p style="color: #64748b; margin: 0; font-size: 12px;">
                  Nếu bé không yêu cầu mã này, vui lòng bỏ qua email này.
                </p>
                <p style="color: #475569; margin: 12px 0 0 0; font-size: 11px;">
                  © 2026 FUN Profile. All rights reserved.
                </p>
              </div>
            </div>
          `,
        });

        if (emailError || !emailData?.id) {
          console.error('[OTP-REQUEST] Email provider rejected delivery');
        } else {
          emailSent = true;
          console.log('[OTP-REQUEST] Email provider accepted delivery');
        }
      } catch {
        console.error('[OTP-REQUEST] Email provider request failed');
      }
    } else {
      console.warn('[OTP-REQUEST] RESEND_API_KEY not configured, OTP stored but not sent');
    }
    
    if (!emailSent) {
      // Keep the rate-limit charge, but never leave an undelivered code usable.
      const { error: invalidateError } = await supabase.from('otp_codes')
        .update({ is_used: true }).eq('identifier', identifier).eq('code', otp).eq('is_used', false);
      if (invalidateError) console.error('[OTP-REQUEST] Failed to invalidate undelivered OTP', { code: invalidateError.code });
      return new Response(
        JSON.stringify({ success: false, email_sent: false, error_code: 'email_delivery_failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP email accepted for delivery',
        email_sent: emailSent,
        expires_in_seconds: 300
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch {
    console.error('[OTP-REQUEST] Request failed');
    return new Response(
      JSON.stringify({ success: false, error_code: 'service_unavailable' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
