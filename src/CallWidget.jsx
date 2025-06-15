import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import MinimalCall from './MinimalCall';
import './CallWidget.css';

const CallWidget = ({ agentId, phoneNumber, onClose }) => {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(`/voice/token?identity=${encodeURIComponent(agentId)}`);
        const data = await response.json();
        if (!data.token) {
          throw new Error('Failed to get token');
        }
        setToken(data.token);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchToken();
  }, [agentId]);

  return (
    <div className={`call-widget ${isMinimized ? 'minimized' : ''}`}>
      <div className="call-widget-header">
        <div className="call-widget-title">
          {isMinimized ? 'Active Call' : 'Call in Progress'}
        </div>
        <div className="call-widget-controls">
          <button 
            className="call-widget-minimize" 
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button 
            className="call-widget-close" 
            onClick={onClose}
            title="End Call"
          >
            ×
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <div className="call-widget-content">
          {error ? (
            <div className="call-widget-error">{error}</div>
          ) : !token ? (
            <div className="call-widget-loading">Connecting...</div>
          ) : (
            <MinimalCall 
              token={token} 
              phoneNumber={phoneNumber} 
              agentId={agentId} 
            />
          )}
        </div>
      )}
    </div>
  );
};

// Expose a global function for embedding
window.initCallWidget = (config) => {
  const { agentId, phoneNumber, containerId = 'call-widget-container' } = config;
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }
  ReactDOM.render(
    <CallWidget 
      agentId={agentId}
      phoneNumber={phoneNumber}
      onClose={() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
      }}
    />,
    container
  );
};

export default CallWidget; 