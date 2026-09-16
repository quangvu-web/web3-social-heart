import { useFunChat } from '../hooks/useFunChat';
import type { FunChatRendererProps } from '../config/types';

export function ChatPanel(props?: FunChatRendererProps) {
  const { config } = useFunChat();
  const renderer = config.renderers?.ChatPanel;

  if (renderer) return renderer(props);

  return (
    <div className={props?.className}>
      <p>{config.uiText?.emptyStateTitle ?? 'Chat panel is not configured.'}</p>
    </div>
  );
}

