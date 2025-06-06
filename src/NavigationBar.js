import React from "react";
import "./NavigationBar.css";
import { useAuth } from './AuthContext';

const navItems = [
  { key: "dialer", label: "Dialer", icon: "\u260E\uFE0F" }, // phone emoji
  { key: "activity", label: "Activity", icon: "\u23F2" }, // clock emoji
  { key: "contacts", label: "Contacts", icon: "\uD83D\uDC65" }, // people emoji
  { key: "analytics", label: "Analytics", icon: "\uD83D\uDCCA" }, // bar chart emoji
  { key: "settings", label: "Settings", icon: "\u2699\uFE0F" }, // gear emoji
];

export default function NavigationBar({ active, onChange }) {
  const { userProfile } = useAuth();
  if (!userProfile) return null;
  const isAdmin = userProfile.role === 'admin';
  const tabs = isAdmin
    ? [
        { key: 'analytics', label: 'Analytics', icon: '📊' },
        { key: 'activity', label: 'Activity', icon: '📞' },
        { key: 'user-management', label: 'Users', icon: '👥' },
      ]
    : [
        { key: 'dialer', label: 'Dialer', icon: '📞' },
        { key: 'contacts', label: 'Contacts', icon: '👤' },
        { key: 'analytics', label: 'Analytics', icon: '📊' },
        { key: 'activity', label: 'Activity', icon: '📋' },
        { key: 'settings', label: 'Settings', icon: '⚙️' },
      ];
  const handleNav = (key) => {
    onChange(key);
  };
  return (
    <nav className="navigation-bar">
      <div className="nav-items">
        {tabs.map((item) => (
          <button
            key={item.key}
            className={`nav-item${active === item.key ? " active" : ""}`}
            onClick={() => handleNav(item.key)}
            aria-label={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
} 