import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://omwahioyabezqaomakjz.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9td2FoaW95YWJlenFhb21ha2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDU4NjUsImV4cCI6MjA2MzkyMTg2NX0.X8BsDRC1H_7CVEtmYDQcLS_O1AM_LFaIRzk2urNAI0o';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // { email, full_name, twilio_phone_number }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      console.log('[AuthContext] Running restoreSession...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[AuthContext] restoreSession result:', session);
      if (mounted) {
        if (session && session.user) {
          console.log('[AuthContext] Session found, setting user:', session.user);
          setUser(session.user);
          fetchUserProfile(session.user.id);
        } else {
          console.log('[AuthContext] No session found, clearing user and userProfile');
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    }
    restoreSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] onAuthStateChange event:', event, 'session:', session);
      if (session && session.user) {
        console.log('[AuthContext] Auth state change: user logged in:', session.user);
        setUser(session.user);
        fetchUserProfile(session.user.id);
      } else {
        console.log('[AuthContext] Auth state change: user logged out or no session');
        setUser(null);
        setUserProfile(null);
      }
    });
    return () => {
      mounted = false;
      listener?.unsubscribe?.();
    };
    // eslint-disable-next-line
  }, []);

  async function fetchUserProfile(userId) {
    console.log('[AuthContext] fetchUserProfile called with userId:', userId);
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, twilio_phone_number, role, team_id')
      .eq('id', userId)
      .single();
    console.log('[AuthContext] fetchUserProfile result:', { userId, data, error });
    if (!error) {
      console.log('[AuthContext] Setting userProfile:', data);
      setUserProfile(data);
    } else {
      console.error('[AuthContext] Error fetching user profile:', error);
    }
  }

  async function logout() {
    console.log('[AuthContext] logout called');
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
    console.log('[AuthContext] User and userProfile cleared after logout');
  }

  const value = {
    user,
    userProfile,
    loading,
    supabase,
    setUser,
    setUserProfile,
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
} 