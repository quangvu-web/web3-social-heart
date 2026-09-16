# CHAT MODULE PACKAGE

## 1. Overview....
This document describes the full chat module currently implemented in `src/modules/chat/*` for FUN Profile....

Included feature scope:,.
- Messaging UI for direct chat and group chat....
- Realtime message sync, reactions, read status, typing indicator.
- Voice call and video call with Agora RTC.
- Gift and money transfer inside chat (crypto gift + red envelope flow).
- File upload and attachments in messages.
- Sticker panel and emoji picker integration.
- Conversation sidebar, user search, group management, and chat settings.
- Chat notifications and global incoming-call handling.

Implementation boundaries and dependencies:
- Primary frontend module is `src/modules/chat/*`.
- Global call entry is `src/contexts/CallContext.tsx`.
- Supabase provides auth, tables, realtime, RPC, and edge functions.
- Cloudflare Worker provides Agora token API.
- Important frontend libraries: `react`, `react-router-dom`, `@tanstack/react-query`, `@supabase/supabase-js`, `agora-rtc-sdk-ng`, `wagmi`, `viem`, `sonner`, `date-fns`, `lucide-react`.

## 2. Architecture
Component and hook map:
- Page shell and layout: `src/modules/chat/pages/Chat.tsx`.
- Main thread orchestration: `src/modules/chat/components/MessageThread.tsx`.
- Input and compose actions: `src/modules/chat/components/ChatInput.tsx`.
- Conversation list and navigation: `src/modules/chat/components/ConversationList.tsx`.
- Bubble rendering by message type: `src/modules/chat/components/MessageBubble.tsx`.
- Calls runtime: `src/modules/chat/hooks/useAgoraCall.ts`.
- Realtime messages and optimistic updates: `src/modules/chat/hooks/useMessages.ts`.
- Conversation fetch/create: `src/modules/chat/hooks/useConversations.ts`, `src/modules/chat/hooks/useGroupConversations.ts`.
- Typing indicator: `src/modules/chat/hooks/useTypingIndicator.ts`.
- Notifications and sound/toast: `src/modules/chat/hooks/useChatNotifications.ts`.
- Chat privacy settings: `src/modules/chat/hooks/useChatSettings.ts`.
- Stickers and red envelope data: `src/modules/chat/hooks/useStickers.ts`, `src/modules/chat/hooks/useRedEnvelope.ts`.
- Global incoming call listener: `src/contexts/CallContext.tsx`.

Data flow:
- UI -> hooks -> Supabase tables and RPC -> React Query cache -> UI rerender.
- UI -> Supabase Realtime channels (`messages`, `message_reactions`, `message_reads`, `call_sessions`) -> local cache patch/invalidate.
- Calls: `useAgoraCall` -> `src/lib/agoraRtc.ts` -> Cloudflare Worker `/token/rtc` -> Agora join/publish.
- Upload: `ChatInput` -> `src/utils/mediaUpload.ts` -> Supabase Edge Function `get-upload-url` -> direct R2 upload -> message with attachment URL.

Global incoming call path:
- `src/contexts/CallContext.tsx` listens for `call_sessions` realtime events.
- On answer, it navigates to `/chat/:conversationId?answer=:callId`.
- `useAgoraCall` auto-answers from query param and joins RTC channel.

## 3. Feature Checklist (with file references)
Messaging, realtime, read status, typing:
- Message fetch, pagination, optimistic send, reaction/read realtime: `src/modules/chat/hooks/useMessages.ts`.
- Thread UI and message actions: `src/modules/chat/components/MessageThread.tsx`.
- Bubble view with text/file/sticker/red-envelope/system/deleted states: `src/modules/chat/components/MessageBubble.tsx`.
- Typing send/receive via broadcast channel: `src/modules/chat/hooks/useTypingIndicator.ts`, `src/modules/chat/components/TypingIndicator.tsx`.

Voice and video calls:
- Call state machine, join/publish/leave, mute/camera, auto-answer, timeout: `src/modules/chat/hooks/useAgoraCall.ts`.
- Call room and controls: `src/modules/chat/components/CallRoom.tsx`, `src/modules/chat/components/CallControls.tsx`, `src/modules/chat/components/VideoGrid.tsx`, `src/modules/chat/components/PreCallSettings.tsx`.
- Incoming call UI and ringtone: `src/modules/chat/components/IncomingCallDialog.tsx`.
- Global listener outside chat page: `src/contexts/CallContext.tsx`.

