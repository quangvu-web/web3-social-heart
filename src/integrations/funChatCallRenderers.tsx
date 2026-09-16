import Chat from '@/modules/chat/pages/Chat';
import { IncomingCallDialog } from '@/modules/chat/components/IncomingCallDialog';
import { useGlobalCall } from '@/contexts/CallContext';

export function HostChatPanelRenderer() {
  return <Chat />;
}

export function HostCallOverlayRenderer() {
  const { incomingCall, answerCall, declineCall } = useGlobalCall();

  return (
    <IncomingCallDialog
      callSession={incomingCall}
      onAnswer={answerCall}
      onDecline={declineCall}
    />
  );
}
