import { useCallback, useState } from 'react';
import { useFunChat } from './useFunChat';
import { fetchAgoraToken } from '../services/tokenFetcher';
import { createRtcStateStore, type RtcCallStateStore } from '../services/rtcState';

export function useCall() {
  const { adapter } = useFunChat();
  const [state, setState] = useState<RtcCallStateStore>(() => createRtcStateStore());

  const requestToken = useCallback(
    async (channelName: string, role: 'host' | 'audience' | 'publisher' | 'subscriber') => {
      setState((prev) => ({ ...prev, status: 'connecting' }));
      try {
        const token = await fetchAgoraToken(adapter, { channelName, role });
        setState((prev) => ({ ...prev, status: 'connected', token }));
        return token;
      } catch (error) {
        setState((prev) => ({ ...prev, status: 'error', error }));
        throw error;
      }
    },
    [adapter]
  );

  const resetCallState = useCallback(() => {
    setState(createRtcStateStore());
  }, []);

  return {
    state,
    requestToken,
    resetCallState,
  };
}

