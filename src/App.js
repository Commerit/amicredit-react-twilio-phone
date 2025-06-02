import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom';
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

// --- Contacts Page ---
function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  // Placeholder: Replace with real contacts fetch/filter logic
  const contacts = [];
  useEffect(() => {
    setSearchParams(search ? { search } : {});
  }, [search, setSearchParams]);
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h2>Contacts</h2>
      <input
        type="text"
        placeholder="Search contacts..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid #eee', fontSize: 16, marginBottom: 24 }}
      />
      <div style={{ color: '#888', fontSize: 15 }}>
        {contacts.length === 0 ? 'No contacts found.' : 'Contacts list here.'}
      </div>
    </div>
  );
}

// --- Analytics Page ---
function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    start: searchParams.get("start") || "",
    end: searchParams.get("end") || "",
    type: searchParams.get("type") || "",
  });
  useEffect(() => {
    const params = {};
    if (filters.start) params.start = filters.start;
    if (filters.end) params.end = filters.end;
    if (filters.type) params.type = filters.type;
    setSearchParams(params);
  }, [filters, setSearchParams]);
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h2>Analytics</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <input
          type="date"
          value={filters.start}
          onChange={e => setFilters(f => ({ ...f, start: e.target.value }))}
          style={{ padding: 8, borderRadius: 6, border: '1.5px solid #eee', fontSize: 16 }}
        />
        <input
          type="date"
          value={filters.end}
          onChange={e => setFilters(f => ({ ...f, end: e.target.value }))}
          style={{ padding: 8, borderRadius: 6, border: '1.5px solid #eee', fontSize: 16 }}
        />
        <select
          value={filters.type}
          onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
          style={{ padding: 8, borderRadius: 6, border: '1.5px solid #eee', fontSize: 16 }}
        >
          <option value="">All Types</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="missed">Missed</option>
        </select>
      </div>
      <div style={{ color: '#888', fontSize: 15 }}>
        Analytics data and charts will appear here.
      </div>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

const ringtoneUrl = "https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.ogg";

const TopRightLogout = () => {
  const { logout } = useAuth();
  return (
    <button
      onClick={logout}
      style={{
        position: 'fixed',
        top: 24,
        right: 32,
        background: '#e65c00',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '10px 22px',
        fontSize: 16,
        fontWeight: 600,
        cursor: 'pointer',
        zIndex: 2000,
        boxShadow: '0 2px 8px #0001',
        transition: 'background 0.2s',
      }}
      aria-label="Log out"
      className="logout-btn"
    >
      Log out
    </button>
  );
};

function AppRoutes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Default to dialer if no section
  useEffect(() => {
    if (user && window.location.pathname === "/") {
      navigate(`/app/${user.id}/dialer`, { replace: true });
    }
  }, [user, navigate]);
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/app/:userId/:section" element={<PrivateRoute><AppSection /></PrivateRoute>} />
      <Route path="/app/:userId/activity/:callId" element={<PrivateRoute><AppSection /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function AppSection() {
  const { userId, section, callId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [token, setToken] = useState(null);
  const [clicked, setClicked] = useState(false);
  const [device, setDevice] = useState(null);
  const [incomingConn, setIncomingConn] = useState(null);
  const [incomingCaller, setIncomingCaller] = useState("");
  const [incomingRinging, setIncomingRinging] = useState(false);
  const tokenRef = useRef(token);
  const ringerRef = useRef();

  useEffect(() => { tokenRef.current = token; }, [token]);

  // Setup Twilio Device globally
  useEffect(() => {
    if (!token) return;
    const device = new Device();
    device.setup(token, { debug: true });
    setDevice(device);

    device.on("ready", () => {});
    device.on("incoming", connection => {
      setIncomingConn(connection);
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

  useEffect(() => {
    if (window.Notification && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (incomingConn && incomingRinging) {
      if (ringerRef.current) {
        ringerRef.current.currentTime = 0;
        ringerRef.current.play();
      }
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
      if (ringerRef.current) {
        ringerRef.current.pause();
        ringerRef.current.currentTime = 0;
      }
    }
  }, [incomingConn, incomingRinging, incomingCaller]);

  const handleClick = () => {
    setClicked(true);
    fetch(`/voice/token?identity=${encodeURIComponent(userId)}`)
      .then(response => response.json())
      .then(({ token }) => setToken(token));
  };

  const clearIncoming = () => {
    setIncomingConn(null);
    setIncomingRinging(false);
  };

  // Section rendering based on URL
  let mainContent;
  if (section === "dialer") {
    // Get dialed number from query param
    const number = searchParams.get("number") || "";
    mainContent = !clicked ? (
      <button className="connect-btn" onClick={handleClick}>Connect to Phone</button>
    ) : token && device ? (
      <Phone token={token} device={device} initialNumber={number} setNumberInUrl={num => setSearchParams({ number: num })} />
    ) : (
      <p>Loading...</p>
    );
  } else if (section === "activity") {
    if (callId) {
      mainContent = <Activity callId={callId} />;
    } else {
      mainContent = <Activity />;
    }
  } else if (section === "contacts") {
    mainContent = <Contacts />;
  } else if (section === "analytics") {
    mainContent = <Analytics />;
  } else if (section === "settings") {
    mainContent = <Settings />;
  } else {
    mainContent = <Navigate to={`/app/${userId}/dialer`} replace />;
  }

  // Navigation bar handler
  const handleNavChange = (key) => {
    window.history.replaceState(null, '', `/app/${userId}/${key}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="app">
      <TopRightLogout />
      <main className="main-content">{mainContent}</main>
      <NavigationBar active={section} onChange={handleNavChange} />
      <audio ref={ringerRef} src={ringtoneUrl} loop />
      {incomingConn && incomingRinging && (
        <Incoming device={device} connection={incomingConn} caller={incomingCaller} onClear={clearIncoming} />
      )}
    </div>
  );
}

const App = () => (
  <AuthProvider>
    <Router>
      <AppRoutes />
    </Router>
  </AuthProvider>
);

export default App;
