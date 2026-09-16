import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Database-backed rate limiting for OTP requests
// SECURITY FIX: Uses persistent rate limiting instead of in-memory (which resets on cold start)
const OTP_RATE_LIMIT = 3; // max 3 OTP requests per hour per identifier
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

async function checkDatabaseRateLimit(supabase: any, identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const rateLimitKey = `otp_request:${identifier.toLowerCase()}`;
  
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: rateLimitKey,
      p_limit: OTP_RATE_LIMIT,
      p_window_ms: OTP_RATE_WINDOW_MS
    });
    
    if (error) {
      console.error('[OTP-REQUEST] Rate limit check failed:', error);
      // Fail open but log - don't block legitimate users due to DB issues
      return { allowed: true, remaining: OTP_RATE_LIMIT };
    }
    
    return { 
      allowed: data?.allowed ?? true, 
      remaining: data?.remaining ?? OTP_RATE_LIMIT 
    };
  } catch (err) {
    console.error('[OTP-REQUEST] Rate limit exception:', err);
    return { allowed: true, remaining: OTP_RATE_LIMIT };
  }
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
    const { identifier, type = 'email' } = await req.json();

    // Create Supabase client with service role (needed for rate limiting)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Database-backed rate limiting - SECURITY FIX
    if (identifier) {
      const rateLimit = await checkDatabaseRateLimit(supabase, identifier);
      if (!rateLimit.allowed) {
        console.warn(`[OTP-REQUEST] Rate limit exceeded for: ${identifier}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Too many OTP requests. Please wait before trying again (max 3 per hour).',
            retry_after_seconds: 3600
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[OTP-REQUEST] Processing request for: ${identifier}, type: ${type}`);

    if (!identifier) {
      return new Response(
        JSON.stringify({ success: false, error: 'Identifier is required (email or phone)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid email format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Supabase client already created above for rate limiting

    // Generate OTP and expiry (5 minutes)
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Delete any existing unused OTP for this identifier
    await supabase
      .from('otp_codes')
      .delete()
      .eq('identifier', identifier.toLowerCase())
      .eq('is_used', false);

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
      console.error('[OTP-REQUEST] Failed to store OTP:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const { error: emailError } = await resend.emails.send({
          from: "FUN Ecosystem <noreply@profile.funecosystem.org>",
          to: [identifier],
          subject: "🔐 Mã xác thực OTP của bạn - FUN Ecosystem",
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🌟 FUN Ecosystem</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Light Cloak Authentication</p>
              </div>
              
              <div style="padding: 40px 32px;">
                <h2 style="color: #f1f5f9; margin: 0 0 16px 0; font-size: 22px;">Xin chào! 👋</h2>
                <p style="color: #94a3b8; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                  Đây là mã OTP để xác thực tài khoản của bạn. Mã này sẽ hết hạn sau <strong style="color: #10b981;">5 phút</strong>.
                </p>
                
                <div style="background: rgba(16, 185, 129, 0.1); border: 2px solid #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #10b981; font-family: 'Courier New', monospace;">
                    ${otp}
                  </span>
                </div>
                
                <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                  <p style="color: #fca5a5; margin: 0; font-size: 14px;">
                    ⚠️ <strong>Bảo mật:</strong> Không chia sẻ mã này với bất kỳ ai. Nhân viên FUN Ecosystem sẽ không bao giờ yêu cầu mã OTP của bạn.
                  </p>
                </div>
              </div>
              
              <div style="background: rgba(0,0,0,0.3); padding: 24px 32px; text-align: center;">
                <p style="color: #64748b; margin: 0; font-size: 12px;">
                  Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.
                </p>
                <p style="color: #475569; margin: 12px 0 0 0; font-size: 11px;">
                  © 2026 FUN Ecosystem. All rights reserved.
                </p>
              </div>
            </div>
          `,
        });

        if (emailError) {
          console.error('[OTP-REQUEST] Resend email error:', emailError);
        } else {
          emailSent = true;
          console.log(`[OTP-REQUEST] OTP email sent successfully to ${identifier}`);
        }
      } catch (emailErr) {
        console.error('[OTP-REQUEST] Failed to send email via Resend:', emailErr);
      }
    } else {
      console.warn('[OTP-REQUEST] RESEND_API_KEY not configured, OTP stored but not sent');
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent ? `OTP sent to ${identifier}` : 'OTP generated (email delivery pending)',
        email_sent: emailSent,
        expires_in_seconds: 300
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[OTP-REQUEST] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
