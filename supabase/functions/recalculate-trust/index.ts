import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Optional auth check - admin can trigger manually, cron has no auth
    let adminId: string | null = null;
    const authHeader = req.headers.get('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userId = user.id;
        const { data: roleData } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .single();
        if (roleData) adminId = userId;
      }
    }

    const triggeredBy = adminId ? `admin:${adminId}` : 'scheduled';
    console.log(`[recalculate-trust] Starting (triggered by: ${triggeredBy})`);

    // Get all user IDs
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id');

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: 'No users found', recalculated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[recalculate-trust] Processing ${users.length} users in batches of ${BATCH_SIZE}`);

    let successCount = 0;
    let errorCount = 0;
    const results: { user_id: string; trust_score: number | null; error?: string }[] = [];

    // Process in batches
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (user) => {
        const { data: score, error } = await supabaseAdmin.rpc('calculate_trust_score', {
          p_user_id: user.id,
        });
        if (error) {
          errorCount++;
          results.push({ user_id: user.id, trust_score: null, error: error.message });
          console.error(`[recalculate-trust] Error for ${user.id}:`, error.message);
        } else {
          successCount++;
          results.push({ user_id: user.id, trust_score: score });
        }
      });
      await Promise.all(batchPromises);
    }

    // Log audit
    await supabaseAdmin.from('audit_logs').insert({
      admin_id: adminId || '00000000-0000-0000-0000-000000000000',
      action: 'DAILY_TRUST_RECALC',
      details: {
        total_users: users.length,
        success: successCount,
        errors: errorCount,
        triggered_by: triggeredBy,
        results: results.slice(0, 50), // limit logged results
      },
      reason: `Trust recalculation: ${successCount}/${users.length} successful`,
    });

    console.log(`[recalculate-trust] Complete: ${successCount} success, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      total_users: users.length,
      recalculated: successCount,
      errors: errorCount,
      triggered_by: triggeredBy,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[recalculate-trust] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