Gift and money transfer:
- Crypto gift launcher: `src/modules/chat/components/CryptoGiftButton.tsx`.
- Wallet transfer modal using wagmi/viem and DB write to `crypto_gifts`: `src/modules/chat/components/SendCryptoModal.tsx`.
- Red envelope UI and claim flow: `src/modules/chat/components/RedEnvelopeDialog.tsx`, `src/modules/chat/components/RedEnvelopeCard.tsx`, `src/modules/chat/components/RedEnvelopeClaimDialog.tsx`, `src/modules/chat/hooks/useRedEnvelope.ts`.

File upload and attachments:
- Compose UI for attachments: `src/modules/chat/components/ChatInput.tsx`.
- Upload utility and presigned URL flow: `src/utils/mediaUpload.ts`.
- URL normalization for chat attachments: `src/lib/urlFix.ts`.
- Attachment rendering/download in bubbles: `src/modules/chat/components/MessageBubble.tsx`.

Stickers and emoji:
- Sticker panel UI: `src/modules/chat/components/StickerPicker.tsx`.
- Sticker pack/item fetch: `src/modules/chat/hooks/useStickers.ts`.
- Emoji picker integration in chat input: `src/components/feed/EmojiPicker.tsx`, `src/modules/chat/components/ChatInput.tsx`.

Sidebar, conversation list, search, settings, notifications:
- Conversation list and unread context: `src/modules/chat/components/ConversationList.tsx`.
- New DM/group dialogs: `src/modules/chat/components/NewConversationDialog.tsx`, `src/modules/chat/components/CreateGroupDialog.tsx`.
- Search UI: `src/modules/chat/components/MessageSearch.tsx`.
- Settings UI and persistence: `src/modules/chat/components/ChatSettingsDialog.tsx`, `src/modules/chat/hooks/useChatSettings.ts`.
- Notification hook: `src/modules/chat/hooks/useChatNotifications.ts`.

## 4. Key Files Map
Pages and layout:
- `src/modules/chat/pages/Chat.tsx`: main responsive chat page, sidebar + thread orchestration.
- `src/pages/Chat.tsx`: wrapper route entry to module page.
- `src/contexts/CallContext.tsx`: app-wide incoming call handler.

Core components:
- `src/modules/chat/components/MessageThread.tsx`: thread container, call action buttons, message list, search, dialogs.
- `src/modules/chat/components/MessageBubble.tsx`: visual and interaction model per message type.
- `src/modules/chat/components/ChatInput.tsx`: composer for text, files, stickers, gifts.
- `src/modules/chat/components/ConversationList.tsx`: list UI for direct/group conversations.
- `src/modules/chat/components/IncomingCallDialog.tsx`: incoming call accept/decline dialog.
- `src/modules/chat/components/CallRoom.tsx`: active call full-screen room.
- `src/modules/chat/components/SendCryptoModal.tsx`: crypto transfer flow.
- `src/modules/chat/components/StickerPicker.tsx`: sticker selection panel.
- `src/modules/chat/components/ChatSettingsDialog.tsx`: chat privacy options.

Hooks:
- `src/modules/chat/hooks/useMessages.ts`: message querying, realtime, mutations.
- `src/modules/chat/hooks/useConversations.ts`: conversation querying and DM creation.
- `src/modules/chat/hooks/useGroupConversations.ts`: group create/update/member ops.
- `src/modules/chat/hooks/useAgoraCall.ts`: call lifecycle and Agora bridge.
- `src/modules/chat/hooks/useTypingIndicator.ts`: typing broadcast and debounce.
- `src/modules/chat/hooks/useChatNotifications.ts`: toast/system notifications.
- `src/modules/chat/hooks/useChatSettings.ts`: read receipts/typing/privacy settings.
- `src/modules/chat/hooks/useStickers.ts`: sticker packs/items loading.
- `src/modules/chat/hooks/useRedEnvelope.ts`: red envelope claims and realtime updates.

Utilities and services:
- `src/lib/agoraRtc.ts`: frontend Agora token fetch and RTC client factory.
- `src/utils/mediaUpload.ts`: chat media upload pipeline.
- `src/lib/urlFix.ts`: attachment URL rewrite safety layer.

