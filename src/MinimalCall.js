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
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    console.log('[MinimalCall] useEffect: token, phoneNumber, agentId', { token, phoneNumber, agentId });
    const device = new Device();
    console.log('[MinimalCall] Device instance created');
    device.setup(token, { debug: true });
    console.log('[MinimalCall] Device setup called');

    device.on("ready", async () => {
      console.log('[MinimalCall] Device ready event');
      setDevice(device);
      setState("ready");
      if (phoneNumber && /^\+\d{8,15}$/.test(phoneNumber) && agentId && !calling) {
        setCalling(true);
        try {
          console.log('[MinimalCall] Posting to /voice', { To: phoneNumber, user_id: agentId });
          const resp = await fetch('/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ To: phoneNumber, user_id: agentId })
          });
          const respText = await resp.text();
          console.log('[MinimalCall] /voice response:', resp.status, respText);
          console.log('[MinimalCall] Calling device.connect');
          device.connect({ To: phoneNumber, user_id: agentId });
        } catch (err) {
          setCalling(false);
          setState("error");
          console.error('[MinimalCall] Error starting call:', err);
        }
      } else {
        console.warn('[MinimalCall] Not auto-calling: missing phoneNumber, agentId, or already calling', { phoneNumber, agentId, calling });
      }
    });

    device.on("connect", connection => {
      console.log('[MinimalCall] Device connect event', connection);
      setConn(connection);
      setState("on_call");
      setCallStart(Date.now());
      setCalling(false);
    });

    device.on("disconnect", () => {
      console.log('[MinimalCall] Device disconnect event');
      setState("ready");
      setConn(null);
      setCallStart(null);
      setTimer(0);
      setIsMuted(false);
      setCalling(false);
      window.close();
    });

    device.on("error", (err) => {
      console.error('[MinimalCall] Device error event:', err);
    });

    device.on("offline", () => {
      console.warn('[MinimalCall] Device offline event');
    });

    return () => {
      console.log('[MinimalCall] Cleaning up device');
      device.destroy();
      setDevice(null);
      setState("offline");
    };
  }, [token, phoneNumber, agentId, calling]);

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
    console.log('[MinimalCall] handleHangup called');
    if (device) device.disconnectAll();
  };

  const toggleMute = () => {
    console.log('[MinimalCall] toggleMute called', { isMuted, conn });
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
        {state === "connecting" && "Loading phone..."}
        {state === "ready" && calling && "Calling..."}
        {state === "on_call" && `On Call ${timer}s`}
        {state === "error" && "Error connecting to call"}
      </div>
      <div className="call-controls">
        <button 
          onClick={toggleMute}
          className={`mute-button ${isMuted ? 'muted' : ''}`}
          disabled={state !== "on_call"}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button 
          onClick={handleHangup}
          className="hangup-button"
          disabled={state !== "on_call"}
        >
          End Call
        </button>
      </div>
    </div>
  );
};

export default MinimalCall; 