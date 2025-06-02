import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Signup from './Signup';
import ForgotPassword from './ForgotPassword';
import Activity from './Activity';
import "./App.css";
import Phone from "./Phone";
import NavigationBar from "./NavigationBar";
import { Device } from "twilio-client";
import Incoming from "./Incoming";
import Settings from "./Settings";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

const Placeholder = ({ label }) => (
  <div className="placeholder">
    <h2>{label}</h2>
    <p>Coming soon...</p>
  </div>
);

const ringtoneUrl = "https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.ogg";

const App = () => {
  const [token, setToken] = useState(null);
  const [clicked, setClicked] = useState(false);
  const [activeSection, setActiveSection] = useState("dialer");
  const [device, setDevice] = useState(null);
  const [incomingConn, setIncomingConn] = useState(null);
  const [incomingCaller, setIncomingCaller] = useState("");
  const [incomingRinging, setIncomingRinging] = useState(false);
  const identity = "phil";
  const tokenRef = useRef(token);
  const ringerRef = useRef();

  useEffect(() => { tokenRef.current = token; }, [token]);

  // Setup Twilio Device globally
  useEffect(() => {
    if (!token) return;
    const device = new Device();
    device.setup(token, { debug: true });
    setDevice(device);

    device.on("ready", () => {
      // ready
    });
    device.on("incoming", connection => {
      setIncomingConn(connection);
      // Prefer real_from if present, otherwise fallback
      const params = connection.parameters || {};
      const realCaller = params.real_from || params.From || params.Caller || "Unknown";
      setIncomingCaller(realCaller);
      setIncomingRinging(true);
      connection.on("reject", () => {
        setIncomingConn(null);
        setIncomingRinging(false);
      });
      connection.on("cancel", () => {
        setIncomingConn(null);
        setIncomingRinging(false);
      });
    });
    device.on("cancel", () => {
      setIncomingConn(null);
      setIncomingRinging(false);
    });
    device.on("reject", () => {
      setIncomingConn(null);
      setIncomingRinging(false);
    });
    device.on("disconnect", () => {
      setIncomingConn(null);
      setIncomingRinging(false);
    });
    return () => {
      device.destroy();
      setDevice(null);
    };
  }, [token]);

  // Request notification permission on load
  useEffect(() => {
    if (window.Notification && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Play ringer and show browser notification on incoming call
  useEffect(() => {
    if (incomingConn && incomingRinging) {
      // Play ringer
      if (ringerRef.current) {
        ringerRef.current.currentTime = 0;
        ringerRef.current.play();
      }
      // Show browser notification if not focused
      if (window.Notification && document.visibilityState !== "visible" && Notification.permission === "granted") {
        const notification = new Notification("Incoming Call", {
          body: `Call from ${incomingCaller}`,
          icon: "/logo.png"
        });
        notification.onclick = () => {
          window.focus();
        };
      }
    } else {
      // Stop ringer
      if (ringerRef.current) {
        ringerRef.current.pause();
        ringerRef.current.currentTime = 0;
      }
    }
  }, [incomingConn, incomingRinging, incomingCaller]);

  const handleClick = () => {
    setClicked(true);
    fetch(`/voice/token?identity=${encodeURIComponent(identity)}`)
      .then(response => response.json())
      .then(({ token }) => setToken(token));
  };

  // Handler to clear incoming state (stop modal/ringer)
  const clearIncoming = () => {
    setIncomingConn(null);
    setIncomingRinging(false);
  };

  let mainContent;
  if (activeSection === "dialer") {
    mainContent = !clicked ? (
      <button className="connect-btn" onClick={handleClick}>Connect to Phone</button>
    ) : token && device ? (
      <Phone token={token} device={device} />
    ) : (
      <p>Loading...</p>
    );
  } else if (activeSection === "activity") {
    mainContent = <Activity />;
  } else if (activeSection === "contacts") {
    mainContent = <Placeholder label="Contacts" />;
  } else if (activeSection === "settings") {
    mainContent = <Settings />;
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/" element={
            <PrivateRoute>
              <div className="app">
                <main className="main-content">{mainContent}</main>
                <NavigationBar active={activeSection} onChange={setActiveSection} />
                {/* Global ringer audio */}
                <audio ref={ringerRef} src={ringtoneUrl} loop />
                {incomingConn && incomingRinging && (
                  <Incoming device={device} connection={incomingConn} caller={incomingCaller} onClear={clearIncoming} />
                )}
              </div>
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
