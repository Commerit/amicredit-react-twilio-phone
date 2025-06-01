import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const { supabase, setUser, setUserProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twilioPhone, setTwilioPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.match(/^[^@]+@[^@]+\.[^@]+$/)) {
      setError('Invalid email format');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError("Password didn't match");
      return;
    }
    if (!twilioPhone.match(/^\+\d{10,15}$/)) {
      setError('Invalid phone number format');
      return;
    }
    setLoading(true);
    // 1. Create Supabase Auth user
    const { user, error: signupError } = await supabase.auth.signUp({ email, password });
    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }
    if (!user) {
      setError('Signup failed.');
      setLoading(false);
      return;
    }
    setUser(user);
    // 2. Insert into users table
    const { data, error: userError } = await supabase
      .from('users')
      .insert({ id: user.id, email, full_name: fullName, twilio_phone_number: twilioPhone, role: 'agent' })
      .single();
    if (userError) {
      setError(userError.message);
      setLoading(false);
      return;
    }
    setUserProfile(data);
    navigate('/');
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
      <form onSubmit={handleSignup} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px #0001', padding: 40, width: 400, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <img src="/logo.png" alt="AMI Credit" style={{ width: 180, margin: '0 auto 12px auto' }} />
        <h2 style={{ margin: 0, fontWeight: 700 }}>Let&apos;s sign you up</h2>
        <p style={{ margin: 0, color: '#555' }}>Enter your details to create your account.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="e.g. John Doe"
            style={{ padding: 10, borderRadius: 6, border: '1.5px solid #eee', outline: 'none', fontSize: 16 }}
            required
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="e.g. mycompany@email.com"
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
            placeholder="Create a strong password"
            style={{ padding: 10, borderRadius: 6, border: error && password.length < 6 ? '1.5px solid #e74c3c' : '1.5px solid #eee', outline: 'none', fontSize: 16 }}
            required
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            style={{ padding: 10, borderRadius: 6, border: error && password !== confirmPassword ? '1.5px solid #e74c3c' : '1.5px solid #eee', outline: 'none', fontSize: 16 }}
            required
          />
          {error && password !== confirmPassword && <span style={{ color: '#e74c3c', fontSize: 13 }}>Password didn&apos;t match</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontWeight: 500 }}>Twilio Phone Number</label>
          <input
            type="text"
            value={twilioPhone}
            onChange={e => setTwilioPhone(e.target.value)}
            placeholder="e.g. +12345678901"
            style={{ padding: 10, borderRadius: 6, border: error && !twilioPhone.match(/^\+\d{10,15}$/) ? '1.5px solid #e74c3c' : '1.5px solid #eee', outline: 'none', fontSize: 16 }}
            required
          />
          {error && !twilioPhone.match(/^\+\d{10,15}$/) && <span style={{ color: '#e74c3c', fontSize: 13 }}>Invalid phone number format</span>}
        </div>
        {error && <div style={{ color: '#e74c3c', fontSize: 15, marginTop: -8 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ background: '#e65c00', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 0', fontSize: 17, fontWeight: 600, cursor: 'pointer', marginBottom: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 15 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#222', fontWeight: 600 }}>Login</Link>
        </div>
      </form>
    </div>
  );
} 