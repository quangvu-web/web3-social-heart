import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyMessage as ethersVerifyMessage } from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";
import { createTelegramChallenge } from "../_shared/telegram.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max requests per wallet per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Cryptographic signature verification using ethers.js
function verifySignature(message: string, signature: string, expectedAddress: string): boolean {
  try {
    // Validate signature format (0x + 130 hex chars = 65 bytes)
    const sigRegex = /^0x[a-fA-F0-9]{130}$/;
    if (!sigRegex.test(signature)) {
      return false;
    }

    // Validate address format
    const addressRegex = /^0x[a-fA-F0-9]{40}$/i;
    if (!addressRegex.test(expectedAddress)) {
      return false;
    }

    // Use ethers.js to recover the address from signature
    const recoveredAddress = ethersVerifyMessage(message, signature) as string | undefined;
    
    // Compare addresses (case-insensitive)
    if (!recoveredAddress) return false;
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, signature, message } = await req.json();

    // Validate inputs
    if (!wallet_address || !signature || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'wallet_address, signature, and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAddress = wallet_address.toLowerCase();

    // Rate limiting by wallet address
    if (!checkRateLimit(`web3:${normalizedAddress}`)) {
      console.warn(`[WEB3-AUTH] Rate limit exceeded for: ${normalizedAddress}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Too many requests. Please wait before trying again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[WEB3-AUTH] Auth request for wallet: ${wallet_address}`);

    // Verify signature cryptographically using ethers.js
    if (!verifySignature(message, signature, normalizedAddress)) {
      console.warn('[WEB3-AUTH] Signature verification failed');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[WEB3-AUTH] Signature verified');

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if wallet is blacklisted
    const { data: blacklisted } = await supabase
      .from('blacklisted_wallets')
      .select('id, reason')
      .eq('wallet_address', normalizedAddress)
      .maybeSingle();

    if (blacklisted) {
      console.warn('[WEB3-AUTH] Wallet blacklisted:', blacklisted.reason);
      return new Response(
        JSON.stringify({ success: false, error: 'This wallet has been blacklisted' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user exists with this wallet (check both new and legacy fields)
    let existingProfile = null;
    
    // First check web3_wallet_address (single source of truth)
    const { data: profileByExternal } = await supabase
      .from('profiles')
      .select('id, username, web3_wallet_address, external_wallet_address, custodial_wallet_address')
      .eq('web3_wallet_address', normalizedAddress)
      .maybeSingle();
    
    if (profileByExternal) {
      existingProfile = profileByExternal;
    } else {
      // Fallback: check legacy wallet_address field
      const { data: profileByLegacy } = await supabase
        .from('profiles')
        .select('id, username, wallet_address, external_wallet_address, custodial_wallet_address')
        .eq('wallet_address', normalizedAddress)
        .maybeSingle();
      
      if (profileByLegacy) {
        existingProfile = profileByLegacy;
        // Migrate legacy wallet_address to external_wallet_address
        await supabase
          .from('profiles')
          .update({ 
            web3_wallet_address: normalizedAddress,
            web3_network: 'BSC',
            external_wallet_address: normalizedAddress,
            default_wallet_type: 'external'
          })
          .eq('id', profileByLegacy.id);
        console.log('[WEB3-AUTH] Migrated legacy wallet to external_wallet_address');
      }
    }

    let userId: string;
    let isNewUser = false;
    let userEmail: string = '';

    if (existingProfile) {
      console.log('[WEB3-AUTH] Existing user found:', existingProfile.id);
      userId = existingProfile.id;
      
      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      userEmail = userData?.user?.email || '';
    } else {
      console.log('[WEB3-AUTH] Creating new user');
      isNewUser = true;

      // Generate unique email and username for this wallet user
      const shortAddr = normalizedAddress.slice(2, 10);
      const timestamp = Date.now().toString(36).slice(-4);
      userEmail = `${shortAddr}${timestamp}@wallet.fun.rich`;
      const username = `wallet_${shortAddr}${timestamp}`;

      // Create new user via Supabase Auth
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: userEmail,
        email_confirm: true,
        user_metadata: {
          username: username,
          wallet_address: normalizedAddress,
          registered_from: 'FUN Profile',
          oauth_provider: 'Wallet'
        }
      });

      if (createError) {
        console.error('[WEB3-AUTH] Failed to create user:', createError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;

      // Update profile with external wallet address
      await supabase
        .from('profiles')
        .update({
          web3_wallet_address: normalizedAddress,
          web3_network: 'BSC',
          external_wallet_address: normalizedAddress,
          wallet_address: normalizedAddress, // backward compatible
          default_wallet_type: 'external',
          registered_from: 'FUN Profile',
          oauth_provider: 'Wallet',
          last_login_platform: 'FUN Profile'
        })
        .eq('id', userId);
    }

    // Update last login
    await supabase
      .from('profiles')
      .update({ last_login_platform: 'FUN Profile' })
      .eq('id', userId);

    // If we don't have userEmail, fetch it
    if (!userEmail) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      userEmail = userData?.user?.email || '';
    }

    if (!userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'User email not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const telegramChallenge = await createTelegramChallenge({
      adminClient: supabase,
      userId,
      firstFactor: "wallet",
    });

    if (telegramChallenge.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          requires_telegram_2fa: true,
          challenge_id: telegramChallenge.challengeId,
          user_id: userId,
          is_new_user: isNewUser,
          expires_in_seconds: telegramChallenge.expiresInSeconds,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (telegramChallenge.code !== "not_enabled") {
      return new Response(
        JSON.stringify({ success: false, error: telegramChallenge.error }),
        {
          status: telegramChallenge.code === "rate_limited" ? 429 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (sessionError) {
      console.error('[WEB3-AUTH] Session generation failed:', sessionError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[WEB3-AUTH] Auth successful for:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: isNewUser ? 'Account created and authenticated' : 'Authenticated successfully',
        user_id: userId,
        is_new_user: isNewUser,
        token_hash: sessionData?.properties?.hashed_token
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WEB3-AUTH] Error:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
