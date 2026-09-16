# Internal Application API Key (`FUN_PROFILE_APP_KEY`)

A single shared secret used by trusted internal services (Angel AI, Fun Hub Core, Telegram services, future microservices) to authenticate server-to-server calls into FUN Profile edge functions.

## Properties

- Format: `fun_profile_live_<58 base62 chars>` (74 chars total, generated with `crypto.getRandomValues`).
- Stored as a backend secret (`FUN_PROFILE_APP_KEY`) in Lovable Cloud.
- Only a SHA-256 hash + prefix + last 4 chars are persisted in `public.app_api_keys` for rotation history.
- Never exposed to the frontend, never logged in plaintext, never returned in any API response (except the one-time generation modal in the Admin UI).

## Sending the key

All callers MUST send:

```
Authorization: Bearer <FUN_PROFILE_APP_KEY>
```

### Example: fetch from another service

```ts
await fetch(`${FUN_PROFILE_URL}/functions/v1/some-endpoint`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.FUN_PROFILE_APP_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ ... }),
});
```

### Example: curl

```bash
curl -X POST "$FUN_PROFILE_URL/functions/v1/some-endpoint" \
  -H "Authorization: Bearer $FUN_PROFILE_APP_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Validating inside an edge function

```ts
import { requireAppKey } from "../_shared/appKeyAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const unauthorized = await requireAppKey(req);
  if (unauthorized) return unauthorized;

  // ...trusted internal logic here
});
```

`validateAppKey(req)` is also available if you need a boolean.

The validator:
1. Constant-time compares against the `FUN_PROFILE_APP_KEY` env var.
2. Falls back to checking the SHA-256 hash against `active` rows in `app_api_keys` (for seamless rotation overlap).

## Rotation procedure

1. Admin → **Security → Application Keys → Rotate**.
2. Copy the new key shown in the one-time modal.
3. Update the `FUN_PROFILE_APP_KEY` secret in Lovable Cloud with the new value.
4. Update the secret in every caller service (Angel AI, Fun Hub Core, Telegram services, ...).
5. Verify callers are working with the new key.
6. Revoke the old key from the Admin UI (it's already marked `rotated`; mark `revoked` to fully disable the DB fallback).

During the overlap window, both old and new keys validate successfully because the old one is still `active` in DB until you revoke it. The env-var-only key (current `FUN_PROFILE_APP_KEY`) is whichever value you have set in secrets.

## Security rules

- Backend only. Never bundle into the frontend or mobile app.
- Never log the key value. Log prefix/last4 if you must.
- Never echo the key in API responses or error messages.
- Treat it like a database password.
