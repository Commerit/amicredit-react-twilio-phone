import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import MinimalCall from "./MinimalCall";

const MinimalCallRoute = () => {
  const { agentId } = useParams();
  const [token, setToken] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get the phone number from the URL query parameters
        const params = new URLSearchParams(window.location.search);
        const number = params.get('number');
        if (!number) {
          throw new Error('Phone number is required');
        }
        // Fetch the Twilio token
        const response = await fetch(`/voice/token?identity=${encodeURIComponent(agentId)}`);
        const data = await response.json();
        if (!data.token) {
          throw new Error('Failed to get token');
        }
        setToken(data.token);
        setPhoneNumber(number);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchData();
  }, [agentId]);

  if (error) {
    return (
      <div className="minimal-call-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }
  if (!token || !phoneNumber) {
    return (
      <div className="minimal-call-container">
        <div className="loading">Connecting...</div>
      </div>
    );
  }
  return <MinimalCall token={token} phoneNumber={phoneNumber} />;
};

export default MinimalCallRoute; 
