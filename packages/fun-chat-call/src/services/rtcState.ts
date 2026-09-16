import type { AgoraTokenResult } from '../config/types';

export type RtcCallStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface RtcCallStateStore {
  status: RtcCallStatus;
  token: AgoraTokenResult | null;
  error: unknown | null;
}

export function createRtcStateStore(): RtcCallStateStore {
  return {
    status: 'idle',
    token: null,
    error: null,
  };
}

