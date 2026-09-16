import AgoraRTC, { type IAgoraRTCClient } from 'agora-rtc-sdk-ng';

export function createAgoraClient(mode: 'rtc' | 'live' = 'rtc', codec: 'vp8' | 'h264' = 'vp8') {
  return AgoraRTC.createClient({ mode, codec });
}

export async function joinAgoraClient(
  client: IAgoraRTCClient,
  appId: string,
  channelName: string,
  token: string,
  uid: string | number
) {
  return client.join(appId, channelName, token, uid);
}

export async function leaveAgoraClient(client: IAgoraRTCClient) {
  await client.leave();
}

