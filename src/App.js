import React, { useState } from "react";
import "./App.css";
import Phone from "./Phone";
import NavigationBar from "./NavigationBar";

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
    mainContent = <Placeholder label="Activity" />;
  } else if (activeSection === "contacts") {
    mainContent = <Placeholder label="Contacts" />;
  } else if (activeSection === "settings") {
    mainContent = <Placeholder label="Settings" />;
  }

  return (
    <div className="app">
      <main className="main-content">{mainContent}</main>
      <NavigationBar active={activeSection} onChange={setActiveSection} />
    </div>
  );
};

export default App;
