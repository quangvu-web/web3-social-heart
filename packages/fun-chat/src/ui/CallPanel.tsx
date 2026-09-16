import type { CallType } from '../config/types';

export function CallPanel(props: {
  enabled: boolean;
  canCall: boolean;
  isInCall: boolean;
  callType: CallType;
  onStartVoice: () => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  if (!props.enabled) return null;

  return (
    <div className="fun-chat-call-panel">
      <span>Call:</span>
      {!props.isInCall ? (
        <>
          <button type="button" onClick={props.onStartVoice} disabled={!props.canCall}>
            Voice
          </button>
          <button type="button" onClick={props.onStartVideo} disabled={!props.canCall}>
            Video
          </button>
        </>
      ) : (
        <>
          <span className="fun-chat-call-state">In {props.callType} call</span>
          <button type="button" onClick={props.onEnd}>
            End call
          </button>
        </>
      )}
    </div>
  );
}