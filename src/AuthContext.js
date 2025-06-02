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
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        if (session && session.user) {
          setUser(session.user);
          fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    }
    restoreSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
      } else {
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
    const { data, error } = await supabase
      .from('users')
      .select('email, full_name, twilio_phone_number, role')
      .eq('id', userId)
      .single();
    if (!error) setUserProfile(data);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
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