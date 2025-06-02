import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export default function Settings() {
  const { user, userProfile, supabase, setUserProfile } = useAuth();
  // Name state
  const [fullName, setFullName] = useState(userProfile?.full_name || "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState("");
  const [nameError, setNameError] = useState("");
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");

  // Save name only
  const handleSaveName = async (e) => {
    e.preventDefault();
    setNameLoading(true);
    setNameError("");
    setNameSuccess("");
    const { error: updateError, data: updatedProfile } = await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('id', user.id)
      .select()
      .single();
    if (updateError) {
      setNameError("Failed to update name: " + updateError.message);
      setNameLoading(false);
      return;
    }
    setUserProfile(updatedProfile);
    setNameSuccess("Name updated successfully.");
    setNameLoading(false);
  };

  // Save password only
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPwLoading(true);
    setPwError("");
    setPwSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError("Please fill in all password fields.");
      setPwLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      setPwLoading(false);
      return;
    }
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) {
        if (pwError.message && (pwError.message.toLowerCase().includes('reauth') || pwError.message.toLowerCase().includes('token'))) {
          setPwError("Password change failed: Please log out and log in again, then try changing your password.");
        } else {
          setPwError("Failed to update password: " + pwError.message);
        }
        setPwLoading(false);
        return;
      }
    } catch (err) {
      setPwError("Unexpected error updating password: " + (err.message || err));
      setPwLoading(false);
      return;
    }
    setPwSuccess("Password updated successfully.");
    setPwLoading(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', padding: '32px 0', overflow: 'auto' }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontWeight: 700, fontSize: 32, marginBottom: 8 }}>Settings</h1>
        <div style={{ color: '#6b7280', marginBottom: 32 }}>Manage your preferences, account details, and app configurations</div>
        {/* Name Change Form */}
        <form onSubmit={handleSaveName} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 16px #0001', padding: 40, maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 0 }}>Change Name</h2>
          <div style={{ color: '#6b7280', marginBottom: 18, fontSize: 15 }}>This is how others will see you on the site.</div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 500, display: 'block', marginBottom: 6 }}>Full name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid #eee', fontSize: 16 }} />
          </div>
          {nameError && <div style={{ color: '#e74c3c', fontWeight: 500 }}>{nameError}</div>}
          {nameSuccess && <div style={{ color: '#27ae60', fontWeight: 500 }}>{nameSuccess}</div>}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={nameLoading} style={{ background: '#e65c00', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: nameLoading ? 0.7 : 1 }}>Save Name</button>
          </div>
        </form>
        {/* Password Change Form */}
        <form onSubmit={handleSavePassword} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 16px #0001', padding: 40, maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 0 }}>Change Password</h2>
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
          {pwError && <div style={{ color: '#e74c3c', fontWeight: 500 }}>{pwError}</div>}
          {pwSuccess && <div style={{ color: '#27ae60', fontWeight: 500 }}>{pwSuccess}</div>}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={pwLoading} style={{ background: '#e65c00', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: pwLoading ? 0.7 : 1 }}>Save Password</button>
          </div>
        </form>
      </div>
    </div>
  );
} 
