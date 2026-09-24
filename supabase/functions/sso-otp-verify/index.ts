import { createClient } from "npm:@supabase/supabase-js@2";
import { createTelegramChallenge } from "../_shared/telegram.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input = await req.json().catch(() => null);
    const identifier = typeof input?.identifier === 'string' ? input.identifier.trim().toLowerCase() : '';
    const code = input?.code;

    if (!identifier || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Identifier and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const verifyRateLimit = await supabase.rpc('check_rate_limit', {
      p_key: `otp_verify:${identifier}`,
      p_limit: 10,
      p_window_ms: 3600000,
    });
    if (verifyRateLimit.error || typeof verifyRateLimit.data?.allowed !== 'boolean') {
      console.error('[OTP-VERIFY] Rate limit check failed');
      return new Response(
        JSON.stringify({ success: false, error_code: 'service_unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!verifyRateLimit.data.allowed) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'rate_limited' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find valid OTP
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('identifier', identifier.toLowerCase())
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[OTP-VERIFY] OTP lookup failed', { code: fetchError.code });
      return new Response(
        JSON.stringify({ success: false, error_code: 'service_unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!otpRecord) {
      console.warn('[OTP-VERIFY] No valid OTP found');
      return new Response(
        JSON.stringify({ success: false, error: 'OTP expired or not found. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      const { error: lockError } = await supabase
        .from('otp_codes')
        .update({ is_used: true })
        .eq('id', otpRecord.id);
      if (lockError) {
        console.error('[OTP-VERIFY] Failed to lock exhausted OTP', { code: lockError.code });
        return new Response(
          JSON.stringify({ success: false, error_code: 'service_unavailable' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Too many failed attempts. Please request a new OTP.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify OTP
    if (otpRecord.code !== code) {
      const { error: attemptError } = await supabase
        .from('otp_codes')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);
      if (attemptError) {
        console.error('[OTP-VERIFY] Failed to record OTP attempt', { code: attemptError.code });
        return new Response(
          JSON.stringify({ success: false, error_code: 'service_unavailable' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid OTP code',
          attempts_remaining: otpRecord.max_attempts - otpRecord.attempts - 1
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[OTP-VERIFY] OTP verified successfully');

    // Mark OTP as used
    const { data: consumedOtpId, error: consumeError } = await supabase.rpc('consume_otp_code', {
      p_otp_id: otpRecord.id,
      p_identifier: identifier,
      p_code: code,
    });
    if (consumeError) {
      console.error('[OTP-VERIFY] Failed to consume OTP', { code: consumeError.code });
      return new Response(
        JSON.stringify({ success: false, error_code: 'service_unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!consumedOtpId) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'otp_expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine user email
    const userEmail = otpRecord.type === 'email' 
      ? identifier.toLowerCase() 
      : `${identifier.replace(/[^0-9]/g, '')}@phone.local`;

    // Find user by email using RPC (bypasses listUsers bug with NULL email_change)
    const findUserByEmail = async (email: string) => {
      const target = email.toLowerCase();
      
      // Use database function to find user ID directly (safe SQL query, no NULL scan bug)
      const { data: userId, error: rpcError } = await supabase.rpc('find_user_id_by_email', {
        p_email: target
      });

      if (rpcError) {
        console.error('[OTP-VERIFY] RPC find_user_id_by_email error:', rpcError);
        throw rpcError;
      }

      if (userId) {
        // Get full user object by ID (single user lookup, no bug)
        const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
        if (getUserError) {
          console.error('[OTP-VERIFY] getUserById error:', getUserError);
          throw getUserError;
        }
        return userData?.user || null;
      }

      return null;
    };

    // Generate cryptographically secure username
    const generateSecureUsername = (identifier: string): string => {
      let baseUsername = identifier.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      
      if (baseUsername.length < 3) {
        baseUsername = 'user' + baseUsername;
      }
      
      if (baseUsername.length > 20) {
        baseUsername = baseUsername.substring(0, 20);
      }
      
      const randomBytes = new Uint8Array(4);
      crypto.getRandomValues(randomBytes);
      const randomSuffix = Array.from(randomBytes)
        .map(b => b.toString(36))
        .join('')
        .substring(0, 6);
      
      const username = `${baseUsername}${randomSuffix}`;
      
      if (username.length < 5 || username.length > 30 || !/^[a-z0-9]+$/.test(username)) {
        const fallbackBytes = new Uint8Array(8);
        crypto.getRandomValues(fallbackBytes);
        return 'user' + Array.from(fallbackBytes).map(b => b.toString(36)).join('').substring(0, 12);
      }
      
      return username;
    };

    // Check if user exists
    let user = await findUserByEmail(userEmail);
    let isNewUser = false;

    if (!user) {
      console.log('[OTP-VERIFY] Creating new user for:', userEmail);
      isNewUser = true;
      
      const username = generateSecureUsername(identifier);

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: userEmail,
        email_confirm: true,
        user_metadata: {
          username: username,
          registered_from: 'FUN Profile',
          oauth_provider: 'Email OTP',
          identifier: identifier.toLowerCase()
        }
      });

      if (createError) {
        if (
          createError.message?.includes('already been registered') ||
          (createError as unknown as { code?: string }).code === 'email_exists'
        ) {
          console.log('[OTP-VERIFY] User already exists (race condition), fetching...');
          user = await findUserByEmail(userEmail);
          if (!user) {
            return new Response(
              JSON.stringify({ success: false, error: 'User exists but could not be retrieved' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          console.error('[OTP-VERIFY] Failed to create user:', createError);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to create user account' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        user = newUser.user;
      }
    }

    // Ensure profile exists and update login info
    if (user) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingProfile) {
        console.log('[OTP-VERIFY] Profile not found, creating fallback profile for:', user.id);
        const fallbackUsername = identifier.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + '_' + user.id.substring(0, 6);
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: fallbackUsername,
            registered_from: 'FUN Profile',
            oauth_provider: 'Email OTP',
          });

        if (profileError) {
          console.warn('[OTP-VERIFY] Profile creation warning:', profileError);
        }
      } else {
        const updateData: Record<string, string> = { last_login_platform: 'FUN Profile' };
        if (isNewUser) {
          updateData.oauth_provider = 'Email OTP';
          updateData.registered_from = 'FUN Profile';
        }
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id);
      }
    }

    const telegramChallenge = await createTelegramChallenge({
      adminClient: supabase,
      userId: user.id,
      firstFactor: "email_otp",
    });

    if (telegramChallenge.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          requires_telegram_2fa: true,
          challenge_id: telegramChallenge.challengeId,
          user_id: user.id,
          is_new_user: isNewUser,
          expires_in_seconds: telegramChallenge.expiresInSeconds,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (telegramChallenge.code !== "not_enabled") {
      return new Response(
        JSON.stringify({ success: false, error_code: telegramChallenge.code === 'rate_limited' ? 'rate_limited' : 'service_unavailable' }),
        {
          status: telegramChallenge.code === "rate_limited" ? 429 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate session directly using admin API
    console.log('[OTP-VERIFY] Creating session for user:', user?.id);
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (linkError || !linkData) {
      console.error('[OTP-VERIFY] Failed to generate link:', linkError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const magicLinkUrl = new URL(linkData.properties?.action_link || '');
    const token_hash = magicLinkUrl.searchParams.get('token');
    const type = magicLinkUrl.searchParams.get('type') as 'magiclink';

    if (!token_hash) {
      console.error('[OTP-VERIFY] No token in magic link');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to extract session token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type || 'magiclink',
    });

    if (sessionError || !sessionData.session) {
      console.error('[OTP-VERIFY] Failed to verify token:', sessionError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[OTP-VERIFY] Session created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP verified successfully',
        user_id: user?.id,
        is_new_user: isNewUser,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch {
    console.error('[OTP-VERIFY] Verification failed');
    return new Response(
      JSON.stringify({ success: false, error_code: 'service_unavailable' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
