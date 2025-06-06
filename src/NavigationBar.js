import React from "react";
import "./NavigationBar.css";
import { useAuth } from './AuthContext';

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