Backend and infra:
- `worker/src/index.ts`: Cloudflare Worker token API routes and generation.
- `worker/src/cors.ts`: CORS enforcement for token service.
- `worker/src/validate.ts`: request schema and input validation.
- `supabase/functions/get-upload-url/index.ts`: presigned upload URL edge function.
- `supabase/functions/agora-token/index.ts`: legacy Supabase token function (fallback/secondary).
- `supabase/migrations/20260112145038_b700216f-a256-4fe4-b957-b9559580c085.sql`: base chat tables + RLS + realtime.
- `supabase/migrations/20260202032057_bfde2c00-860e-43a0-b727-a938ae10956f.sql`: call tables + RLS.
- `supabase/migrations/20260207070852_3871af2a-7d33-43e9-a37f-610aa1074824.sql`: crypto gifts table.
- `supabase/migrations/20260210120000_chat_pins_search.sql`: pin/unpin and search helpers.
- `supabase/migrations/20260210120500_chat_block_report.sql`: block/report and message policy constraints.
- `supabase/migrations/20260210121000_chat_stickers_edit.sql`: sticker message type and edit constraints.
- `supabase/migrations/20260210121500_chat_red_envelope.sql`: red envelope schema + claim RPC.
- `supabase/migrations/20260210121800_chat_message_preview.sql`: preview logic updates.

Legacy mirror note:
- `src/components/chat/*` exists and appears to mirror module components.
- Primary source of truth for this package document remains `src/modules/chat/*`.

## 5. Configuration
Required frontend env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_AGORA_WORKER_URL`
- `VITE_AGORA_WORKER_API_KEY`

Required Worker runtime vars and secrets:
- Worker URL fixed for deployment: `AGORA_WORKER_URL=https://fun-agora-rtc-token.lequangvu2210-hue.workers.dev`
- Wrangler vars: `ALLOWED_ORIGINS`, `TOKEN_TTL_SECONDS`
- Wrangler secrets: `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `API_KEY`

Required Supabase edge-function env vars for upload pipeline:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ACCESS_KEY_ID`
- `CLOUDFLARE_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_R2_PUBLIC_URL`

Secure secret handling:
- Local development: keep secrets in `.env` and ensure `.env` is git-ignored.
- Cloudflare Worker: set secret with `wrangler secret put API_KEY`.
- Frontend should consume placeholder style only: `AGORA_WORKER_API_KEY=${AGORA_WORKER_API_KEY}`.
- Do not commit real API keys or app certificates to code or markdown.

## 6. API Contracts
Frontend -> Cloudflare Worker token contract:
- Endpoint: `POST ${AGORA_WORKER_URL}/token/rtc`
- Headers:
- `Content-Type: application/json`
- `x-api-key: ${AGORA_WORKER_API_KEY}`
- Request JSON:
```json
{
  "channel": "call_<conversationId>_<timestamp>",
  "userAccount": "<supabase-user-id>",
  "role": "publisher",
  "expireSeconds": 3600
}
```
- Success response JSON:
```json
{
  "appId": "<agora-app-id>",
  "token": "<rtc-token>",
  "channel": "call_xxx",
  "userAccount": "<supabase-user-id>",
  "role": "publisher",
  "expireAt": 1730000000
}
```
- Error behavior:
- `400` invalid payload.
- `401` missing or invalid API key.
- `403` origin blocked by CORS.
- `429` rate limit.
- `500` internal token generation failure.

Supabase resources used by chat frontend:
- Tables:
- `conversations`, `conversation_participants`, `messages`, `message_reads`, `message_reactions`, `chat_settings`, `call_sessions`, `call_participants`, `crypto_gifts`, `red_envelopes`, `red_envelope_claims`, `sticker_packs`, `stickers`, `user_blocks`, `chat_reports`.
- RPC:
- `claim_red_envelope(uuid)`
- `pin_message(uuid)`
- `unpin_message(uuid)`
- Edge functions:
- `get-upload-url` for presigned upload URLs.
- Legacy fallback token path:
- `supabase/functions/agora-token/index.ts` is still present as secondary/legacy token provider.

## 7. UI Behavior
Loading states:
- Conversation list skeleton while query is loading: `src/modules/chat/components/ConversationList.tsx`.
- Thread skeleton while message page loads: `src/modules/chat/components/MessageThread.tsx`.
- Sticker pack loading in picker: `src/modules/chat/components/StickerPicker.tsx`.

Empty states:
- No conversations placeholder in sidebar list: `src/modules/chat/components/ConversationList.tsx`.
- No selected conversation placeholder on desktop: `src/modules/chat/pages/Chat.tsx`.
- No messages fallback in thread rendering.

