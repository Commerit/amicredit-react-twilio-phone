import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const { supabase, setUser, setUserProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    const user = data?.user;
    if (loginError) {
      setError(loginError.message === 'Invalid login credentials' ? 'Incorrect password' : loginError.message);
      setLoading(false);
      return;
    }
    if (user) {
      setUser(user);
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('email, full_name, twilio_phone_number, role')
        .eq('id', user.id)
        .single();
      if (!profileError) setUserProfile(profileData);
      navigate('/');
    } else {
      setError('Login failed.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
      <form onSubmit={handleLogin} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px #0001', padding: 40, width: 400, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <img src="/logo.png" alt="AMI Credit" style={{ width: 180, margin: '0 auto 12px auto' }} />
        <h2 style={{ margin: 0, fontWeight: 700 }}>Welcome back</h2>
        <p style={{ margin: 0, color: '#555' }}>Please enter your account credentials.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{ padding: 10, borderRadius: 6, border: error && !email.match(/^[^@]+@[^@]+\.[^@]+$/) ? '1.5px solid #e74c3c' : '1.5px solid #eee', outline: 'none', fontSize: 16 }}
            required
          />
          {error && !email.match(/^[^@]+@[^@]+\.[^@]+$/) && <span style={{ color: '#e74c3c', fontSize: 13 }}>Invalid email format</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={{ padding: 10, borderRadius: 6, border: error && password ? '1.5px solid #e74c3c' : '1.5px solid #eee', outline: 'none', fontSize: 16 }}
            required
          />
          {error && password && <span style={{ color: '#e74c3c', fontSize: 13 }}>{error}</span>}
        </div>
        <div style={{ marginBottom: 8 }}>
          <Link to="/forgot-password" style={{ color: '#e65c00', fontWeight: 500, fontSize: 15, textDecoration: 'none' }}>Forgot Password?</Link>
        </div>
        <button type="submit" disabled={loading} style={{ background: '#e65c00', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 0', fontSize: 17, fontWeight: 600, cursor: 'pointer', marginBottom: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 15 }}>
          Don&apos;t have an account?{' '}
          <Link to="/signup" style={{ color: '#222', fontWeight: 600 }}>Sign Up</Link>
        </div>
      </form>
    </div>
  );
} 