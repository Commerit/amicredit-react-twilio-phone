import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Signup from './Signup';
import ForgotPassword from './ForgotPassword';
import Activity from './Activity';
import "./App.css";
import Phone from "./Phone";
import NavigationBar from "./NavigationBar";

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

const App = () => {
  const [token, setToken] = useState(null);
  const [clicked, setClicked] = useState(false);
  const [activeSection, setActiveSection] = useState("dialer");
  const identity = "phil";

  const handleClick = () => {
    setClicked(true);
    fetch(`/voice/token?identity=${encodeURIComponent(identity)}`)
      .then(response => response.json())
      .then(({ token }) => setToken(token));
  };

  let mainContent;
  if (activeSection === "dialer") {
    mainContent = !clicked ? (
      <button className="connect-btn" onClick={handleClick}>Connect to Phone</button>
    ) : token ? (
      <Phone token={token} />
    ) : (
      <p>Loading...</p>
    );
  } else if (activeSection === "activity") {
    mainContent = <Activity />;
  } else if (activeSection === "contacts") {
    mainContent = <Placeholder label="Contacts" />;
  } else if (activeSection === "settings") {
    mainContent = <Placeholder label="Settings" />;
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/" element={
            <PrivateRoute>
              <div className="app">
                <main className="main-content">{mainContent}</main>
                <NavigationBar active={activeSection} onChange={setActiveSection} />
              </div>
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
