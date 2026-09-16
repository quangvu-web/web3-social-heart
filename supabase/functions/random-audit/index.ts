import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check - admin can trigger manually, cron has no auth
    let adminId: string | null = null;
    let triggeredBy = 'scheduled';
    const authHeader = req.headers.get('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (!userError && user) {
        const userId = user.id;

        // Check admin role
        const { data: roleData } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .single();

        if (roleData) {
          adminId = userId;
          triggeredBy = `admin:${userId}`;
        } else {
          return new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin only' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // Invalid token provided - reject
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    // No auth header = scheduled call, allowed

    console.log(`[random-audit] Starting (triggered by: ${triggeredBy})`);

    // Get active users (had actions in last 7 days)
    const { data: activeUsers } = await supabaseAdmin
      .from('user_action_log')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const uniqueUserIds = [...new Set(activeUsers?.map(u => u.user_id) || [])];
    
    if (uniqueUserIds.length === 0) {
      return new Response(JSON.stringify({
        message: 'No active users found',
        audited: 0,
        flagged: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Select random 5%
    const sampleSize = Math.max(1, Math.ceil(uniqueUserIds.length * 0.05));
    const shuffled = uniqueUserIds.sort(() => Math.random() - 0.5);
    const selectedUsers = shuffled.slice(0, sampleSize);

    console.log(`[random-audit] Auditing ${selectedUsers.length}/${uniqueUserIds.length} active users`);

    let flaggedCount = 0;
    const flaggedDetails: any[] = [];

    for (const userId of selectedUsers) {
      const { data: trustScore, error } = await supabaseAdmin.rpc('calculate_trust_score', { p_user_id: userId });
      
      if (error) {
        console.error(`[random-audit] Error calculating trust for ${userId}:`, error);
        continue;
      }

      if (trustScore !== null && trustScore < 20) {
        await supabaseAdmin
          .from('user_trust')
          .update({
            is_flagged: true,
            flag_reason: `Random audit: trust_score=${trustScore}`,
          })
          .eq('user_id', userId);

        await supabaseAdmin
          .from('reward_pending')
          .update({ status: 'frozen' })
          .eq('user_id', userId)
          .eq('status', 'pending');

        flaggedCount++;
        flaggedDetails.push({ user_id: userId, trust_score: trustScore });
      }
    }

    // Log audit - use system UUID for scheduled calls
    await supabaseAdmin.from('audit_logs').insert({
      admin_id: adminId || '00000000-0000-0000-0000-000000000000',
      action: 'RANDOM_AUDIT',
      details: {
        total_active: uniqueUserIds.length,
        sample_size: selectedUsers.length,
        flagged_count: flaggedCount,
        flagged_users: flaggedDetails,
        triggered_by: triggeredBy,
      },
      reason: `${triggeredBy === 'scheduled' ? 'Scheduled weekly audit' : 'Manual audit'}: ${selectedUsers.length} sampled, ${flaggedCount} flagged`,
    });

    console.log(`[random-audit] Complete: ${flaggedCount} flagged out of ${selectedUsers.length}`);

    return new Response(JSON.stringify({
      success: true,
      total_active: uniqueUserIds.length,
      audited: selectedUsers.length,
      flagged: flaggedCount,
      flagged_users: flaggedDetails,
      triggered_by: triggeredBy,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[random-audit] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
