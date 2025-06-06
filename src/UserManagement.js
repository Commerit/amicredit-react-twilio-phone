import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export default function UserManagement() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', team_id: '', role: 'agent', password: '' });
  const [isNew, setIsNew] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) setUsers(data);
      else setError(data.error || 'Failed to fetch users');
    } catch (e) {
      setError('Failed to fetch users');
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleEdit = (user) => {
    setEditingUser(user.id);
    setIsNew(false);
    setForm({
      email: user.email || '',
      full_name: user.full_name || '',
      phone: user.twilio_phone_number || '',
      team_id: user.team_id || '',
      role: user.role || 'agent',
      password: ''
    });
  };

  const handleAdd = () => {
    setEditingUser(null);
    setIsNew(true);
    setForm({ email: '', full_name: '', phone: '', team_id: '', role: 'agent', password: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    setError('');
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete user');
      } else {
        fetchUsers();
      }
    } catch (e) {
      setError('Failed to delete user');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? '/api/users' : `/api/users/${editingUser}`;
    const body = { ...form };
    if (!isNew && !form.password) delete body.password;
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to save user');
      else {
        setEditingUser(null);
        setIsNew(false);
        setForm({ email: '', full_name: '', phone: '', team_id: '', role: 'agent', password: '' });
        fetchUsers();
      }
    } catch (e) {
      setError('Failed to save user');
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h2>User Management</h2>
      <button onClick={handleAdd} style={{ marginBottom: 16, background: '#e65c00', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 22px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Add User</button>
      {error && <div style={{ color: '#e74c3c', marginBottom: 12 }}>{error}</div>}
      {loading ? <div>Loading...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Name</th>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Email</th>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Phone</th>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Team</th>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Role</th>
              <th style={{ padding: 8, border: '1px solid #eee' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ background: editingUser === user.id ? '#fffbe6' : '#fff' }}>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{user.full_name}</td>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{user.email}</td>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{user.twilio_phone_number}</td>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{user.team_id}</td>
                <td style={{ padding: 8, border: '1px solid #eee' }}>{user.role}</td>
                <td style={{ padding: 8, border: '1px solid #eee' }}>
                  <button onClick={() => handleEdit(user)} style={{ marginRight: 8 }}>Edit</button>
                  <button onClick={() => handleDelete(user.id)} style={{ color: '#e74c3c' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(editingUser || isNew) && (
        <form onSubmit={handleSave} style={{ background: '#fafafa', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px #0001', marginBottom: 24 }}>
          <h3>{isNew ? 'Add New User' : 'Edit User'}</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #eee', marginBottom: 8 }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Full Name</label>
              <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #eee', marginBottom: 8 }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Phone</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #eee', marginBottom: 8 }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Team ID</label>
              <input type="text" value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #eee', marginBottom: 8 }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #eee', marginBottom: 8 }}>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Password {isNew ? '' : '(leave blank to keep unchanged)'}</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #eee', marginBottom: 8 }} />
            </div>
          </div>
          <button type="submit" style={{ background: '#e65c00', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 22px', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 12 }}>{isNew ? 'Add User' : 'Save Changes'}</button>
          <button type="button" onClick={() => { setEditingUser(null); setIsNew(false); setForm({ email: '', full_name: '', phone: '', team_id: '', role: 'agent', password: '' }); }} style={{ marginLeft: 12 }}>Cancel</button>
        </form>
      )}
    </div>
  );
} 