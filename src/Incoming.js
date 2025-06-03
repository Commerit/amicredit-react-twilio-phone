import React, { useEffect, useRef } from "react";
import "./Incoming.css";

const ringtoneUrl = "https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.ogg";

const Incoming = ({ connection, device, caller, onClear, onAcceptUI }) => {
  const audioRef = useRef();

  useEffect(() => {
    console.log('[Incoming] Incoming modal mounted', connection);
    const audio = audioRef.current;
    if (audio) {
      audio.play();
    }
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      console.log('[Incoming] Incoming modal unmounted', connection);
    };
  }, [connection]);

  const acceptConnection = () => {
    console.log('[Incoming] Accepting inbound connection', connection);
    if (typeof onAcceptUI === 'function') {
      console.log('[Incoming] Calling onAcceptUI to trigger instant ON_CALL UI');
      onAcceptUI();
    }
    connection.accept();
  };
  const rejectConnection = () => {
    console.log('[Incoming] Rejecting inbound connection', connection);
    connection.reject();
    if (onClear) onClear();
  };
  return (
    <div className="incoming-overlay">
      <audio ref={audioRef} src={ringtoneUrl} loop autoPlay />
      <div className="incoming-modal">
        <div className="incoming-title">Incoming Call</div>
        <div className="incoming-number">{caller || "Unknown"}</div>
        <div className="incoming-actions">
          <button className="accept-btn" onClick={acceptConnection}>
            <span role="img" aria-label="accept">✅</span> Accept
          </button>
          <button className="decline-btn" onClick={rejectConnection}>
            <span role="img" aria-label="decline">❌</span> Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default Incoming;
