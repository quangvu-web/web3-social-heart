# Backend Requirements for `@fun/chat`

## Required Supabase schema
Run migration:
- `supabase/migrations/0001_fun_chat_core.sql`

This creates:
- `conversations`
- `conversation_participants`
- `messages`
- `message_reads`
- `message_reactions`
- `call_sessions`
- `call_participants`

## Agora token endpoint
For voice/video call support, configure an endpoint that returns RTC token.

### Request
`POST /token/rtc`

```json
{
  "channel": "chat_xxx",
  "userAccount": "user-id",
  "role": "publisher",
  "expireSeconds": 3600
}
```

### Response
```json
{
  "token": "...",
  "appId": "...",
  "channel": "chat_xxx",
  "userAccount": "user-id",
  "role": "publisher",
  "expireAt": 1735689600
}
```

## Minimal environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AGORA_APP_ID`
- `VITE_AGORA_TOKEN_ENDPOINT` (optional if calls disabled)
- `VITE_AGORA_TOKEN_API_KEY` (optional header for token endpoint)

## Notes
- Calls are optional and controlled by `features.calls`.
- Chat-only integration works without Agora config.
- `profiles` table is expected (`id`, `username`, `avatar_url`, `full_name`).