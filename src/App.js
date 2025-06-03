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
  const { userProfile, supabase } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setSearchParams(search ? { search } : {});
  }, [search, setSearchParams]);
  useEffect(() => {
    async function fetchContacts() {
      if (!userProfile) return;
      setLoading(true);
      let query = supabase.from('users').select('id, full_name, email').eq('team_id', userProfile.team_id);
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error } = await query;
      setContacts(error ? [] : data || []);
      setLoading(false);
    }
    fetchContacts();
  }, [userProfile, supabase, search]);
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
      {loading ? (
        <div style={{ color: '#888', fontSize: 15 }}>Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div style={{ color: '#888', fontSize: 15 }}>No contacts found.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {contacts.map(contact => (
            <li key={contact.id} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
              <div style={{ fontWeight: 600 }}>{contact.full_name}</div>
              <div style={{ color: '#555', fontSize: 15 }}>{contact.email}</div>
            </li>
          ))}
        </ul>
      )}
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
  const { userProfile, supabase } = useAuth();
  const [stats, setStats] = useState({ inbound: 0, outbound: 0, missed: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const params = {};
    if (filters.start) params.start = filters.start;
    if (filters.end) params.end = filters.end;
    if (filters.type) params.type = filters.type;
    setSearchParams(params);
  }, [filters, setSearchParams]);
  useEffect(() => {
    async function fetchStats() {
      if (!userProfile) return;
      setLoading(true);
      let query = supabase.from('call_logs').select('*');
      query = query.or(`user_id.eq.${userProfile.id},and(user_id.is.null,team_id.eq.${userProfile.team_id},status.eq.missed)`);
      if (filters.start) query = query.gte('started_at', filters.start);
      if (filters.end) query = query.lte('started_at', filters.end);
      const { data, error } = await query;
      if (error || !data) {
        setStats({ inbound: 0, outbound: 0, missed: 0 });
        setLoading(false);
        return;
      }
      const inbound = data.filter(c => c.direction === 'inbound' && c.status !== 'missed').length;
      const outbound = data.filter(c => c.direction === 'outbound' && c.status !== 'missed').length;
      const missed = data.filter(c => c.status === 'missed').length;
      setStats({ inbound, outbound, missed });
      setLoading(false);
    }
    fetchStats();
  }, [filters, userProfile, supabase]);
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
      </div>
      {loading ? (
        <div style={{ color: '#888', fontSize: 15 }}>Loading analytics...</div>
      ) : (
        <div style={{ color: '#222', fontSize: 18, display: 'flex', gap: 32 }}>
          <div><strong>Inbound:</strong> {stats.inbound}</div>
          <div><strong>Outbound:</strong> {stats.outbound}</div>
          <div><strong>Missed:</strong> {stats.missed}</div>
        </div>
      )}
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
  const [token, setToken] = useState(null);
  const [clicked, setClicked] = useState(false);
  const [device, setDevice] = useState(null);
  const [incomingConn, setIncomingConn] = useState(null);
  const [incomingCaller, setIncomingCaller] = useState("");
  const [incomingRinging, setIncomingRinging] = useState(false);
  const tokenRef = useRef(token);
  const ringerRef = useRef();
  const { user } = useAuth();

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
    const identity = user ? user.id : userId;
    fetch(`/voice/token?identity=${encodeURIComponent(identity)}`)
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
