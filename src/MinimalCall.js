import React, { useState, useEffect, useRef } from "react";
import { Device } from "twilio-client";
import "./MinimalCall.css";

const MinimalCall = ({ token, phoneNumber, agentId }) => {
  const [state, setState] = useState("connecting");
  const [conn, setConn] = useState(null);
  const [device, setDevice] = useState(null);
  const [callStart, setCallStart] = useState(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef();
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const device = new Device();
    device.setup(token, { debug: true });

    device.on("ready", async () => {
      setDevice(device);
      setState("ready");
      if (phoneNumber) {
        // Pre-notify server so pending_calls has user_id
        try {
          await fetch('/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ To: phoneNumber, user_id: agentId })
          });
        } catch (e) {
          console.error('[MinimalCall] /voice pre-call failed', e);
        }
        // Now initiate call without user_id param to avoid duplicate insert
        device.connect({ To: phoneNumber });
      }
    });

    device.on("connect", connection => {
      setConn(connection);
      setState("on_call");
      setCallStart(Date.now());
    });

    device.on("disconnect", () => {
      setState("ready");
      setConn(null);
      setCallStart(null);
      setTimer(0);
      setIsMuted(false);
      window.close();
    });

    return () => {
      device.destroy();
      setDevice(null);
      setState("offline");
    };
  }, [token, phoneNumber, agentId]);

  useEffect(() => {
    if (state === "on_call" && callStart) {
      timerRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - callStart) / 1000));
      }, 1000);
      return () => clearInterval(timerRef.current);
    } else {
      setTimer(0);
      clearInterval(timerRef.current);
    }
  }, [state, callStart]);

  const handleHangup = () => {
    device.disconnectAll();
  };

  const toggleMute = () => {
    if (conn) {
      if (isMuted) {
        conn.mute(false);
        setIsMuted(false);
      } else {
        conn.mute(true);
        setIsMuted(true);
      }
    }
  };

  return (
    <div className="minimal-call-container">
      <div className="call-status">
        {state === "connecting" && "Connecting..."}
        {state === "ready" && "Ready"}
        {state === "on_call" && `On Call ${timer}s`}
      </div>
      <div className="call-controls">
        <button 
          onClick={toggleMute}
          className={`mute-button ${isMuted ? 'muted' : ''}`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button 
          onClick={handleHangup}
          className="hangup-button"
        >
          End Call
        </button>
      </div>
    </div>
  );
};

export default MinimalCall; 
