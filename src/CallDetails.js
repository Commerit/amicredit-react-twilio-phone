import React, { useState, useEffect, useCallback } from "react";
import "./CallDetails.css";

const CallDetails = ({ callId, onBack, onViewAllWithNumber }) => {
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCallDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/calls/${callId}`);
      if (response.ok) {
        const data = await response.json();
        setCall(data);
      } else {
        setError("Failed to load call details");
      }
    } catch (error) {
      console.error("Error fetching call details:", error);
      setError("Failed to load call details");
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchCallDetails();
  }, [callId, fetchCallDetails]);

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const getCallTypeLabel = (call) => {
    if (call.status === "missed") return "Missed Call";
    if (call.direction === "inbound") return "Inbound Call";
    if (call.direction === "outbound") return "Outbound Call";
    return "Call";
  };

  if (loading) {
    return (
      <div className="call-details-container">
        <div className="loading">Loading call details...</div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="call-details-container">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <div className="error">{error || "Call not found"}</div>
      </div>
    );
  }

  const otherNumber = call.direction === "inbound" ? call.from_number : call.to_number;

  return (
    <div className="call-details-container">
      <div className="details-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h2>{getCallTypeLabel(call)}</h2>
      </div>

      <div className="details-content">
        <div className="details-section">
          <h3>Call Information</h3>
          <div className="detail-row">
            <span className="detail-label">From:</span>
            <span className="detail-value">{call.from_number}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">To:</span>
            <span className="detail-value">{call.to_number}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Date:</span>
            <span className="detail-value">{formatDate(call.started_at)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Duration:</span>
            <span className="detail-value">{formatDuration(call.duration_seconds)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status:</span>
            <span className="detail-value">{call.status}</span>
          </div>
        </div>

        {call.recording_url && (
          <div className="details-section">
            <h3>Recording</h3>
            {call.recording_url === "pending" ? (
              <div className="pending-message">Recording is being processed...</div>
            ) : (
              <audio controls className="recording-player">
                <source src={call.recording_url} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            )}
          </div>
        )}

        {call.transcript && (
          <div className="details-section">
            <h3>Transcript</h3>
            {call.transcript === "pending" ? (
              <div className="pending-message">Transcript is being generated...</div>
            ) : (
              <div className="transcript-text">{call.transcript}</div>
            )}
          </div>
        )}

        <div className="details-actions">
          <button
            className="action-button"
            onClick={() => onViewAllWithNumber(otherNumber)}
          >
            View all calls with {otherNumber}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallDetails; 