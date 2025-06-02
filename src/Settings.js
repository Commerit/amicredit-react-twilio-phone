import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export default function Settings() {
  const { user, supabase } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    // Only attempt password change if any password field is filled
    if (currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError("Please fill in all password fields to change your password.");
        setLoading(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      try {
        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwError) {
          if (pwError.message && (pwError.message.toLowerCase().includes('reauth') || pwError.message.toLowerCase().includes('token'))) {
            setError("Password change failed: Please log out and log in again, then try changing your password.");
          } else {
            setError("Failed to update password: " + pwError.message);
          }
          setLoading(false);
          return;
        }
        setSuccess("Password updated successfully.");
      } catch (err) {
        setError("Unexpected error updating password: " + (err.message || err));
        setLoading(false);
        return;
      }
    } else {
      setError("Please fill in all password fields to change your password.");
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', padding: '32px 0', overflow: 'auto' }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontWeight: 700, fontSize: 32, marginBottom: 8 }}>Settings</h1>
        <div style={{ color: '#6b7280', marginBottom: 32 }}>Change your password</div>
        <form onSubmit={handleSave} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 16px #0001', padding: 40, maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32, maxHeight: '70vh', overflowY: 'auto', position: 'relative' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 0 }}>Password</h2>
            <div style={{ color: '#6b7280', marginBottom: 18, fontSize: 15 }}>Update your account security.</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 500, display: 'block', marginBottom: 6 }}>Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid #eee', fontSize: 16 }} autoComplete="current-password" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 500, display: 'block', marginBottom: 6 }}>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid #eee', fontSize: 16 }} autoComplete="new-password" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 500, display: 'block', marginBottom: 6 }}>Confirm new Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid #eee', fontSize: 16 }} autoComplete="new-password" />
            </div>
          </div>
          {error && <div style={{ color: '#e74c3c', fontWeight: 500 }}>{error}</div>}
          {success && <div style={{ color: '#27ae60', fontWeight: 500 }}>{success}</div>}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', background: '#fff', position: 'sticky', bottom: 0, padding: '16px 0 0 0' }}>
            <button type="button" onClick={handleCancel} style={{ background: '#fff', color: '#222', border: '1.5px solid #eee', borderRadius: 6, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ background: '#e65c00', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
} 