/**
 * Cloudflare Worker - Agora RTC Token Service
 * 
 * Generates secure RTC tokens for Agora Video Calling using userAccount (string UID)
 * 
 * Endpoints:
 * - GET /health - Health check
 * - GET /config - Public configuration
 * - POST /token/rtc - Generate RTC token
 */

import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { Env, handleCors, corsHeaders } from './cors';
import { validateTokenRequest } from './validate';
import { handleRecordingAcquire, handleRecordingQuery, handleRecordingStart, handleRecordingStop } from './recording';
import { handleLiveRecordingUpload } from './upload';
import {
  handleLivePartInit,
  handleLivePartUpload,
  handleLivePartComplete,
  handleLivePartAbort,
} from './livePartUpload';

// Re-export Env type
export type { Env };

// Rate limiting: in-memory store (best-effort, resets on worker restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

/**
 * Check rate limit for an IP address
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // Start new window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}

/**
 * Clean up expired rate limit entries (run periodically)
 */
function cleanupRateLimitMap(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

/**
 * Generate a unique request ID for logging
 */
function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Create a JSON error response
 */
function errorResponse(message: string, status: number, origin: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    }
  );
}

/**
 * Create a JSON success response
 */
function jsonResponse(data: Record<string, unknown>, origin: string): Response {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    }
  );
}

function roleToWorkerRole(role: unknown): 'publisher' | 'subscriber' {
  if (role === 'host' || role === 'publisher') return 'publisher';
  return 'subscriber';
}

/**
 * Handle GET /health endpoint
 */
function handleHealth(origin: string): Response {
  return jsonResponse({
    ok: true,
    service: 'fun-agora-rtc-token',
    timestamp: new Date().toISOString(),
  }, origin);
}

/**
 * Handle GET /config endpoint
 */
function handleConfig(env: Env, origin: string): Response {
  return jsonResponse({
    appId: env.AGORA_APP_ID,
    allowedOrigins: env.ALLOWED_ORIGINS,
    defaultTtlSeconds: parseInt(env.TOKEN_TTL_SECONDS) || 3600,
  }, origin);
}

/**
 * Handle POST /token/rtc endpoint
 */
