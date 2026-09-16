import type { ChatCallAdapter } from '../adapters/ChatCallAdapter';
import type { AgoraTokenParams } from '../config/types';

export async function fetchAgoraToken(adapter: ChatCallAdapter, params: AgoraTokenParams) {
  return adapter.fetchAgoraToken(params);
}

