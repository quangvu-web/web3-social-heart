import { FunChatProvider, ChatPanel, CallOverlay, type ChatCallAdapter } from '@fun/chat-call';

const adapter: ChatCallAdapter = {
  getAuth: async () => ({ userId: 'user-id' }),
  fetchAgoraToken: async ({ channelName, role }) => ({
    appId: 'agora-app-id',
    token: 'agora-token',
    uid: 1,
    channelName,
    expiresAt: Date.now() + 60_000,
  }),
  fetchChatHistory: async () => ({ items: [], nextCursor: null }),
  sendMessage: async () => ({ ok: true }),
};

export function HostAppSnippet() {
  return (
    <FunChatProvider
      adapter={adapter}
      config={{
        appName: 'My Host App',
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
