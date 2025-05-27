import React from "react";
import "./NavigationBar.css";

const navItems = [
  { key: "dialer", label: "Dialer", icon: "\u260E\uFE0F" }, // phone emoji
  { key: "activity", label: "Activity", icon: "\u23F2" }, // clock emoji
  { key: "contacts", label: "Contacts", icon: "\uD83D\uDC65" }, // people emoji
  { key: "settings", label: "Settings", icon: "\u2699\uFE0F" }, // gear emoji
];

const NavigationBar = ({ active, onChange }) => (
  <nav className="navigation-bar">
    {navItems.map((item) => (
      <button
        key={item.key}
        className={`nav-item${active === item.key ? " active" : ""}`}
        onClick={() => onChange(item.key)}
        aria-label={item.label}
      >
        <span className="nav-icon">{item.icon}</span>
        <span className="nav-label">{item.label}</span>
      </button>
    ))}
  </nav>
);

export default NavigationBar; 