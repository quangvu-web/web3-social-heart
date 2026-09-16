/**
 * CORS Middleware for Cloudflare Worker
 * Supports multiple allowed origins (comma-separated)
 */

export interface Env {
  ALLOWED_ORIGINS: string; // Comma-separated list of allowed origins
  TOKEN_TTL_SECONDS: string;
  AGORA_APP_ID: string;
  AGORA_APP_CERTIFICATE: string;
  API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  RECORDINGS_BUCKET: R2Bucket;
  // Agora REST API (Cloud Recording)
  AGORA_CUSTOMER_ID: string;
  AGORA_CUSTOMER_SECRET: string;
  // R2 (S3-compatible storage)
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  R2_REGION: string;
  R2_ENDPOINT: string;
  R2_ACCOUNT_ID?: string;
  // New recording env names (preferred)
  REC_STORAGE_BUCKET?: string;
  REC_STORAGE_ACCESS_KEY?: string;
  REC_STORAGE_SECRET_KEY?: string;
  REC_STORAGE_REGION?: string;
  REC_R2_ENDPOINT?: string;
  PUBLIC_MEDIA_BASE_URL?: string;
  REC_ENABLE_HEAD_FALLBACK?: string;
  // Playback
  RECORDING_PLAYBACK_BASE_URL: string;
}

/**
 * Parse allowed origins from env (comma-separated)
 */
function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
}

/**
 * Check if origin is in allowed list
 */
function isOriginAllowed(origin: string, env: Env): boolean {
  const allowedOrigins = parseAllowedOrigins(env);
  return allowedOrigins.includes(origin);
}

/**
 * Generate CORS headers for responses
 * Echoes back the allowed origin for proper CORS support
 */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-correlation-id, Authorization, X-Stream-Id, X-Filename, X-Upload-Id, X-Part-Number, X-R2-Key',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight and origin validation
 * Returns Response if request should be blocked or is preflight
 * Returns { origin } if request should continue
 */
export function handleCors(request: Request, env: Env): Response | { origin: string } {
  const origin = request.headers.get('Origin');
  
  // For non-browser requests (no Origin header), allow if it's a health check
  if (!origin) {
    const url = new URL(request.url);
    if (url.pathname === '/health' || url.pathname === '/config') {
      return { origin: '*' }; // Allow health/config checks without origin
    }
    // For token requests, origin is required
    return new Response(
      JSON.stringify({ error: 'Origin header required' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Check if origin is allowed
  if (!isOriginAllowed(origin, env)) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Handle OPTIONS preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // Request is allowed, return origin for use in response headers
  return { origin };
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(response: Response, origin: string): Response {
  const newHeaders = new Headers(response.headers);
  const cors = corsHeaders(origin);
  
  for (const [key, value] of Object.entries(cors)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
