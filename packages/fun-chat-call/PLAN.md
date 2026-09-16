# FUN Chat + Calling Extraction Plan

## Scope
Extract the existing chat + calling feature into `packages/fun-chat-call` with a clean public API and host adapter layer, while preserving existing behavior in this app.

## Current source of truth
- Chat page + UI: `src/modules/chat/pages/Chat.tsx`, `src/modules/chat/components/*`
- Chat/call hooks: `src/modules/chat/hooks/*` (notably `useMessages`, `useConversations`, `useAgoraCall`)
- Global incoming call: `src/contexts/CallContext.tsx`
- Agora token backend: `supabase/functions/agora-token/index.ts`

## Target package structure
- `packages/fun-chat-call/package.json`
- `packages/fun-chat-call/src/index.ts`
- `packages/fun-chat-call/src/provider/FunChatProvider.tsx`
- `packages/fun-chat-call/src/config/types.ts`
- `packages/fun-chat-call/src/adapters/ChatCallAdapter.ts`
- `packages/fun-chat-call/src/ui/*`
- `packages/fun-chat-call/src/hooks/*`
- `packages/fun-chat-call/src/services/*`
- `packages/fun-chat-call/README.md`
- `packages/fun-chat-call/examples/host-app-snippet.tsx`

## Implementation phases
1. **API & adapter layer**
   - Define `ChatCallAdapter` and package config types.
   - Add provider + `useFunChat()`.
2. **UI bridge extraction**
   - Expose `ChatPanel` + `CallOverlay` from package.
   - Bridge to existing in-repo chat/call UI to preserve behavior.
3. **Logic hooks/services**
   - Add adapter-first hooks/services (`useMessages`, `usePresence`, `useCall`, agora wrappers).
4. **Host integration**
   - Add `src/integrations/funChatCallAdapter.ts` implementation.
   - Wire app root with `FunChatProvider` and package exports.
   - Replace chat route component import with package `ChatPanel`.
5. **Docs & migration notes**
   - README with setup/config/troubleshooting.
   - Migration note listing old vs new imports.

## Safety constraints
- No hardcoded app routes/endpoints inside package API.
- Env/config comes from host via provider config + adapter.
- Keep existing behavior in this app by using bridge components and default adapter implementation.