async function handleTokenRequest(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  // Check API key
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== env.API_KEY) {
    console.log(`[${requestId}] Invalid or missing API key`);
    return errorResponse('Missing or invalid API key', 401, origin);
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON in request body', 400, origin);
  }

  // Validate request
  const defaultTtl = parseInt(env.TOKEN_TTL_SECONDS) || 3600;
  const validation = validateTokenRequest(body, defaultTtl);

  if (!validation.valid || !validation.data) {
    return errorResponse(validation.error || 'Invalid request', 400, origin);
  }

  const { channel, userAccount, role, expireSeconds } = validation.data;

  try {
    // Calculate expiration timestamp
    const expireAt = Math.floor(Date.now() / 1000) + expireSeconds;

    // Generate RTC token using agora-token library
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      env.AGORA_APP_ID,
      env.AGORA_APP_CERTIFICATE,
      channel,
      userAccount,
      agoraRole,
      expireSeconds,
      expireSeconds
    );

    console.log(`[${requestId}] Token generated for channel: ${channel}, userAccount: ${userAccount.substring(0, 8)}...`);

    return jsonResponse({
      appId: env.AGORA_APP_ID,
      token,
      channel,
      userAccount,
      role,
      expireAt,
    }, origin);

  } catch (error) {
    console.error(`[${requestId}] Token generation error:`, error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500, origin);
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = generateRequestId();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Cleanup rate limit map periodically (1% chance per request)
    if (Math.random() < 0.01) {
      cleanupRateLimitMap();
    }

    console.log(`[${requestId}] ${method} ${path}`);

    // Handle CORS - returns Response if blocked/preflight, or { origin } if allowed
    const corsResult = handleCors(request, env);
    if (corsResult instanceof Response) {
      return corsResult;
    }
    
    const { origin } = corsResult;

    // Rate limiting (get IP from CF headers)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(clientIP)) {
      console.log(`[${requestId}] Rate limit exceeded for IP: ${clientIP.substring(0, 10)}...`);
      return errorResponse('Rate limit exceeded. Try again later.', 429, origin);
    }

    // Route handling
    try {
      // GET /health
      if (method === 'GET' && path === '/health') {
        return handleHealth(origin);
      }

      // GET /config
      if (method === 'GET' && path === '/config') {
        return handleConfig(env, origin);
      }

      // POST /token/rtc
      if (method === 'POST' && path === '/token/rtc') {
        return await handleTokenRequest(request, env, requestId, origin);
      }

      // POST /api/agora/rtc-token (alias)
      if (method === 'POST' && path === '/api/agora/rtc-token') {
        let body: any = null;
        try {
          body = await request.json();
        } catch {
          return errorResponse('Invalid JSON in request body', 400, origin);
        }

        const mappedBody = {
          channel: body?.channelName,
          userAccount: body?.uid ? String(body.uid) : '',
          role: roleToWorkerRole(body?.role),
          expireSeconds: body?.expireSeconds,
        };

        const nextReq = new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify(mappedBody),
        });
        const tokenRes = await handleTokenRequest(nextReq, env, requestId, origin);
        if (!tokenRes.ok) return tokenRes;
        const payload: any = await tokenRes.clone().json().catch(() => ({}));
        return jsonResponse(
          {
            appId: payload?.appId,
            token: payload?.token,
            uid: payload?.userAccount,
            channel: payload?.channel,
            expireAt: payload?.expireAt,
          },
          origin
        );
      }

      // POST /recording/acquire
      if (method === 'POST' && path === '/recording/acquire') {
        return await handleRecordingAcquire(request, env, requestId, origin);
      }

      // POST /recording/start
      if (method === 'POST' && path === '/recording/start') {
        return await handleRecordingStart(request, env, requestId, origin);
      }

      // POST /api/recording/start and /api/agora/recording/start (acquire -> start)
      if (method === 'POST' && (path === '/api/recording/start' || path === '/api/agora/recording/start')) {
        let body: any = null;
        try {
          body = await request.json();
        } catch {
          return errorResponse('Invalid JSON in request body', 400, origin);
        }

        const channelName = body?.channelName;
        const recordingUid = body?.recorderUid
          ? String(body.recorderUid)
          : (body?.recordingUid ? String(body.recordingUid) : (body?.uid ? String(body.uid) : ''));
        const token = body?.token;
        const sessionId = body?.sessionId;

        if (!channelName || !recordingUid || !token || !sessionId) {
          return errorResponse('channelName, recorderUid, token, sessionId are required', 400, origin);
        }

        const acquireReq = new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify({
            channelName,
            uid: recordingUid,
            sessionId,
          }),
        });

        const acquireRes = await handleRecordingAcquire(acquireReq, env, requestId, origin);
        if (!acquireRes.ok) return acquireRes;
        const acquirePayload: any = await acquireRes.clone().json().catch(() => ({}));
        const resourceId = acquirePayload?.data?.resourceId;
        if (!resourceId) {
          return errorResponse('Acquire step did not return resourceId', 502, origin);
        }

        const startReq = new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify({
            channelName,
            uid: recordingUid,
            token,
            sessionId,
            resourceId,
          }),
        });

        const startRes = await handleRecordingStart(startReq, env, requestId, origin);
        if (!startRes.ok) return startRes;
        const startPayload: any = await startRes.clone().json().catch(() => ({}));
        const sid = startPayload?.data?.sid;
        if (!sid) {
          return errorResponse('Start step did not return sid', 502, origin);
        }

        return jsonResponse(
          {
            resourceId,
            sid,
          },
          origin
        );
      }

      // POST /recording/stop
      if (method === 'POST' && path === '/recording/stop') {
        return await handleRecordingStop(request, env, requestId, origin);
      }

      // POST /api/recording/stop and /api/agora/recording/stop (alias)
      if (method === 'POST' && (path === '/api/recording/stop' || path === '/api/agora/recording/stop')) {
        let body: any = null;
        try {
          body = await request.json();
        } catch {
          return errorResponse('Invalid JSON in request body', 400, origin);
        }

        const stopReq = new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify({
            channelName: body?.channelName,
            recordingUid: body?.recorderUid
              ? String(body.recorderUid)
              : (body?.recordingUid ? String(body.recordingUid) : (body?.uid ? String(body.uid) : '')),
            resourceId: body?.resourceId,
            sid: body?.sid,
            sessionId: body?.sessionId,
          }),
        });

        const stopRes = await handleRecordingStop(stopReq, env, requestId, origin);
        if (!stopRes.ok) return stopRes;
        const stopPayload: any = await stopRes.clone().json().catch(() => ({}));
        const canonical = stopPayload?.data ?? {};

        return jsonResponse(canonical, origin);
      }

      // GET /recording/query
      if (method === 'GET' && path === '/recording/query') {
        return await handleRecordingQuery(request, env, requestId, origin);
      }

      // GET /api/recording/query and /api/agora/recording/query (alias)
      if (method === 'GET' && (path === '/api/recording/query' || path === '/api/agora/recording/query')) {
        const targetUrl = new URL(request.url);
        const sourceUrl = new URL(request.url);
        targetUrl.pathname = '/recording/query';
        targetUrl.search = sourceUrl.search;
        const queryReq = new Request(targetUrl.toString(), {
          method: 'GET',
          headers: request.headers,
        });
        const queryRes = await handleRecordingQuery(queryReq, env, requestId, origin);
        if (!queryRes.ok) return queryRes;
        const queryPayload: any = await queryRes.clone().json().catch(() => ({}));
        return jsonResponse(queryPayload?.data ?? {}, origin);
      }

      // POST /upload/live-recording
      if (method === 'POST' && path === '/upload/live-recording') {
        return await handleLiveRecordingUpload(request, env, requestId, origin);
      }

      // R2 multipart endpoints for live recording chunks (parallel upload during live)
      if (method === 'POST' && path === '/upload/live-part/init') {
        return await handleLivePartInit(request, env, requestId, origin);
      }
      if (method === 'PUT' && path === '/upload/live-part/upload') {
        return await handleLivePartUpload(request, env, requestId, origin);
      }
      if (method === 'POST' && path === '/upload/live-part/complete') {
        return await handleLivePartComplete(request, env, requestId, origin);
      }
      if (method === 'POST' && path === '/upload/live-part/abort') {
        return await handleLivePartAbort(request, env, requestId, origin);
      }

      // 404 for unknown routes
      return errorResponse('Not found', 404, origin);

    } catch (error) {
      console.error(`[${requestId}] Unhandled error:`, error instanceof Error ? error.message : 'Unknown error');
      return errorResponse('Internal server error', 500, origin);
    }
  },
};
