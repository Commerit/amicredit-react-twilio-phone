import React, { useState, useEffect, useRef } from "react";
import "./Activity.css";
import CallDetails from "./CallDetails";

const Activity = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [filters, setFilters] = useState({
    direction: "", // "", "inbound", "outbound", "missed"
    search: "",
    startDate: "",
    endDate: ""
  });
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    fetchCalls();
  }, [filters, fetchCalls]);

  // Auto-refresh for pending recordings/transcripts
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Check if there are any calls with pending status
    const hasPendingCalls = calls.some(call => 
      call.recording_url === "pending" || 
      call.transcript === "pending" ||
      (!call.recording_url && call.status === "completed" && call.duration_seconds > 0)
    );

    if (hasPendingCalls) {
      // Set up auto-refresh every 5 seconds
      refreshIntervalRef.current = setInterval(() => {
        fetchCalls(true); // Silent refresh
      }, 5000);
    }

    // Cleanup on unmount or when calls change
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [calls, fetchCalls]);

  const fetchCalls = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.direction === "missed") {
        params.append("status", "missed");
      } else if (filters.direction) {
        params.append("direction", filters.direction);
      }
      if (filters.search) params.append("search", filters.search);
      if (filters.startDate) params.append("start", filters.startDate);
      if (filters.endDate) params.append("end", filters.endDate);
      params.append("limit", "50");

      const response = await fetch(`/api/calls?${params}`);
      const data = await response.json();
      setCalls(data || []);
    } catch (error) {
      console.error("Error fetching calls:", error);
      setCalls([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

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

  const getCallIcon = (call) => {
    if (call.status === "missed") return "📵";
    if (call.direction === "inbound") return "📞⬇️";
    if (call.direction === "outbound") return "📞⬆️";
    return "📞";
  };

  const getCallTypeClass = (call) => {
    if (call.status === "missed") return "missed";
    if (call.direction === "inbound") return "inbound";
    if (call.direction === "outbound") return "outbound";
    return "";
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  if (selectedCall) {
    return (
      <CallDetails
        callId={selectedCall.id}
        onBack={() => setSelectedCall(null)}
        onViewAllWithNumber={(number) => {
          setSelectedCall(null);
          setFilters({ ...filters, search: number });
        }}
      />
    );
  }

  return (
    <div className="activity-container">
      <div className="activity-header">
        <h2>Call Activity</h2>
        <div className="activity-filters">
          <input
            type="text"
            placeholder="Search by number..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="search-input"
          />
          <select
            value={filters.direction}
            onChange={(e) => handleFilterChange("direction", e.target.value)}
            className="filter-select"
          >
            <option value="">All Calls</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="missed">Missed</option>
          </select>
        </div>
      </div>

      <div className="call-list">
        {loading ? (
          <div className="loading">Loading calls...</div>
        ) : calls.length === 0 ? (
          <div className="no-calls">No calls found</div>
        ) : (
          calls.map((call) => (
            <div
              key={call.id}
              className={`call-item ${getCallTypeClass(call)}`}
              onClick={() => setSelectedCall(call)}
            >
              <div className="call-icon">{getCallIcon(call)}</div>
              <div className="call-info">
                <div className="call-number">
                  {call.direction === "inbound" ? call.from_number : call.to_number}
                </div>
                <div className="call-meta">
                  {formatDate(call.started_at)} • {formatDuration(call.duration_seconds)}
                </div>
              </div>
              <div className="call-status">
                {call.recording_url === "pending" ? "⏳" : call.recording_url && "🎙️"}
                {call.transcript === "pending" ? "⏳" : call.transcript && "📝"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Activity; 