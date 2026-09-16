# FUN CHAT CALL - ALL IN ONE INTEGRATION GUIDE

Tai lieu 1 file `.md` de chia se nhanh tinh nang chat + goi dien cho React host app.

## 1) Muc tieu va doi tuong dung
- Dung cho dev nhan 1 file duy nhat, khong can mo `.tgz/.zip`.
- Muc tieu: tich hop nhanh `@fun/chat-call` vao app React co san.
- Uu tien backend Supabase + Agora day du.

### Khi nao dung `@fun/chat-call` thay vi `@fun/chat`
- Dung `@fun/chat-call` khi can dong goi theo adapter, tai su dung UI host app, va mo rong call flow linh hoat.
- Dung `@fun/chat` khi muon mot chat module full UI co san theo schema package do.

## 2) Package muc tieu
- Package: `@fun/chat-call`
- Version hien tai trong repo: `0.1.0`
- Vi tri: `packages/fun-chat-call`

## 3) Public API contract (khop code hien tai)

### Exports
```ts
import {
  FunChatProvider,
  ChatPanel,
  CallOverlay,
  useFunChat,
  useMessages,
  usePresence,
  useCall,
  type FunChatConfig,
  type FunChatUiText,
  type FunChatRenderers,
  type AgoraTokenParams,
  type AgoraTokenResult,
  type MessagePayload,
  type MessageCursorPage,
  type RealtimeSubscription,
  type ChatCallAdapter,
  type ChatCallAuth,
} from '@fun/chat-call';
```

### `FunChatConfig`
```ts
interface FunChatConfig {
  appName?: string;
  basePath?: string;
  debug?: boolean;
  uiText?: {
    emptyStateTitle?: string;
    loadingText?: string;
  };
  renderers?: {
    ChatPanel?: (props?: { className?: string }) => ReactElement;
    CallOverlay?: (props?: { className?: string }) => ReactElement;
  };
  onError?: (error: unknown) => void;
  onNavigate?: (path: string) => void;
}
```

### `ChatCallAdapter` (bat buoc + tuy chon)
```ts
interface ChatCallAdapter {
  // Bat buoc
  getAuth: () => Promise<{ userId: string | null; accessToken?: string | null }> | { userId: string | null; accessToken?: string | null };
  fetchAgoraToken: (params: {
    channelName: string;
    role: 'host' | 'audience' | 'publisher' | 'subscriber';
    uid?: string | number;
  }) => Promise<{
    token: string;
    appId: string;
    uid: string | number;
    channelName: string;
    expiresAt?: number;
  }>;
  fetchChatHistory: <TMessage = unknown>(conversationId: string, cursor?: string | null) => Promise<{
    items: TMessage[];
    nextCursor: string | null;
  }>;
  sendMessage: (conversationId: string, payload: {
    content?: string;
    mediaUrls?: Array<{ url: string; type: 'image' | 'video' | 'audio' | 'file' }>;
    replyToId?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<unknown>;

  // Tuy chon
  subscribeRealtime?: (
    conversationId: string,
    handlers: {
      onMessage?: (message: unknown) => void;
      onMessageUpdated?: (message: unknown) => void;
      onMessageDeleted?: (messageId: string) => void;
      onTyping?: (payload: unknown) => void;
    }
  ) => { unsubscribe: () => void };

  uploadAttachment?: (file: File) => Promise<{ url: string; type?: string }>;
}
```

## 4) Kien truc tich hop host app

### Luong tong quat
`Host App -> FunChatProvider(config + adapter) -> ChatPanel/CallOverlay -> adapter -> Supabase/Agora`

### Renderer bridge
- `ChatPanel` se goi `config.renderers.ChatPanel` neu co.
- `CallOverlay` se goi `config.renderers.CallOverlay` neu co.
- Neu khong truyen renderer, `ChatPanel` hien empty state, `CallOverlay` tra `null`.

### Mapping trach nhiem
- Auth/session: `adapter.getAuth()`
- Message paging: `adapter.fetchChatHistory(conversationId, cursor)`
- Gui tin: `adapter.sendMessage(...)`
- Realtime: `adapter.subscribeRealtime(...)` (optional)
- Token call: `adapter.fetchAgoraToken(...)`

## 5) Cai dat tu `.tgz` (khuyen nghi cho chia se)

### Build va pack package
```bash
cd packages/fun-chat-call
npm install
npm run build
npm run pack:local
```

File tao ra: `packages/fun-chat-call/fun-chat-call-0.1.0.tgz`

### Cai vao project dich
```bash
cd /path/to/other-project
npm i /absolute/path/to/packages/fun-chat-call/fun-chat-call-0.1.0.tgz
```

### Peer dependencies can co trong host app
```bash
npm i react react-dom react-router-dom @tanstack/react-query agora-rtc-sdk-ng
```

