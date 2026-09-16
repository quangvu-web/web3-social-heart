import { FunChatApp, FunChatProvider, type FunChatConfig } from '@fun/chat';

const config: FunChatConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  agoraAppId: import.meta.env.VITE_AGORA_APP_ID,
  tokenEndpoint: import.meta.env.VITE_AGORA_TOKEN_ENDPOINT,
  tokenEndpointHeaders: import.meta.env.VITE_AGORA_TOKEN_API_KEY
    ? { 'x-api-key': import.meta.env.VITE_AGORA_TOKEN_API_KEY }
    : undefined,
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
