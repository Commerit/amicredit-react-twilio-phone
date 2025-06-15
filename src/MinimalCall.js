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
    const device = new Device();
    device.setup(token, { debug: true });

    device.on("ready", async () => {
      setDevice(device);
      setState("ready");
      if (phoneNumber && /^\+\d{8,15}$/.test(phoneNumber) && agentId && !calling) {
        setCalling(true);
        try {
          await fetch('/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ To: phoneNumber, user_id: agentId })
          });
          device.connect({ To: phoneNumber, user_id: agentId });
        } catch (err) {
          setCalling(false);
          setState("error");
          console.error('Error starting call:', err);
        }
      }
    });

    device.on("connect", connection => {
      setConn(connection);
      setState("on_call");
      setCallStart(Date.now());
      setCalling(false);
    });

    device.on("disconnect", () => {
      setState("ready");
      setConn(null);
      setCallStart(null);
      setTimer(0);
      setIsMuted(false);
      setCalling(false);
      window.close();
    });

    return () => {
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
    if (device) device.disconnectAll();
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