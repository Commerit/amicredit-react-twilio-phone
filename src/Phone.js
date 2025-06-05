import React, { useState, useEffect, useRef } from "react";
import { Device } from "twilio-client";
import Dialler from "./Dialler";
import KeypadButton from "./KeypadButton";
import Incoming from "./Incoming";
import OnCall from "./OnCall";
import "./Phone.css";
import states from "./states";
import { useAuth } from "./AuthContext";

const Phone = ({ token, initialNumber = "", setNumberInUrl }) => {
  const [state, setState] = useState(states.CONNECTING);
  const [number, setNumber] = useState(initialNumber);
  const [conn, setConn] = useState(null);
  const [device, setDevice] = useState(null);
  const [callStart, setCallStart] = useState(null);
  const [ringStart, setRingStart] = useState(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef();
  const [isMuted, setIsMuted] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setNumber(initialNumber);
  }, [initialNumber]);

  useEffect(() => {
    if (setNumberInUrl) setNumberInUrl(number);
    // eslint-disable-next-line
  }, [number]);

  useEffect(() => {
    console.log('[Phone] Initializing Twilio Device with token:', token);
    const device = new Device();
    device.setup(token, { debug: true });

    device.on("ready", () => {
      console.log('[Phone] Device ready');
      setDevice(device);
      setState(states.READY);
    });
    device.on("connect", connection => {
      console.log('[Phone] Device connect event', connection);
      setConn(connection);
      setState(states.ON_CALL);
      setCallStart(Date.now());
      setRingStart(null);
    });
    device.on("disconnect", () => {
      console.log('[Phone] Device disconnect event');
      setState(states.READY);
      setConn(null);
      setCallStart(null);
      setTimer(0);
      setIsMuted(false);
    });
    device.on("incoming", connection => {
      console.log('[Phone] Device incoming event', connection);
      setState(states.INCOMING);
      setConn(connection);
      setRingStart(Date.now());
      setCallStart(null);
      connection.on("reject", () => {
        console.log("[Twilio] Incoming connection rejected");
        setState(states.READY);
        setConn(null);
        setRingStart(null);
      });
      connection.on("accept", () => {
        console.log("[Twilio] Inbound call accepted, transitioning to ON_CALL");
        setState(states.ON_CALL);
        setConn(connection);
        setCallStart(Date.now());
        setRingStart(null);
      });
      connection.on("disconnect", () => {
        console.log("[Twilio] Inbound connection disconnected");
      });
    });
    device.on("cancel", () => {
      console.log('[Phone] Device cancel event');
      setState(states.READY);
      setConn(null);
      setRingStart(null);
    });
    device.on("reject", () => {
      console.log('[Phone] Device reject event');
      setState(states.READY);
      setConn(null);
      setRingStart(null);
    });

    return () => {
      console.log('[Phone] Destroying Twilio Device');
      device.destroy();
      setDevice(null);
      setState(states.OFFLINE);
    };
  }, [token]);

  // Timer logic
  useEffect(() => {
    console.log('[Phone] Timer effect: state =', state, 'callStart =', callStart, 'ringStart =', ringStart);
    if (state === states.ON_CALL && callStart) {
      timerRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - callStart) / 1000));
      }, 1000);
      return () => clearInterval(timerRef.current);
    } else if (state === states.INCOMING && ringStart) {
      timerRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - ringStart) / 1000));
      }, 1000);
      return () => clearInterval(timerRef.current);
    } else {
      setTimer(0);
      clearInterval(timerRef.current);
    }
  }, [state, callStart, ringStart]);

  const handleCall = async () => {
    console.log('[Phone] handleCall called', { device, number, user });
    if (device && number && /^\+\d{8,15}$/.test(number) && user) {
      // POST to /voice to log the pending call
      await fetch('/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ To: number, user_id: user.id })
      });
      device.connect({ To: number, user_id: user.id });
    }
  };

  const handleHangup = () => {
    console.log('[Phone] handleHangup called');
    device.disconnectAll();
  };

  const toggleMute = () => {
    console.log('[Phone] toggleMute called', { isMuted, conn });
    if (conn) {
      if (isMuted) {
        conn.mute(false); // Unmute
        setIsMuted(false);
      } else {
        conn.mute(true); // Mute
        setIsMuted(true);
      }
    }
  };

  // Handler for instant UI transition on Accept
  const handleAcceptUI = () => {
    console.log('[Phone] handleAcceptUI called', { conn, state });
    if (conn) {
      console.log('[Phone] handleAcceptUI: User accepted call, transitioning to ON_CALL immediately');
      setState(states.ON_CALL);
      setCallStart(Date.now());
      setRingStart(null);
    } else {
      console.warn('[Phone] handleAcceptUI: conn is null');
    }
  };

  // Log what is being rendered
  console.log('[Phone] Render: state =', state, 'conn =', conn, 'number =', number);

  let render;
  if (conn && state === states.INCOMING) {
    const caller = (conn.parameters && (conn.parameters.From || conn.parameters.Caller)) || "Unknown";
    console.log('[Phone] Rendering Incoming UI', { caller, timer });
    render = (
      <div className="call-screen">
        <div className="call-number">{number}</div>
        <div className="call-status">Ringing... {timer}s</div>
        <Incoming device={device} connection={conn} caller={caller} onAcceptUI={handleAcceptUI} />
      </div>
    );
  } else if (conn && state === states.ON_CALL) {
    console.log('[Phone] Rendering OnCall UI', { timer, number });
    render = (
      <div className="call-screen">
        <div className="call-number">{number}</div>
        <div className="call-status">On Call {timer}s</div>
        <OnCall handleHangup={handleHangup} connection={conn} />
        <button onClick={toggleMute} style={{ margin: '12px', padding: '10px 20px', borderRadius: 6, background: isMuted ? '#e65c00' : '#eee', color: isMuted ? '#fff' : '#222', fontWeight: 600 }}>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    );
  } else {
    console.log('[Phone] Rendering Dialler UI', { number });
    render = (
      <>
        <Dialler number={number} setNumber={setNumber} />
        <div className="call">
          <KeypadButton
            handleClick={handleCall}
            color="green"
            disabled={!/^\+\d{8,15}$/.test(number)}
          >
            <span role="img" aria-label="call">📞</span>
          </KeypadButton>
        </div>
      </>
    );
  }
  return <div className="phone-container">{render}</div>;
};

export default Phone;
