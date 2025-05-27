import React, { useState } from "react";
import KeypadButton from "./KeypadButton";
import "./OnCall.css";

const OnCall = ({ handleHangup, connection, timer, number }) => {
  const [muted, setMuted] = useState(false);

  const handleMute = () => {
    // connection.mute(!muted);
    setMuted(!muted);
  };

  return (
    <div className="oncall-ui">
      <div className="oncall-row">
        <KeypadButton handleClick={handleMute} color={muted ? "red" : ""}>
          <span role="img" aria-label="mute">{muted ? "🔈" : "🔇"}</span>
        </KeypadButton>
        <KeypadButton handleClick={handleHangup} color="red">
          <span role="img" aria-label="hangup">🔴</span>
        </KeypadButton>
      </div>
      <div className="oncall-info">
        <div className="oncall-number">{number}</div>
        <div className="oncall-timer">{timer}s</div>
      </div>
    </div>
  );
};

export default OnCall;
