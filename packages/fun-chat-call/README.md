# @fun/chat-call

Package chat + g?i tho?i/video d?ng tái s? d?ng cho React app.

## Public API
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
  type ChatCallAdapter,
} from '@fun/chat-call';
```

## Adapter b?t bu?c
Host app c?n implement `ChatCallAdapter`:
- `getAuth()`
- `fetchAgoraToken(params)`
- `fetchChatHistory(conversationId, cursor?)`
- `sendMessage(conversationId, payload)`

Tùy ch?n:
- `subscribeRealtime(conversationId, handlers)`
- `uploadAttachment(file)`

## Build package
```bash
cd packages/fun-chat-call
npm install
npm run build
```

K?t qu? build n?m t?i `dist/` g?m:
- `dist/index.mjs`
- `dist/index.cjs`
- `dist/index.d.ts`

## Pack ra tgz
```bash
cd packages/fun-chat-call
npm run pack:local
# ho?c: npm pack
```

File t?o ra d?ng: `fun-chat-call-0.1.0.tgz`.

## Cài vào repo khác t? tgz
```bash
cd /path/to/other-project
npm i /absolute/path/to/packages/fun-chat-call/fun-chat-call-0.1.0.tgz
```

## Smoke test b?ng Vite (dùng tgz)
Ví d? có s?n t?i `examples/vite-smoke`.

### Ch?y smoke test
```bash
cd packages/fun-chat-call
npm run build
npm pack
cd examples/vite-smoke
npm install
npm i ../../fun-chat-call-0.1.0.tgz
npm run dev
```

N?u app Vite ch?y và render ðý?c `ChatPanel` t? package là pass smoke test.

## Troubleshooting
1. Không g?i ðý?c camera/mic:
- Ki?m tra quy?n browser + HTTPS origin.

2. Agora token l?i:
- Verify endpoint trong adapter `fetchAgoraToken`.
- Verify role/channelName/uid theo backend.

3. Không nh?n realtime:
- Ki?m tra adapter `subscribeRealtime` có unsubscribe chu?n.

4. Import l?i `@fun/chat-call`:
- Ki?m tra ðúng phiên b?n tgz và lockfile ð? update.

## Migration note (host app)
- C?: import tr?c ti?p t? `src/modules/chat/pages/Chat`.
- M?i: import `ChatPanel` t? `@fun/chat-call` và truy?n renderer bridge ð? gi? UI c?.
