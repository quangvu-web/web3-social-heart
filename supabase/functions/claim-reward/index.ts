import { createClient } from "npm:@supabase/supabase-js@2.79.0";
import { createWalletClient, http, parseUnits, encodeFunctionData, createPublicClient } from "npm:viem@2.38.6";
import { privateKeyToAccount } from "npm:viem@2.38.6/accounts";
import { bsc } from "npm:viem@2.38.6/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// CAMLY Token config - 3 decimals
const CAMLY_CONTRACT = '0x0910320181889feFDE0BB1Ca63962b0A8882e413';
const CAMLY_DECIMALS = 3;
const MINIMUM_CLAIM = 1; // Tối thiểu 1 CAMLY (không giới hạn)

// ERC20 Transfer ABI
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Token không hợp lệ' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Initialize Supabase client with user token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Verify JWT and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('JWT verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Phiên đăng nhập hết hạn' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Claim request from user: ${userId}`);

    // 4. Parse request body
    const { wallet_address, amount } = await req.json();
    
    if (!wallet_address || !amount) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Thiếu thông tin ví hoặc số lượng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claimAmount = Number(amount);
    if (isNaN(claimAmount) || claimAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Số lượng không hợp lệ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Địa chỉ ví không hợp lệ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Check rate limit (1 claim per minute per user)
    const { data: rateLimit } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: `claim_reward:${userId}`,
      p_limit: 1,
      p_window_ms: 60000,
    });

    if (rateLimit && !rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate Limited', 
          message: `Vui lòng chờ ${Math.ceil((60000 - (Date.now() % 60000)) / 1000)} giây` 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Anti-Sybil checks — run trust, stake, profile in parallel
    const [trustResult, stakeResult, profileResult] = await Promise.all([
      supabaseAdmin
        .from('user_trust')
        .select('trust_score, is_flagged, flag_reason')
        .eq('user_id', userId)
        .single(),
      supabaseAdmin
        .from('user_stake_status')
        .select('meets_requirement, fun_balance')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('profiles')
        .select('reward_status, username, trust_level')
        .eq('id', userId)
        .single(),
    ]);

    const trustData = trustResult.data;
    const stakeStatus = stakeResult.data;
    const profile = profileResult.data;
    const profileError = profileResult.error;

    // 7a. Check trust
    if (trustData?.is_flagged) {
      console.log(`[claim-reward] User ${userId} is flagged: ${trustData.flag_reason}`);
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Tài khoản đang bị xem xét. Vui lòng liên hệ Admin.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trustData && trustData.trust_score < 20) {
      console.log(`[claim-reward] User ${userId} trust too low: ${trustData.trust_score}`);
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Tài khoản cần xác minh trước khi claim. Trust score quá thấp.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7b. Check stake
    if (stakeStatus && !stakeStatus.meets_requirement) {
      console.log(`[claim-reward] User ${userId} doesn't meet stake requirement: ${stakeStatus.fun_balance} CAMLY`);
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Cần nắm giữ tối thiểu 1,000 CAMLY để claim reward.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7c. Check profile
    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Not Found', message: 'Không tìm thấy hồ sơ người dùng' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((profile.trust_level ?? 0) < 1) {
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Vui lòng xác minh email để mở khóa claim reward.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.reward_status !== 'approved') {
      const statusMessages: Record<string, string> = {
        pending: 'Phần thưởng đang chờ Admin duyệt',
        on_hold: 'Phần thưởng đang bị treo. Vui lòng liên hệ Admin.',
        rejected: 'Phần thưởng đã bị từ chối. Vui lòng liên hệ Admin.',
      };
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden', 
          message: statusMessages[profile.reward_status] || 'Phần thưởng chưa được duyệt' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Calculate claimable amount using RPC function
    const { data: rewardsData, error: rewardsError } = await supabase.rpc('get_user_rewards_v2', {
      limit_count: 10000,
    });

    if (rewardsError) {
      console.error('Rewards RPC error:', rewardsError);
      return new Response(
        JSON.stringify({ error: 'Internal Error', message: 'Lỗi tính toán phần thưởng' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userReward = rewardsData?.find((r: any) => r.id === userId);
    const totalReward = Number(userReward?.total_reward) || 0;

    // Get already claimed amount
    const { data: claims } = await supabase
      .from('reward_claims')
      .select('amount')
      .eq('user_id', userId);

    const claimedAmount = claims?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
    const claimableAmount = Math.max(0, totalReward - claimedAmount);

    console.log(`User ${userId}: total=${totalReward}, claimed=${claimedAmount}, claimable=${claimableAmount}, requested=${claimAmount}`);

    // 9. Validate claim amount
    if (claimAmount < MINIMUM_CLAIM) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad Request', 
          message: 'Số tiền phải lớn hơn 0 CAMLY' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (claimAmount > claimableAmount) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad Request', 
          message: `Số tiền vượt quá số dư khả dụng (${claimableAmount.toLocaleString()} CAMLY)` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Get Treasury wallet credentials
    const treasuryAddress = Deno.env.get('TREASURY_WALLET_ADDRESS');
    const treasuryPrivateKey = Deno.env.get('TREASURY_PRIVATE_KEY');

    if (!treasuryAddress || !treasuryPrivateKey) {
      console.error('Treasury wallet not configured');
      return new Response(
        JSON.stringify({ error: 'Server Error', message: 'Hệ thống chưa được cấu hình đầy đủ' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 11. Create viem clients
    const account = privateKeyToAccount(treasuryPrivateKey as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain: bsc,
      transport: http('https://bsc-dataseed1.binance.org'),
    });

    const walletClient = createWalletClient({
      account,
      chain: bsc,
      transport: http('https://bsc-dataseed1.binance.org'),
    });

    // 12. Check Treasury CAMLY balance
    const treasuryBalance = await publicClient.readContract({
      address: CAMLY_CONTRACT as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [treasuryAddress as `0x${string}`],
    });

    const requiredAmount = parseUnits(claimAmount.toString(), CAMLY_DECIMALS);
    
    if (treasuryBalance < requiredAmount) {
      console.error(`Treasury insufficient: has ${treasuryBalance}, needs ${requiredAmount}`);
      return new Response(
        JSON.stringify({ 
          error: 'Service Unavailable', 
          message: 'Treasury không đủ token, vui lòng liên hệ Admin' 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13. Send CAMLY transfer transaction
    console.log(`Sending ${claimAmount} CAMLY to ${wallet_address}...`);
    
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [wallet_address as `0x${string}`, requiredAmount],
    });

    const txHash = await walletClient.sendTransaction({
      to: CAMLY_CONTRACT as `0x${string}`,
      data,
      chain: bsc,
    });

    console.log(`Transaction sent: ${txHash}`);

    // 14. Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000, // 60 second timeout
    });

    if (receipt.status !== 'success') {
      console.error('Transaction failed:', receipt);
      return new Response(
        JSON.stringify({ error: 'Transaction Failed', message: 'Giao dịch blockchain thất bại' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    // 15-17. Record claim, transaction, and audit log in parallel (fire-and-forget)
    Promise.all([
      supabaseAdmin.from('reward_claims').insert({
        user_id: userId,
        amount: claimAmount,
        wallet_address: wallet_address.toLowerCase(),
      }).then(({ error }) => { if (error) console.error('Failed to insert reward_claims:', error); }),
      supabaseAdmin.from('transactions').insert({
        user_id: userId,
        tx_hash: txHash,
        from_address: treasuryAddress.toLowerCase(),
        to_address: wallet_address.toLowerCase(),
        amount: claimAmount.toString(),
        token_symbol: 'CAMLY',
        token_address: CAMLY_CONTRACT.toLowerCase(),
        chain_id: 56,
        status: 'confirmed',
      }).then(({ error }) => { if (error) console.error('Failed to insert transaction:', error); }),
      supabaseAdmin.from('audit_logs').insert({
        admin_id: userId,
        target_user_id: userId,
        action: 'CLAIM_REWARD',
        details: {
          amount: claimAmount,
          wallet_address,
          tx_hash: txHash,
          block_number: receipt.blockNumber?.toString(),
        },
        reason: `Claimed ${claimAmount.toLocaleString()} CAMLY to ${wallet_address}`,
      }).then(({ error }) => { if (error) console.error('Failed to insert audit_log:', error); }),
      supabaseAdmin
        .from('profiles')
        .update({ last_reward_at: new Date().toISOString() })
        .eq('id', userId)
        .then(({ error }) => { if (error) console.error('Failed to update last_reward_at:', error); }),
    ]).catch(err => console.error('[claim-reward] post-tx logging error:', err));

    console.log(`Successfully claimed ${claimAmount} CAMLY for user ${userId}`);

    // 18. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        tx_hash: txHash,
        amount: claimAmount,
        wallet_address,
        block_number: receipt.blockNumber?.toString(),
        message: `Đã chuyển ${claimAmount.toLocaleString()} CAMLY thành công!`,
        bscscan_url: `https://bscscan.com/tx/${txHash}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Claim reward error:', error);
    
    // Handle specific blockchain errors
    if (error.message?.includes('insufficient funds')) {
      return new Response(
        JSON.stringify({ error: 'Service Unavailable', message: 'Treasury không đủ gas fee' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal Error', 
        message: error.message || 'Lỗi hệ thống, vui lòng thử lại sau' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
