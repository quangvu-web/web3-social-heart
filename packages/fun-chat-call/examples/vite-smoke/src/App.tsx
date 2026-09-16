import {
  ChatPanel,
  CallOverlay,
  FunChatProvider,
  type ChatCallAdapter,
} from '@fun/chat-call';

const adapter: ChatCallAdapter = {
  getAuth: () => ({ userId: 'smoke-user' }),
  fetchAgoraToken: async ({ channelName }) => ({
    appId: 'smoke-app',
    token: 'smoke-token',
    uid: 1,
    channelName,
    expiresAt: Date.now() + 60000,
  }),
  fetchChatHistory: async () => ({ items: [], nextCursor: null }),
  sendMessage: async () => ({ ok: true }),
};

export function App() {
  return (
    <FunChatProvider
      adapter={adapter}
      config={{
        appName: 'Smoke Host',
        renderers: {
          ChatPanel: () => <div>Smoke ChatPanel renderer OK</div>,
          CallOverlay: () => null,
        },
      }}
    >
      <main>
        <h1>Smoke Test: @fun/chat-call</h1>
        <ChatPanel />
        <CallOverlay />
      </main>
    </FunChatProvider>
  );
}
