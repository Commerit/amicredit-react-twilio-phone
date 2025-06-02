import React, { useState, useRef } from "react";
import { useAuth } from "./AuthContext";

const MAX_AVATAR_SIZE = 256 * 1024 * 1024; // 256MB

export default function Settings() {
  const { user, userProfile, supabase, setUserProfile } = useAuth();
  const [fullName, setFullName] = useState(userProfile?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatar_url || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef();

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size <= MAX_AVATAR_SIZE) {
      setAvatarFile(file);
      setAvatarUrl(URL.createObjectURL(file));
    } else {
      setError("Avatar must be less than 256MB and a valid image file.");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    let newAvatarUrl = avatarUrl;
    // Upload avatar if changed
    if (avatarFile) {
<<<<<<< HEAD
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      formData.append('userId', user.id);
      try {
        const response = await fetch('/api/upload-avatar', {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
          setError("Failed to upload avatar: " + (result.error || 'Unknown error'));
          setLoading(false);
          return;
        }
        newAvatarUrl = result.avatar_url || newAvatarUrl;
      } catch (err) {
        setError("Unexpected error uploading avatar: " + (err.message || err));
=======
      const fileExt = avatarFile.name.split('.').pop();
      const filePath = `avatars/${user.id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
      if (uploadError) {
        setError("Failed to upload avatar.");
>>>>>>> parent of 37039ae (.)
        setLoading(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      newAvatarUrl = publicUrlData?.publicUrl || newAvatarUrl;
    }
    // Update user profile
    const { error: updateError, data: updatedProfile } = await supabase
      .from('users')
      .update({ full_name: fullName, avatar_url: newAvatarUrl })
      .eq('id', user.id)
      .select()
      .single();
    if (updateError) {
      setError("Failed to update profile.");
      setLoading(false);
      return;
    }
    setUserProfile(updatedProfile);
    // Change password if requested
    if (currentPassword && newPassword && newPassword === confirmPassword) {
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) {
        setError("Failed to update password: " + pwError.message);
        setLoading(false);
        return;
      }
    } else if (newPassword || confirmPassword) {
      setError("Passwords do not match or are incomplete.");
      setLoading(false);
      return;
    }
    setSuccess("Profile updated successfully.");
    setLoading(false);
  };

  const handleCancel = () => {
    setFullName(userProfile?.full_name || "");
    setAvatarUrl(userProfile?.avatar_url || "");
    setAvatarFile(null);
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
        <div style={{ color: '#6b7280', marginBottom: 32 }}>Manage your preferences, account details, and app configurations</div>
        <form onSubmit={handleSave} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 16px #0001', padding: 40, maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32, maxHeight: '70vh', overflowY: 'auto', position: 'relative' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 0 }}>Profile</h2>
            <div style={{ color: '#6b7280', marginBottom: 18, fontSize: 15 }}>This is how others will see you on the site.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 18 }}>
              <img src={avatarUrl || "/avatar-placeholder.png"} alt="Avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }} />
              <div>
                <input type="file" accept="image/png,image/jpeg,image/jpg" style={{ display: 'none' }} ref={fileInputRef} onChange={handleAvatarChange} />
                <button type="button" onClick={() => fileInputRef.current.click()} style={{ padding: '8px 18px', borderRadius: 6, border: '1.5px solid #eee', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Upload new Avatar</button>
                <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Max 256mb of png, jpeg, jpg</div>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 500, display: 'block', marginBottom: 6 }}>Full name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 6, border: '1.5px solid #eee', fontSize: 16 }} />
            </div>
          </div>
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