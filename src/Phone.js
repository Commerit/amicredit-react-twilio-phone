import React, { useState, useEffect, useRef } from "react";
import { Device } from "twilio-client";
import Dialler from "./Dialler";
import KeypadButton from "./KeypadButton";
import Incoming from "./Incoming";
import OnCall from "./OnCall";
import "./Phone.css";
import states from "./states";

const Phone = ({ token }) => {
  const [state, setState] = useState(states.CONNECTING);
  const [number, setNumber] = useState("");
  const [conn, setConn] = useState(null);
  const [device, setDevice] = useState(null);
  const [callStart, setCallStart] = useState(null);
  const [ringStart, setRingStart] = useState(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef();

  useEffect(() => {
    const device = new Device();
    device.setup(token, { debug: true });

    device.on("ready", () => {
      setDevice(device);
      setState(states.READY);
    });
    device.on("connect", connection => {
      setConn(connection);
      setState(states.ON_CALL);
      setCallStart(Date.now());
      setRingStart(null);
    });
    device.on("disconnect", () => {
      setState(states.READY);
      setConn(null);
      setCallStart(null);
      setTimer(0);
    });
    device.on("incoming", connection => {
      setState(states.INCOMING);
      setConn(connection);
      setRingStart(Date.now());
      setCallStart(null);
      connection.on("reject", () => {
        setState(states.READY);
        setConn(null);
        setRingStart(null);
      });
    });
    device.on("cancel", () => {
      setState(states.READY);
      setConn(null);
      setRingStart(null);
    });
    device.on("reject", () => {
      setState(states.READY);
      setConn(null);
      setRingStart(null);
    });

    return () => {
      device.destroy();
      setDevice(null);
      setState(states.OFFLINE);
    };
  }, [token]);

  // Timer logic
  useEffect(() => {
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

  const handleCall = () => {
    if (device && number && /^\+\d{8,15}$/.test(number)) {
      device.connect({ To: number });
    }
  };

  const handleHangup = () => {
    device.disconnectAll();
  };

  let render;
  if (conn) {
    if (state === states.INCOMING) {
      render = (
        <div className="call-screen">
          <div className="call-number">{number}</div>
          <div className="call-status">Ringing... {timer}s</div>
          <Incoming device={device} connection={conn} />
        </div>
      );
    } else if (state === states.ON_CALL) {
      render = (
        <div className="call-screen">
          <div className="call-number">{number}</div>
          <div className="call-status">On Call {timer}s</div>
          <OnCall handleHangup={handleHangup} connection={conn} />
        </div>
      );
    }
  } else {
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
  return <>{render}</>;
};

export default Phone;
