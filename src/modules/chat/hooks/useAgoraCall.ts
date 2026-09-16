import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  IAgoraRTCRemoteUser,
  UID,
} from 'agora-rtc-sdk-ng';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createAgoraRtcClient, getAgoraRtcToken } from '@/lib/agoraRtc';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallType = 'voice' | 'video';

export interface CallSession {
  id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: CallType;
  status: string;
  channel_name: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
}

export interface RemoteUser {
  uid: UID;
  audioTrack?: any;
  videoTrack?: any;
  hasAudio: boolean;
  hasVideo: boolean;
}

interface UseAgoraCallOptions {
  conversationId?: string;
  userId: string | null;
}

// Call timeout in milliseconds (45 seconds)
const CALL_TIMEOUT_MS = 45000;

export function useAgoraCall({ conversationId, userId }: UseAgoraCallOptions) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('voice');
  const [currentSession, setCurrentSession] = useState<CallSession | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isAutoAnswering, setIsAutoAnswering] = useState(false);

  // Refs
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const callInProgressRef = useRef(false);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoAnswerProcessedRef = useRef<string | null>(null);
  
  // Refs to avoid closure issues in event handlers
  const callStateRef = useRef<CallState>('idle');
  const endCallRef = useRef<(() => Promise<void>) | null>(null);

  // Generate unique channel name
  const generateChannelName = useCallback(() => {
    return `call_${conversationId}_${Date.now()}`;
  }, [conversationId]);

  // Get Agora token from Cloudflare Worker
  const getToken = useCallback(async (channelName: string) => {
    return getAgoraRtcToken(channelName, 'host');
  }, []);

  // Initialize Agora client
  const initClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = createAgoraRtcClient('rtc');
      
      // Event handlers
      clientRef.current.on('user-published', async (user, mediaType) => {
        await clientRef.current?.subscribe(user, mediaType);
        
        setRemoteUsers(prev => {
          const existing = prev.find(u => u.uid === user.uid);
          if (existing) {
            return prev.map(u => 
              u.uid === user.uid 
                ? { 
                    ...u, 
                    [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: user[mediaType === 'audio' ? 'audioTrack' : 'videoTrack'],
                    [mediaType === 'audio' ? 'hasAudio' : 'hasVideo']: true 
                  }
                : u
            );
          }
          return [...prev, {
            uid: user.uid,
            audioTrack: mediaType === 'audio' ? user.audioTrack : undefined,
            videoTrack: mediaType === 'video' ? user.videoTrack : undefined,
            hasAudio: mediaType === 'audio',
            hasVideo: mediaType === 'video',
          }];
        });

        // Play audio track
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      clientRef.current.on('user-unpublished', (user, mediaType) => {
        setRemoteUsers(prev => 
          prev.map(u => 
            u.uid === user.uid 
              ? { 
                  ...u, 
                  [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: undefined,
                  [mediaType === 'audio' ? 'hasAudio' : 'hasVideo']: false 
                }
              : u
          )
        );
      });

      clientRef.current.on('user-left', (user, reason) => {
        console.log('[Agora] Remote user left:', user.uid, 'reason:', reason);
        
        setRemoteUsers(prev => {
          const newUsers = prev.filter(u => u.uid !== user.uid);
          
          // In 1-on-1 calls, if no remote users left, auto-end the call
          if (newUsers.length === 0) {
            // Use setTimeout to avoid state update during render
            setTimeout(() => {
              if (callStateRef.current === 'connected') {
                console.log('[Agora] All remote users left, auto-ending call');
                endCallRef.current?.();
              }
            }, 100);
          }
          
          return newUsers;
        });
      });

      // Listen for connection state changes
      clientRef.current.on('connection-state-change', (curState, prevState, reason) => {
        console.log('[Agora] Connection state:', prevState, '->', curState, 'reason:', reason);
        
        if (curState === 'DISCONNECTED' && reason === 'LEAVE') {
          // Already disconnected, ensure cleanup
          if (callStateRef.current !== 'idle') {
            console.log('[Agora] Disconnected via LEAVE, cleaning up');
            endCallRef.current?.();
          }
        }
      });
    }
    return clientRef.current;
  }, []);

  // Start a call
  const startCall = useCallback(async (type: CallType) => {
    if (!conversationId || !userId) return;
    if (callInProgressRef.current) return;
    callInProgressRef.current = true;

    try {
      // Check DB for existing ringing/active call from the other user
      const { data: existingCall } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('conversation_id', conversationId)
        .in('status', ['ringing', 'active'])
        .neq('initiator_id', userId)
        .maybeSingle();

      if (existingCall) {
        // The other person already called us - answer their call instead
        const typedSession: CallSession = { ...existingCall, call_type: existingCall.call_type as CallType };
        setIncomingCall(typedSession);
        callInProgressRef.current = false;
        return;
      }

      setCallState('calling');
      setCallType(type);

      // CRITICAL: Request media FIRST - must be in direct user gesture context
      let audioTrack: IMicrophoneAudioTrack;
      let videoTrack: ICameraVideoTrack | null = null;
      
      if (type === 'video') {
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        audioTrack = tracks[0];
        videoTrack = tracks[1];
      } else {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      }
      
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      const channelName = generateChannelName();

      // Create call session in database
      const { data: session, error: sessionError } = await supabase
        .from('call_sessions')
        .insert({
          conversation_id: conversationId,
          initiator_id: userId,
          call_type: type,
          status: 'ringing',
          channel_name: channelName,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      
      // Type assertion for the session
      const typedSession: CallSession = {
        ...session,
        call_type: session.call_type as CallType,
      };
      setCurrentSession(typedSession);

      // Add self as participant
      await supabase.from('call_participants').insert({
        call_session_id: session.id,
        user_id: userId,
        joined_at: new Date().toISOString(),
        is_video_off: type === 'voice',
      });

      // Get token and join channel
      const tokenData = await getToken(channelName);
      
      // Cleanup existing client before joining
      if (clientRef.current) {
        try { await clientRef.current.leave(); } catch {}
        clientRef.current = null;
      }
      const client = initClient();
      await client.join(tokenData.appId, channelName, tokenData.token, tokenData.userAccount);

      // Publish pre-created tracks
      if (videoTrack) {
        await client.publish([audioTrack, videoTrack]);
      } else {
        await client.publish(audioTrack);
      }

      setCallState('ringing');

      // Set auto-timeout for missed call
      callTimeoutRef.current = setTimeout(async () => {
        console.log('[Agora] Call timeout - marking as missed');
        try {
          await supabase
            .from('call_sessions')
            .update({ status: 'missed', ended_at: new Date().toISOString() })
            .eq('id', session.id);
          
          toast({
            title: 'Không có phản hồi',
            description: 'Người nhận không trả lời cuộc gọi',
          });
          
          // Cleanup
          localAudioTrackRef.current?.close();
          localVideoTrackRef.current?.close();
          localAudioTrackRef.current = null;
          localVideoTrackRef.current = null;
          await clientRef.current?.leave();
          clientRef.current = null;
          
          setCallState('idle');
          setCurrentSession(null);
        } catch (err) {
          console.error('[Agora] Failed to mark call as missed:', err);
        }
      }, CALL_TIMEOUT_MS);

    } catch (error: any) {
      console.error('Failed to start call:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể bắt đầu cuộc gọi',
        variant: 'destructive',
      });
      // Clean up any created tracks on error
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;
      setCallState('idle');
    } finally {
      callInProgressRef.current = false;
    }
  }, [conversationId, userId, generateChannelName, getToken, initClient, toast]);

  // Answer incoming call
  const answerCall = useCallback(async () => {
    if (!incomingCall || !userId) return;

    try {
      setCallState('connecting');
      setCallType(incomingCall.call_type);
      setCurrentSession(incomingCall);

      // CRITICAL: Request media FIRST - must be in direct user gesture context
      // Browser security requires getUserMedia to be called immediately on user interaction
      let audioTrack: IMicrophoneAudioTrack;
      let videoTrack: ICameraVideoTrack | null = null;
      
      if (incomingCall.call_type === 'video') {
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        audioTrack = tracks[0];
        videoTrack = tracks[1];
      } else {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      }
      
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      // Now perform async operations (token fetch, join channel)
      const tokenData = await getToken(incomingCall.channel_name);
      
      // Cleanup existing client before joining
      if (clientRef.current) {
        try { await clientRef.current.leave(); } catch {}
        clientRef.current = null;
      }
      const client = initClient();
      await client.join(tokenData.appId, incomingCall.channel_name, tokenData.token, tokenData.userAccount);

      // Publish pre-created tracks
      if (videoTrack) {
        await client.publish([audioTrack, videoTrack]);
      } else {
        await client.publish(audioTrack);
      }

      // Add self as participant
      await supabase.from('call_participants').insert({
        call_session_id: incomingCall.id,
        user_id: userId,
        joined_at: new Date().toISOString(),
        is_video_off: incomingCall.call_type === 'voice',
      });

      // Update session status
      await supabase
        .from('call_sessions')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', incomingCall.id);

      setCallState('connected');
      setIncomingCall(null);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

    } catch (error: any) {
      console.error('Failed to answer call:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể trả lời cuộc gọi',
        variant: 'destructive',
      });
      // Clean up any created tracks on error
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;
      setCallState('idle');
    }
  }, [incomingCall, userId, getToken, initClient, toast]);

  // Decline incoming call
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await supabase
        .from('call_sessions')
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', incomingCall.id);

      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  }, [incomingCall]);

  // End call
  const endCall = useCallback(async () => {
    try {
      // Clear call timeout if exists
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      // Stop tracks
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;

      // Leave channel
      await clientRef.current?.leave();
      clientRef.current = null;

      // Update database
      if (currentSession) {
        const endTime = new Date().toISOString();
        await supabase
          .from('call_sessions')
          .update({ 
            status: 'ended',
            ended_at: endTime,
            duration_seconds: callDuration
          })
          .eq('id', currentSession.id);

        await supabase
          .from('call_participants')
          .update({ left_at: endTime })
          .eq('call_session_id', currentSession.id)
          .eq('user_id', userId);
      }

      // Clear timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Reset state
      setCallState('idle');
      setCurrentSession(null);
      setRemoteUsers([]);
      setCallDuration(0);
      setIsMuted(false);
      setIsCameraOff(false);

    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }, [currentSession, callDuration, userId]);

  // Sync refs to avoid closure issues
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (localAudioTrackRef.current) {
      const newMuted = !isMuted;
      await localAudioTrackRef.current.setEnabled(!newMuted);
      setIsMuted(newMuted);

      // Update participant status
      if (currentSession && userId) {
        await supabase
          .from('call_participants')
          .update({ is_muted: newMuted })
          .eq('call_session_id', currentSession.id)
          .eq('user_id', userId);
      }
    }
  }, [isMuted, currentSession, userId]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (localVideoTrackRef.current) {
      const newOff = !isCameraOff;
      await localVideoTrackRef.current.setEnabled(!newOff);
      setIsCameraOff(newOff);

      // Update participant status
      if (currentSession && userId) {
        await supabase
          .from('call_participants')
          .update({ is_video_off: newOff })
          .eq('call_session_id', currentSession.id)
          .eq('user_id', userId);
      }
    }
  }, [isCameraOff, currentSession, userId]);

  // Switch to video (during voice call)
  const switchToVideo = useCallback(async () => {
    if (callType === 'video' || !clientRef.current) return;

    try {
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      localVideoTrackRef.current = videoTrack;
      await clientRef.current.publish(videoTrack);
      setCallType('video');
      setIsCameraOff(false);
    } catch (error) {
      console.error('Failed to switch to video:', error);
    }
  }, [callType]);

  // Handle auto-answer from URL parameter (when accepting call from another page)
  useEffect(() => {
    const answerCallId = searchParams.get('answer');
    
    // Skip if no answer param, no user, already processing, or already answered this call
    if (!answerCallId || !userId || !conversationId || isAutoAnswering) return;
    if (autoAnswerProcessedRef.current === answerCallId) return;
    if (callState !== 'idle') return;

    console.log('[Agora] Auto-answer triggered for call:', answerCallId);
    autoAnswerProcessedRef.current = answerCallId;
    
    const autoAnswerCall = async () => {
      try {
        setIsAutoAnswering(true);
        
        // Fetch the call session from database
        const { data: session, error } = await supabase
          .from('call_sessions')
          .select('*')
          .eq('id', answerCallId)
          .eq('conversation_id', conversationId)
          .eq('status', 'ringing')
          .single();

        if (error || !session) {
          console.log('[Agora] Call session not found or not ringing:', error?.message);
          // Clear the URL parameter
          setSearchParams({}, { replace: true });
          setIsAutoAnswering(false);
          return;
        }

        console.log('[Agora] Found call session, auto-answering:', session.id);
        
        // Set the incoming call and trigger answer
        const typedSession: CallSession = {
          ...session,
          call_type: session.call_type as CallType,
        };
        
        // Set incoming call first
        setIncomingCall(typedSession);
        
        // Clear the URL parameter
        setSearchParams({}, { replace: true });
        
        // Small delay to ensure state is updated, then answer
        setTimeout(async () => {
          // Now manually trigger the answer logic since we have the session
          try {
            setCallState('connecting');
            setCallType(typedSession.call_type);
            setCurrentSession(typedSession);

            // Request media
            let audioTrack: IMicrophoneAudioTrack;
            let videoTrack: ICameraVideoTrack | null = null;
            
            if (typedSession.call_type === 'video') {
              const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
              audioTrack = tracks[0];
              videoTrack = tracks[1];
            } else {
              audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            }
            
            localAudioTrackRef.current = audioTrack;
            localVideoTrackRef.current = videoTrack;

            // Get token and join
            const tokenData = await getToken(typedSession.channel_name);
            // Cleanup existing client before joining
            if (clientRef.current) {
              try { await clientRef.current.leave(); } catch {}
              clientRef.current = null;
            }
            const client = initClient();
            await client.join(tokenData.appId, typedSession.channel_name, tokenData.token, tokenData.userAccount);

            // Publish tracks
            if (videoTrack) {
              await client.publish([audioTrack, videoTrack]);
            } else {
              await client.publish(audioTrack);
            }

            // Add self as participant
            await supabase.from('call_participants').insert({
              call_session_id: typedSession.id,
              user_id: userId,
              joined_at: new Date().toISOString(),
              is_video_off: typedSession.call_type === 'voice',
            });

            // Update session status
            await supabase
              .from('call_sessions')
              .update({ 
                status: 'active',
                started_at: new Date().toISOString()
              })
              .eq('id', typedSession.id);

            setCallState('connected');
            setIncomingCall(null);
            setIsAutoAnswering(false);

            // Start duration timer
            durationIntervalRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 1000);

            console.log('[Agora] Auto-answer successful, connected!');
          } catch (err: any) {
            console.error('[Agora] Auto-answer failed:', err);
            toast({
              title: 'Lỗi',
              description: err.message || 'Không thể trả lời cuộc gọi',
              variant: 'destructive',
            });
            // Cleanup
            localAudioTrackRef.current?.close();
            localVideoTrackRef.current?.close();
            localAudioTrackRef.current = null;
            localVideoTrackRef.current = null;
            setCallState('idle');
            setIsAutoAnswering(false);
          }
        }, 100);
        
      } catch (err) {
        console.error('[Agora] Auto-answer error:', err);
        setSearchParams({}, { replace: true });
        setIsAutoAnswering(false);
      }
    };

    autoAnswerCall();
  }, [searchParams, userId, conversationId, callState, isAutoAnswering, getToken, initClient, toast, setSearchParams]);

  // Subscribe to incoming calls via realtime
  useEffect(() => {
    if (!userId || !conversationId) return;

    const channel = supabase
      .channel(`calls-${conversationId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_sessions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const session = payload.new as any;
          // Don't show incoming call if we initiated it
          if (session.initiator_id !== userId && session.status === 'ringing') {
            const typedSession: CallSession = {
              ...session,
              call_type: session.call_type as CallType,
            };
            setIncomingCall(typedSession);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_sessions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const session = payload.new as any;
          console.log('[Agora] Realtime session update:', session.id, session.status);
          
          // If call became active and we're the caller, update state
          if (currentSession?.id === session.id) {
            if (session.status === 'active' && callState === 'ringing') {
              // Clear the timeout since call was answered
              if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = null;
              }
              
              setCallState('connected');
              durationIntervalRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
              }, 1000);
            }
            // If call was declined/missed/ended
            if (['declined', 'missed', 'ended'].includes(session.status) && callState !== 'idle') {
              console.log('[Agora] Session ended via realtime, cleaning up');
              // Clear the timeout
              if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = null;
              }
              endCall();
            }
          }

          // If incoming call was cancelled
          if (incomingCall?.id === session.id && ['ended', 'declined', 'missed'].includes(session.status)) {
            setIncomingCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, conversationId, currentSession, callState, incomingCall, endCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      clientRef.current?.leave();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
    };
  }, []);

  // Flip camera (switch between front/back)
  const flipCamera = useCallback(async () => {
    if (!localVideoTrackRef.current) return false;

    try {
      const cameras = await AgoraRTC.getCameras();
      if (cameras.length < 2) return false;

      const currentLabel = localVideoTrackRef.current.getTrackLabel();
      const currentIndex = cameras.findIndex(c => c.label === currentLabel);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextDevice = cameras[nextIndex];

      await localVideoTrackRef.current.setDevice(nextDevice.deviceId);
      return true;
    } catch (error) {
      console.error('[Agora] Failed to flip camera:', error);
      return false;
    }
  }, []);

  return {
    // State
    callState,
    callType,
    currentSession,
    remoteUsers,
    isMuted,
    isCameraOff,
    incomingCall,
    callDuration,
    localVideoTrack: localVideoTrackRef.current,
    localAudioTrack: localAudioTrackRef.current,
    
    // Actions
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchToVideo,
    flipCamera,
  };
}
