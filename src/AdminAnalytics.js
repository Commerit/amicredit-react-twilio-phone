import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Card, Button, DatePicker, Radio, Select } from 'antd';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import dayjs from 'dayjs';
import './Analytics.css';

const COLORS = ['#e65c00', '#36d576'];
const FILTERS = [
  { label: 'Today', value: 'today' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

function getDateRange(filter) {
  const now = dayjs();
  if (filter === 'today') return [now.startOf('day'), now.endOf('day')];
  if (filter === '7d') return [now.subtract(6, 'day').startOf('day'), now.endOf('day')];
  if (filter === '30d') return [now.subtract(29, 'day').startOf('day'), now.endOf('day')];
  return [null, null];
}

export default function AdminAnalytics() {
  const { supabase } = useAuth();
  const [filter, setFilter] = useState('today');
  const [customRange, setCustomRange] = useState([null, null]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    total: 0,
    avgDuration: 0,
    inbound: 0,
    outbound: 0,
    perDay: [],
    perHour: [],
  });
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);

  useEffect(() => {
    async function fetchUsersAndTeams() {
      const { data: usersData } = await supabase.from('users').select('id, full_name, team_id');
      const { data: teamsData } = await supabase.from('teams').select('id, name');
      setUsers(usersData || []);
      setTeams(teamsData || []);
    }
    fetchUsersAndTeams();
  }, [supabase]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    let [start, end] = filter === 'custom' ? customRange : getDateRange(filter);
    if (!start || !end) {
      setLoading(false);
      return;
    }
    start = dayjs(start).startOf('day').toISOString();
    end = dayjs(end).endOf('day').toISOString();
    let query = supabase.from('call_logs').select('*').gte('started_at', start).lte('started_at', end);
    if (selectedUsers.length > 0) {
      query = query.in('user_id', selectedUsers);
    }
    if (selectedTeams.length > 0) {
      query = query.in('team_id', selectedTeams);
    }
    const { data: calls, error } = await query;
    if (error || !calls) {
      setLoading(false);
      setData({ total: 0, avgDuration: 0, inbound: 0, outbound: 0, perDay: [], perHour: [] });
      return;
    }
    // Calculate analytics
    const total = calls.length;
    const avgDuration = total ? Math.round(calls.reduce((a, c) => a + (c.duration_seconds || 0), 0) / total) : 0;
    const inbound = calls.filter(c => c.direction === 'inbound').length;
    const outbound = calls.filter(c => c.direction === 'outbound').length;
    // Per day
    const perDayMap = {};
    calls.forEach(c => {
      const d = dayjs(c.started_at).format('ddd');
      if (!perDayMap[d]) perDayMap[d] = { day: d, Inbound: 0, Outbound: 0 };
      if (c.direction === 'inbound') perDayMap[d].Inbound++;
      if (c.direction === 'outbound') perDayMap[d].Outbound++;
    });
    const perDay = Object.values(perDayMap);
    // Per hour
    const perHourMap = {};
    calls.forEach(c => {
      const h = dayjs(c.started_at).format('ddd HH');
      if (!perHourMap[h]) perHourMap[h] = { hour: h, Inbound: 0, Outbound: 0 };
      if (c.direction === 'inbound') perHourMap[h].Inbound++;
      if (c.direction === 'outbound') perHourMap[h].Outbound++;
    });
    const perHour = Object.values(perHourMap);
    setData({ total, avgDuration, inbound, outbound, perDay, perHour });
    setLoading(false);
  }, [supabase, filter, customRange, selectedUsers, selectedTeams]);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchAnalytics, lastRefresh]);

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h2>Admin Analytics</h2>
        <p>View and filter analytics for all users and teams.</p>
        <div className="analytics-filters">
          <Radio.Group
            options={FILTERS}
            onChange={e => setFilter(e.target.value)}
            value={filter}
            optionType="button"
            buttonStyle="solid"
          />
          {filter === 'custom' && (
            <DatePicker.RangePicker
              value={customRange}
              onChange={v => setCustomRange(v)}
              style={{ marginLeft: 12 }}
            />
          )}
          <Select
            mode="multiple"
            allowClear
            placeholder="Filter by user(s)"
            value={selectedUsers}
            onChange={setSelectedUsers}
            style={{ minWidth: 180, marginLeft: 12 }}
            options={users.map(u => ({ value: u.id, label: u.full_name }))}
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="Filter by team(s)"
            value={selectedTeams}
            onChange={setSelectedTeams}
            style={{ minWidth: 180, marginLeft: 12 }}
            options={teams.map(t => ({ value: t.id, label: t.name }))}
          />
          <Button onClick={() => setLastRefresh(Date.now())} style={{ marginLeft: 16 }}>Refresh Analytics</Button>
        </div>
      </div>
      <div className="analytics-cards">
        <Card className="analytics-card" loading={loading}>
          <div className="analytics-metric-title">Total Calls</div>
          <div className="analytics-metric-value">{data.total}</div>
          <div className="analytics-metric-desc">Inbound and Outbound combined</div>
        </Card>
        <Card className="analytics-card" loading={loading}>
          <div className="analytics-metric-title">Average Call Duration</div>
          <div className="analytics-metric-value">{Math.floor(data.avgDuration / 60)}:{(data.avgDuration % 60).toString().padStart(2, '0')}</div>
          <div className="analytics-metric-desc">Inbound and Outbound combined</div>
        </Card>
        <Card className="analytics-card" loading={loading}>
          <div className="analytics-metric-title">Inbound vs Outbound</div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie dataKey="value" data={[
                { name: 'Inbound', value: data.inbound },
                { name: 'Outbound', value: data.outbound },
              ]} cx="50%" cy="50%" outerRadius={40} fill="#8884d8" label>
                <Cell key="inbound" fill={COLORS[0]} />
                <Cell key="outbound" fill={COLORS[1]} />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="analytics-card" loading={loading}>
          <div className="analytics-metric-title">Calls per day</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.perDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Inbound" stackId="a" fill={COLORS[0]} />
              <Bar dataKey="Outbound" stackId="a" fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="analytics-card" loading={loading}>
          <div className="analytics-metric-title">Calls per hour</div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data.perHour} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="hour" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Inbound" stroke={COLORS[0]} />
              <Line type="monotone" dataKey="Outbound" stroke={COLORS[1]} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
} 