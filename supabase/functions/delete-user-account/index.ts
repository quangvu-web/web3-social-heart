import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user from JWT token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = user.id;
    console.log(`Starting account deletion for user: ${userId}`);

    // Admin client to delete data and user
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Delete data in order (avoid foreign key constraints)
    const deletionResults: Record<string, string> = {};

    // 1. Reactions (on posts and comments)
    const { error: reactionsError } = await adminClient.from('reactions').delete().eq('user_id', userId);
    deletionResults['reactions'] = reactionsError ? `Error: ${reactionsError.message}` : 'OK';

    // 2. Comments
    const { error: commentsError } = await adminClient.from('comments').delete().eq('user_id', userId);
    deletionResults['comments'] = commentsError ? `Error: ${commentsError.message}` : 'OK';

    // 3. Shared posts
    const { error: sharedPostsError } = await adminClient.from('shared_posts').delete().eq('user_id', userId);
    deletionResults['shared_posts'] = sharedPostsError ? `Error: ${sharedPostsError.message}` : 'OK';

    // 4. Posts
    const { error: postsError } = await adminClient.from('posts').delete().eq('user_id', userId);
    deletionResults['posts'] = postsError ? `Error: ${postsError.message}` : 'OK';

    // 5. Friendships (both directions)
    const { error: friendships1Error } = await adminClient.from('friendships').delete().eq('user_id', userId);
    const { error: friendships2Error } = await adminClient.from('friendships').delete().eq('friend_id', userId);
    deletionResults['friendships'] = (friendships1Error || friendships2Error) 
      ? `Error: ${friendships1Error?.message || friendships2Error?.message}` : 'OK';

    // 6. Notifications (both as receiver and actor)
    const { error: notifications1Error } = await adminClient.from('notifications').delete().eq('user_id', userId);
    const { error: notifications2Error } = await adminClient.from('notifications').delete().eq('actor_id', userId);
    deletionResults['notifications'] = (notifications1Error || notifications2Error)
      ? `Error: ${notifications1Error?.message || notifications2Error?.message}` : 'OK';

    // 7. Reward claims
    const { error: rewardClaimsError } = await adminClient.from('reward_claims').delete().eq('user_id', userId);
    deletionResults['reward_claims'] = rewardClaimsError ? `Error: ${rewardClaimsError.message}` : 'OK';

    // 8. Reward approvals
    const { error: rewardApprovalsError } = await adminClient.from('reward_approvals').delete().eq('user_id', userId);
    deletionResults['reward_approvals'] = rewardApprovalsError ? `Error: ${rewardApprovalsError.message}` : 'OK';

    // 9. Reward adjustments
    const { error: rewardAdjustmentsError } = await adminClient.from('reward_adjustments').delete().eq('user_id', userId);
    deletionResults['reward_adjustments'] = rewardAdjustmentsError ? `Error: ${rewardAdjustmentsError.message}` : 'OK';

    // 10. Search logs
    const { error: searchLogsError } = await adminClient.from('search_logs').delete().eq('user_id', userId);
    deletionResults['search_logs'] = searchLogsError ? `Error: ${searchLogsError.message}` : 'OK';

    // 11. Soul NFTs
    const { error: soulNftsError } = await adminClient.from('soul_nfts').delete().eq('user_id', userId);
    deletionResults['soul_nfts'] = soulNftsError ? `Error: ${soulNftsError.message}` : 'OK';

    // 12. Custodial wallets
    const { error: custodialWalletsError } = await adminClient.from('custodial_wallets').delete().eq('user_id', userId);
    deletionResults['custodial_wallets'] = custodialWalletsError ? `Error: ${custodialWalletsError.message}` : 'OK';

    // 13. Transactions
    const { error: transactionsError } = await adminClient.from('transactions').delete().eq('user_id', userId);
    deletionResults['transactions'] = transactionsError ? `Error: ${transactionsError.message}` : 'OK';

    // 14. User roles
    const { error: userRolesError } = await adminClient.from('user_roles').delete().eq('user_id', userId);
    deletionResults['user_roles'] = userRolesError ? `Error: ${userRolesError.message}` : 'OK';

    // 15. Profile (must be last before auth user)
    const { error: profilesError } = await adminClient.from('profiles').delete().eq('id', userId);
    deletionResults['profiles'] = profilesError ? `Error: ${profilesError.message}` : 'OK';

    console.log('Deletion results:', deletionResults);

    // Finally: Delete user from auth.users
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError);
      return new Response(JSON.stringify({ 
        error: 'Failed to delete account from auth system',
        details: deleteUserError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Successfully deleted account for user: ${userId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Account deleted successfully',
      deletionResults
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Delete account error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
