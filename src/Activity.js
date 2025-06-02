import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import "./Activity.css";
import CallDetails from "./CallDetails";

const Activity = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId } = useParams();
  const navigate = useNavigate();
  // Initialize filters from URL
  const [filters, setFilters] = useState({
    direction: searchParams.get("direction") || "",
    search: searchParams.get("search") || "",
    startDate: searchParams.get("start") || "",
    endDate: searchParams.get("end") || ""
  });
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCallId, setSelectedCallId] = useState(searchParams.get("callId") || null);
  const refreshIntervalRef = useRef(null);

  // Keep filters and selectedCallId in sync with URL
  useEffect(() => {
    const params = {};
    if (filters.direction) params.direction = filters.direction;
    if (filters.search) params.search = filters.search;
    if (filters.startDate) params.start = filters.startDate;
    if (filters.endDate) params.end = filters.endDate;
    if (selectedCallId) params.callId = selectedCallId;
    setSearchParams(params);
  }, [filters, selectedCallId, setSearchParams]);

  // Fetch calls when filters change
  const fetchCalls = useCallback(async (silent = false) => {
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
  }, [filters]);

  useEffect(() => {
    fetchCalls();
  }, [filters, fetchCalls]);

  // Auto-refresh for pending recordings/transcripts
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    const hasPendingCalls = calls.some(call => 
      call.recording_url === "pending" || 
      call.transcript === "pending" ||
      (!call.recording_url && call.status === "completed" && call.duration_seconds > 0)
    );
    if (hasPendingCalls) {
      refreshIntervalRef.current = setInterval(() => {
        fetchCalls(true);
      }, 5000);
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [calls, fetchCalls]);

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

  const handleCallClick = (call) => {
    setSelectedCallId(call.id);
    // Also update the URL path for deep linking
    navigate(`/app/${userId}/activity/${call.id}`);
  };

  // If selectedCallId, show CallDetails
  if (selectedCallId) {
    return (
      <CallDetails
        callId={selectedCallId}
        onBack={() => {
          setSelectedCallId(null);
          navigate(`/app/${userId}/activity?${searchParams.toString()}`);
        }}
        onViewAllWithNumber={(number) => {
          setSelectedCallId(null);
          setFilters({ ...filters, search: number });
          navigate(`/app/${userId}/activity?search=${encodeURIComponent(number)}`);
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
              onClick={() => handleCallClick(call)}
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