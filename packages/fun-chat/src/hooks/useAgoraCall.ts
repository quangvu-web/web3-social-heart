import AgoraRTC, { type IAgoraRTCClient, type UID } from 'agora-rtc-sdk-ng';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CallType } from '../config/types';
import { fetchAgoraToken } from '../services/tokenFetcher';
import { useFunChat } from './useFunChat';

export function useAgoraCall(conversationId: string | null) {
  const { client, config, user, features } = useFunChat();
  const rtcRef = useRef<IAgoraRTCClient | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState<CallType>('voice');
  const [channelName, setChannelName] = useState<string | null>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);

  const canCall = useMemo(() => Boolean(features.calls && config.agoraAppId && config.tokenEndpoint), [features.calls, config]);

  const ensureClient = useCallback(() => {
    if (!rtcRef.current) {
      rtcRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    }
    return rtcRef.current;
  }, []);

  const startCall = useCallback(
    async (type: CallType) => {
      if (!conversationId) throw new Error('No conversation selected');
      if (!user?.id) throw new Error('Not authenticated');
      if (!canCall) throw new Error('Calls are disabled or not configured');

      const channel = `chat_${conversationId.replace(/-/g, '').slice(0, 24)}`;
      const tokenResult = await fetchAgoraToken({
        endpoint: config.tokenEndpoint as string,
        headers: config.tokenEndpointHeaders,
        payload: {
          channel,
          userAccount: user.id,
          role: 'publisher',
          expireSeconds: 3600,
        },
      });

      const rtc = ensureClient();
      const uid = user.id as UID;
      await rtc.join(config.agoraAppId as string, channel, tokenResult.token, uid);

      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;
      await rtc.publish([audioTrack, videoTrack]);

      await client.from('call_sessions').insert({
        conversation_id: conversationId,
        initiator_id: user.id,
        call_type: type,
        status: 'ringing',
        channel_name: channel,
        started_at: new Date().toISOString(),
      });

      setCallType(type);
      setChannelName(channel);
      setIsInCall(true);
    },
    [canCall, client, config.agoraAppId, config.tokenEndpoint, config.tokenEndpointHeaders, conversationId, ensureClient, user?.id]
  );

  const endCall = useCallback(async () => {
    const rtc = rtcRef.current;
    if (rtc) {
      localAudioTrackRef.current?.stop?.();
      localAudioTrackRef.current?.close?.();
      localVideoTrackRef.current?.stop?.();
      localVideoTrackRef.current?.close?.();
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;
      await rtc.leave();
      rtcRef.current = null;
    }

    if (conversationId && user?.id) {
      await client
        .from('call_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('initiator_id', user.id)
        .in('status', ['ringing', 'active']);
    }

    setIsInCall(false);
    setChannelName(null);
  }, [client, conversationId, user?.id]);

  return {
    canCall,
    isInCall,
    callType,
    channelName,
    startCall,
    endCall,
  };
}
