import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CAMLY_CONTRACT = '0x0910320181889feFDE0BB1Ca63962b0A8882e413';
const MINIMUM_STAKE = 1000; // 1000 CAMLY minimum
const CAMLY_DECIMALS = 3;

// Minimal ERC20 balanceOf ABI
const BALANCE_OF_SELECTOR = '0x70a08231';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Get wallet address from profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', userId)
      .single();

    if (!profile?.wallet_address) {
      // No wallet = doesn't meet requirement
      await supabaseAdmin.from('user_stake_status').upsert({
        user_id: userId,
        wallet_address: null,
        fun_balance: 0,
        meets_requirement: false,
        last_checked_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      return new Response(JSON.stringify({
        meets_requirement: false,
        balance: 0,
        message: 'Chưa kết nối ví',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Call BSC RPC to check CAMLY balance
    const walletAddr = profile.wallet_address.toLowerCase().replace('0x', '');
    const callData = BALANCE_OF_SELECTOR + walletAddr.padStart(64, '0');

    const rpcUrl = 'https://bsc-dataseed1.binance.org';
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: CAMLY_CONTRACT, data: callData }, 'latest'],
      }),
    });

    const rpcResult = await rpcResponse.json();
    const rawBalance = BigInt(rpcResult.result || '0x0');
    const balance = Number(rawBalance) / Math.pow(10, CAMLY_DECIMALS);
    const meetsRequirement = balance >= MINIMUM_STAKE;

    // Update user_stake_status
    await supabaseAdmin.from('user_stake_status').upsert({
      user_id: userId,
      wallet_address: profile.wallet_address,
      fun_balance: Math.floor(balance),
      meets_requirement: meetsRequirement,
      last_checked_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    console.log(`[check-stake] User ${userId}: balance=${balance}, meets=${meetsRequirement}`);

    return new Response(JSON.stringify({
      meets_requirement: meetsRequirement,
      balance: Math.floor(balance),
      minimum_required: MINIMUM_STAKE,
      wallet_address: profile.wallet_address,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[check-stake] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