Error states:
- Toast/error handling for send failure, upload failure, call failure, gift failure via `sonner` and `useToast`.
- Upload utility returns explicit `FILE_TYPE_NOT_SUPPORTED` path in `src/utils/mediaUpload.ts`.

Message bubble types:
- Text message.
- File attachment message.
- Sticker message (`message_type='sticker'`).
- Gift/red envelope message (`message_type='red_envelope'`).
- System event message (`message_type='system'`).
- Soft-deleted message (`is_deleted=true`).

Call state machine:
- `idle`
- `calling`
- `ringing`
- `connecting`
- `connected`
- `ended`

## 8. Security, RLS, and Failure Modes
RLS and policy expectations:
- `messages` read/send constrained to conversation participants.
- `call_sessions` view/create/update constrained to conversation participants.
- `message_reads` and `message_reactions` constrained by message conversation membership.
- `chat_settings` scoped to owner for write operations.
- Block/report policies tighten DM messaging behavior.

Common failure modes and fixes:
- Token expired: refetch a new Worker token before rejoin/publish.
- Worker `401`: check `x-api-key` and ensure `API_KEY` secret is configured in Worker.
- Worker `403` CORS: add the app origin to `ALLOWED_ORIGINS` in `worker/wrangler.toml`.
- Worker `400`: validate `channel`, `userAccount`, `role`, `expireSeconds` payload.
- Worker non-2xx: surface backend error body to UI, avoid silent retries.
- Upload failures: validate file type and size, verify `get-upload-url` edge-function env.
- Realtime missing updates: verify tables are in `supabase_realtime` publication and channel filters are correct.

Security warning:
- Avoid hardcoding API keys in frontend code.
- Consume `AGORA_WORKER_API_KEY` from env/secret injection only.
- Never expose `AGORA_APP_CERTIFICATE` client-side.

## 9. Reuse in Another Project
Minimal integration steps:
1. Copy `src/modules/chat/*` and `src/contexts/CallContext.tsx`.
2. Provide Supabase client at `src/integrations/supabase/client.ts`.
3. Add routes for chat page:
- `/chat`
- `/chat/:conversationId`
4. Wrap app tree with React Query provider and `CallProvider`.
5. Configure Worker URL and API key via env placeholders.
6. Deploy Worker and apply required Supabase migrations.
7. Ensure upload edge function and R2 config are live.

Expected dependencies:
- `react`, `react-dom`, `react-router-dom`
- `@supabase/supabase-js`
- `@tanstack/react-query`
- `agora-rtc-sdk-ng`
- `wagmi`, `viem`
- `sonner`, `date-fns`, `lucide-react`
- shadcn/ui primitives used by chat components

Mounting guidance:
- Route entry should render `src/modules/chat/pages/Chat.tsx`.
- Keep `CallProvider` mounted globally so incoming calls appear outside chat route.
- Include required shared UI components used by chat imports (`EmojiPicker`, `LazyImage`, shadcn dialogs/buttons/select/tooltip/etc.).

Backend prerequisites:
- Worker token service running at `https://fun-agora-rtc-token.lequangvu2210-hue.workers.dev`.
- Supabase migrations listed in Section 4 applied.
- Supabase edge function `get-upload-url` configured with valid R2 credentials.

## 10. How To Test Checklist
Messaging and realtime:
- Open app in two browsers as two users.
- Start DM and group conversation.
- Send/receive text messages and verify instant realtime update.
- Verify read status updates and reaction updates.
- Verify typing indicator appears/disappears.

Calls:
- Start voice call from User A and observe ringing on User B.
- Accept on User B and verify both users become `connected`.
- Test mute/unmute and camera on/off.
- End call from one side and verify cleanup on both sides.
- Test timeout path for unanswered call (`missed`).

Gifts and transfers:
- Send crypto gift from chat transfer modal.
- Verify row inserted/updated in `crypto_gifts`.
- Verify transaction hash status transitions.
- Create and claim red envelope; verify RPC and remaining amount/count updates.

Files and stickers:
- Upload image/video/document and verify message bubble rendering.
- Verify non-image attachments support download link.
- Send sticker and confirm `message_type='sticker'` render in bubble.
- Send emoji in text input and verify content persistence.

Settings and notifications:
- Toggle read receipts and typing settings in chat settings dialog.
- Trigger background incoming message and verify toast/notification path.

Logs and diagnostics:
- Browser console for frontend errors and Agora events.
- Supabase logs for table writes, RPC, and edge-function behavior.
- Cloudflare Worker logs via `wrangler tail` for token requests and CORS/API-key errors.
