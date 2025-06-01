import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const { supabase } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage('Password reset email sent! Please check your inbox.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
      <form onSubmit={handleReset} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px #0001', padding: 40, width: 400, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <img src="/logo.png" alt="AMI Credit" style={{ width: 180, margin: '0 auto 12px auto' }} />
        <h2 style={{ margin: 0, fontWeight: 700 }}>Forgot Password?</h2>
        <p style={{ margin: 0, color: '#555' }}>Enter your email to reset your password.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{ padding: 10, borderRadius: 6, border: error ? '1.5px solid #e74c3c' : '1.5px solid #eee', outline: 'none', fontSize: 16 }}
            required
          />
        </div>
        {error && <div style={{ color: '#e74c3c', fontSize: 15 }}>{error}</div>}
        {message && <div style={{ color: '#27ae60', fontSize: 15 }}>{message}</div>}
        <button type="submit" disabled={loading} style={{ background: '#e65c00', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 0', fontSize: 17, fontWeight: 600, cursor: 'pointer', marginBottom: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Sending...' : 'Send Reset Email'}
        </button>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 15 }}>
          <Link to="/login" style={{ color: '#222', fontWeight: 600 }}>Back to Login</Link>
        </div>
      </form>
    </div>
  );
} 