import type { AgoraTokenRequest, AgoraTokenResponse } from '../config/types';

export async function fetchAgoraToken(options: {
  endpoint: string;
  headers?: Record<string, string>;
  payload: AgoraTokenRequest;
}): Promise<AgoraTokenResponse> {
  const response = await fetch(options.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(options.payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.token) {
    throw new Error(data?.error || 'Failed to fetch Agora token');
  }

  return data as AgoraTokenResponse;
}