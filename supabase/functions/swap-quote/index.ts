import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ZEROX_API_BASE = 'https://api.0x.org';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { path, query } = await req.json();

    if (!path || typeof path !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `${ZEROX_API_BASE}${path}${query ? '?' + query : ''}`;

    const apiKey = Deno.env.get('ZEROX_API_KEY') || '';

    const zeroxHeaders: Record<string, string> = {
      'Accept': 'application/json',
      '0x-version': 'v2',
    };
    if (apiKey) {
      zeroxHeaders['0x-api-key'] = apiKey;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: zeroxHeaders,
    });

    const data = await response.json().catch(() => ({}));

    // Always return 200 so supabase.functions.invoke doesn't treat upstream
    // error codes as function-level errors. Client reads the payload to detect errors.
    return new Response(JSON.stringify({ ...data, _status: response.status }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