## 6) Mau tich hop toi thieu (host app)
```tsx
import {
  FunChatProvider,
  ChatPanel,
  CallOverlay,
  type ChatCallAdapter,
} from '@fun/chat-call';

const adapter: ChatCallAdapter = {
  getAuth: async () => ({ userId: 'demo-user-id' }),
  fetchAgoraToken: async ({ channelName }) => ({
    token: 'agora-token',
    appId: 'agora-app-id',
    uid: 1,
    channelName,
    expiresAt: Date.now() + 60_000,
  }),
  fetchChatHistory: async () => ({ items: [], nextCursor: null }),
  sendMessage: async () => ({ ok: true }),
};

export default function HostApp() {
  return (
    <FunChatProvider
      adapter={adapter}
      config={{
        appName: 'My Host App',
        uiText: { emptyStateTitle: 'Chat panel is not configured.' },
        renderers: {
          ChatPanel: () => <div>My Chat UI</div>,
          CallOverlay: () => <div />,
        },
      }}
    >
      <ChatPanel />
      <CallOverlay />
    </FunChatProvider>
  );
}
```

## 7) Mau adapter Supabase + Agora (tham chieu theo repo nay)
- Adapter thuc te: `src/integrations/funChatCallAdapter.ts`
- Renderer bridge thuc te: `src/integrations/funChatCallRenderers.tsx`

### Ghi chu adapter hien tai
- `fetchChatHistory` doc bang `messages`, paging theo `cursor` -> `pageIndex`.
- `sendMessage` insert vao `messages` voi: `conversation_id`, `sender_id`, `content`, `media_urls`, `reply_to_id`, `metadata`.
- `subscribeRealtime` lang nghe `INSERT/UPDATE/DELETE` tren `messages` theo `conversation_id`.
- `uploadAttachment` upload len Supabase Storage bucket `chat-media`.
- `fetchAgoraToken` map qua ham backend lay token Agora.

## 8) Backend requirements (Supabase + Agora day du)

### Supabase toi thieu cho message flow
Can co bang `messages` va cac cot duoc adapter su dung:
- `id`
- `conversation_id`
- `sender_id`
- `content`
- `media_urls`
- `reply_to_id`
- `metadata` (neu host luu metadata)
- `created_at`

Can bat realtime cho bang `messages` de `subscribeRealtime` nhan event.

### Storage (optional)
Neu su dung `uploadAttachment`:
- Bucket: `chat-media`
- Policy cho phep user upload + doc URL theo quy tac app.

### Agora token endpoint contract
Input (`AgoraTokenParams`):
- `channelName`
- `role`
- `uid` (optional)

Output (`AgoraTokenResult`):
- `token`
- `appId`
- `uid`
- `channelName`
- `expiresAt` (optional)

### Env checklist toi thieu (goi y)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AGORA_APP_ID`
- `VITE_AGORA_TOKEN_ENDPOINT` (neu token lay qua HTTP endpoint)

## 9) Hooks behavior can nho
- `useFunChat()`: lay `config` va `adapter` tu context.
- `useMessages(conversationId, cursor?)`: query chat history qua adapter.
- `usePresence(conversationId)`: can `subscribeRealtime`; tra ve state typing/message/update/delete gan nhat.
- `useCall()`: quan ly token call state (`idle` -> `connecting` -> `connected` hoac `error`), co `resetCallState()`.

## 10) Troubleshooting + failure modes
1. `userId` null trong `getAuth`
- Kiem tra session auth host app.
- Kiem tra token han hoac logout state.

2. Loi Agora token / token het han
- Kiem tra payload `channelName`, `role`, `uid`.
- Kiem tra backend ky token va thoi gian `expiresAt`.

3. Khong nhan realtime messages
- Kiem tra da bat realtime cho bang `messages`.
- Kiem tra filter `conversation_id` va callback `subscribeRealtime`.

4. Upload attachment that bai
- Kiem tra bucket `chat-media` ton tai.
- Kiem tra policy `insert/select` cho user.
- Kiem tra MIME type va dung luong file.

5. Paging sai (`nextCursor`)
- Kiem tra quy uoc cursor (page index hay cursor string).
- Kiem tra thu tu sort message o backend co on dinh.

## 11) Quick verification checklist
1. Cai duoc package tu `.tgz`, import `FunChatProvider`, `ChatPanel`, `CallOverlay` khong loi.
2. Adapter mock render duoc `ChatPanel` khong crash.
3. Adapter that voi Supabase:
- `fetchChatHistory` tra ve `items + nextCursor` dung.
- `sendMessage` insert thanh cong.
- Message moi ve realtime khi co `subscribeRealtime`.
4. Call flow:
- `useCall().requestToken()` lay duoc token.
- Khi token loi, state chuyen `error`.
5. Optional paths:
- Khong co `subscribeRealtime`: app van chay (khong co live update).
- Khong co `uploadAttachment`: text-only chat van hoat dong.

## 12) Acceptance criteria cho goi chia se
- 1 file `FUN_CHAT_ALL_IN_ONE.md` la du de dev khac tich hop.
- Noi dung khop API package `@fun/chat-call` hien tai.
- Co du setup, backend checklist, troubleshoot, verification checklist.

## 13) Pham vi va gioi han
- Tai lieu nay khong dump full source package.
- Tai lieu nay khong thay doi API/package code hien tai.
- UI/UX cuoi cung phu thuoc renderer bridge cua host app.
