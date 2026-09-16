import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CACHE_TTL_MS = 120_000; // 2 minutes

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ids = url.searchParams.get('ids') || 'binancecoin,bitcoin,tether,camly-coin';
    const sb = supabaseAdmin();

    // 1. Try DB cache first
    const { data: cached } = await sb
      .from('price_cache')
      .select('data, updated_at')
      .eq('id', 'coingecko')
      .maybeSingle();

    const cacheAge = cached?.updated_at
      ? Date.now() - new Date(cached.updated_at).getTime()
      : Infinity;

    if (cached?.data && cacheAge < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    // 2. Fetch from CoinGecko
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    );

    if (!response.ok) {
      // Rate limited or error – return stale cache if available
      if (cached?.data) {
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'STALE' },
        });
      }
      throw new Error(`CoinGecko returned ${response.status}`);
    }

    const data = await response.json();

    // 3. Persist to DB cache (upsert)
    await sb.from('price_cache').upsert(
      { id: 'coingecko', data, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (error: any) {
    // Last resort: try DB cache on any error
    try {
      const sb = supabaseAdmin();
      const { data: fallback } = await sb
        .from('price_cache')
        .select('data')
        .eq('id', 'coingecko')
        .maybeSingle();
      if (fallback?.data) {
        return new Response(JSON.stringify(fallback.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'ERROR-STALE' },
        });
      }
    } catch (_) { /* ignore */ }

    console.error('[price-proxy] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
