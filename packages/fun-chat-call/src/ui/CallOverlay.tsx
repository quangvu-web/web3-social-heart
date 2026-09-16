import { useFunChat } from '../hooks/useFunChat';
import type { FunChatRendererProps } from '../config/types';

export function CallOverlay(props?: FunChatRendererProps) {
  const { config } = useFunChat();
  const renderer = config.renderers?.CallOverlay;

  if (renderer) return renderer(props);

  return null;
}

