# @fun/chat

Reusable chat module for React apps with Supabase realtime messaging and optional Agora calls.

## Install

```bash
npm i @fun/chat @supabase/supabase-js @tanstack/react-query agora-rtc-sdk-ng
```

## Quickstart

```tsx
import { FunChatProvider, FunChatApp, type FunChatConfig } from '@fun/chat';

const config: FunChatConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  agoraAppId: import.meta.env.VITE_AGORA_APP_ID,
  tokenEndpoint: import.meta.env.VITE_AGORA_TOKEN_ENDPOINT,
  tokenEndpointHeaders: {
    'x-api-key': import.meta.env.VITE_AGORA_TOKEN_API_KEY,
  },
  features: {
    calls: true,
    attachments: false,
    reactions: true,
    readReceipts: true,
  },
};

export default function App() {
  return (
    <FunChatProvider config={config}>
      <FunChatApp />
    </FunChatProvider>
  );
}
```

`@fun/chat` already loads its default styles from the main entry.  
Optional: import `@fun/chat/styles.css` only if you want explicit style control.

## Config

`FunChatProvider` supports either:
- `supabaseClient` (pre-existing client), or
- `supabaseUrl` + `supabaseAnonKey`.

If both are present, `supabaseClient` is used.

## Backend requirements

- SQL migration: `supabase/migrations/0001_fun_chat_core.sql`
- Token endpoint + env vars: `docs/BACKEND_REQUIREMENTS.md`

## Build package

```bash
cd packages/fun-chat
npm install
npm run build
```

## Pack `.tgz`

```bash
cd packages/fun-chat
npm run pack:local
```

## Local install from tgz

```bash
npm i /absolute/path/to/fun-chat-0.1.0.tgz
```
