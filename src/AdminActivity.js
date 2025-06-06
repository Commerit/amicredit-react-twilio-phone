import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Select } from 'antd';
import "./Activity.css";
import CallDetails from "./CallDetails";

const AdminActivity = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { supabase } = useAuth();
  const [filters, setFilters] = useState({
    direction: searchParams.get("direction") || "",
    search: searchParams.get("search") || "",
    startDate: searchParams.get("start") || "",
    endDate: searchParams.get("end") || "",
    users: [],
    teams: [],
  });
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCallId, setSelectedCallId] = useState(searchParams.get("callId") || null);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    async function fetchUsersAndTeams() {
      const { data: usersData } = await supabase.from('users').select('id, full_name, team_id');
      const { data: teamsData } = await supabase.from('teams').select('id, name');
      setUsers(usersData || []);
      setTeams(teamsData || []);
    }
    fetchUsersAndTeams();
  }, [supabase]);

  useEffect(() => {
    const params = {};
    if (filters.direction) params.direction = filters.direction;
    if (filters.search) params.search = filters.search;
    if (filters.startDate) params.start = filters.startDate;
    if (filters.endDate) params.end = filters.endDate;
    if (selectedCallId) params.callId = selectedCallId;
    setSearchParams(params);
  }, [filters, selectedCallId, setSearchParams]);

  const fetchCalls = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let query = supabase.from('call_logs').select('*');
      // User/team filters
      if (filters.users.length > 0) {
        query = query.in('user_id', filters.users);
      }
      if (filters.teams.length > 0) {
        query = query.in('team_id', filters.teams);
      }
      // Direction filter
      if (filters.direction === "missed") {
        query = query.eq("status", "missed");
      } else if (filters.direction) {
        query = query.eq("direction", filters.direction);
      }
      // Search filter
      if (filters.search) {
        query = query.or(`from_number.ilike.%${filters.search}%,to_number.ilike.%${filters.search}%`);
      }
      // Date range
      let startDate = filters.startDate;
      let endDate = filters.endDate;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        endDate = end.toISOString();
      }
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        startDate = start.toISOString();
      }
      if (startDate) query = query.gte("started_at", startDate);
      if (endDate) query = query.lte("started_at", endDate);
      query = query.order('started_at', { ascending: false }).limit(100);
      const { data, error } = await query;
      setCalls(error ? [] : data || []);
    } catch (error) {
      setCalls([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters, supabase]);

  useEffect(() => {
    fetchCalls();
  }, [filters, fetchCalls]);

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
    navigate(`/app/${userId}/activity/${call.id}`);
  };

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
        <h2>Admin Call Activity</h2>
        <div className="activity-filters">
          <input
            type="text"
            placeholder="Search by number..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="search-input"
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="Filter by user(s)"
            value={filters.users}
            onChange={v => handleFilterChange('users', v)}
            style={{ minWidth: 160 }}
            options={users.map(u => ({ value: u.id, label: u.full_name }))}
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="Filter by team(s)"
            value={filters.teams}
            onChange={v => handleFilterChange('teams', v)}
            style={{ minWidth: 160 }}
            options={teams.map(t => ({ value: t.id, label: t.name }))}
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
          <input
            type="date"
            value={filters.startDate}
            onChange={e => handleFilterChange("startDate", e.target.value)}
            className="filter-select"
            style={{ minWidth: 120 }}
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={e => handleFilterChange("endDate", e.target.value)}
            className="filter-select"
            style={{ minWidth: 120 }}
          />
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

export default AdminActivity; 