/**
 * AuthContext.jsx
 * Manages Supabase session, user profile, login, logout, and route authorization
 * (src/context/AuthContext.jsx)
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase, setRememberMePreference } from '../lib/supabaseClient';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from the "profiles" table (id, full_name, role, unit, is_active)
  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, unit, is_active, permissions')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Error fetching profile from Supabase:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      return null;
    }
  }, []);

  // Update only the last_login column
  const updateLastLogin = useCallback(async (userId) => {
    try {
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (err) {
      console.warn('Could not update last_login timestamp:', err);
    }
  }, []);

  // Handle session change & profile population
  const handleSession = useCallback(
    async (currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user || null);

      if (currentSession?.user) {
        const userProf = await fetchProfile(currentSession.user.id);
        if (userProf) {
          if (!userProf.is_active) {
            // Disabled account: force logout immediately
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          setProfile(userProf);
        } else {
          // Fallback if profile row is not yet created in Supabase
          const fallbackProfile = {
            id: currentSession.user.id,
            email: currentSession.user.email || '',
            full_name:
              currentSession.user.user_metadata?.full_name ||
              currentSession.user.email?.split('@')[0] ||
              'Factory Member',
            role: currentSession.user.user_metadata?.role || 'user',
            unit: 'all',
            is_active: true,
            permissions: currentSession.user.user_metadata?.permissions || {},
            last_login: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    },
    [fetchProfile]
  );

  useEffect(() => {
    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      handleSession(initSession);
    }).catch(() => {
      setLoading(false);
    });

    // 2. Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (newSession) {
        handleSession(newSession);
      } else {
        setLoading(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [handleSession]);

  /**
   * Primary signIn implementation:
   * 1. saves "Remember me" preference
   * 2. executes supabase.auth.signInWithPassword
   * 3. fetches the row from "profiles" (id, full_name, role, unit, is_active)
   * 4. if is_active = false, signs out immediately and shows "Your account is disabled. Contact admin."
   * 5. updates profiles.last_login on successful login (only last_login)
   */
  const signIn = async ({ email, password, rememberMe }) => {
    if (rememberMe !== undefined) {
      setRememberMePreference(rememberMe);
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      throw new Error('Please enter your factory email address.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    let authResponse;
    try {
      authResponse = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
    } catch (err) {
      if (err?.message?.toLowerCase().includes('failed to fetch') || err?.message?.toLowerCase().includes('network')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      throw new Error(err?.message || 'Login failed. Please verify your credentials.');
    }

    if (authResponse.error) {
      const msg = authResponse.error.message.toLowerCase();
      if (msg.includes('invalid') || msg.includes('credential')) {
        throw new Error('Invalid login credentials. Please check your email and password.');
      }
      if (msg.includes('network') || msg.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      throw new Error(authResponse.error.message);
    }

    const authUser = authResponse.data.user;
    if (!authUser) {
      throw new Error('Could not retrieve user authentication record.');
    }

    // Fetch the profile row
    const userProfile = await fetchProfile(authUser.id);

    // Inactive account check
    if (userProfile && !userProfile.is_active) {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      throw new Error('Your account is disabled. Contact admin.');
    }

    // Update last_login timestamp on successful login
    await updateLastLogin(authUser.id);

    const finalProfile = userProfile || {
      id: authUser.id,
      email: authUser.email || trimmedEmail,
      full_name: authUser.user_metadata?.full_name || trimmedEmail.split('@')[0],
      role: authUser.user_metadata?.role || 'user',
      unit: 'all',
      is_active: true,
      last_login: new Date().toISOString(),
    };

    setSession(authResponse.data.session);
    setUser(authUser);
    setProfile(finalProfile);

    return { user: authUser, profile: finalProfile };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const resetPassword = async (email) => {
    const trimmed = email.trim();
    if (!trimmed) {
      throw new Error('Please enter the email address associated with your factory account.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
    if (error) {
      throw new Error(error.message);
    }
    return {
      success: true,
      message: `Password reset instructions have been sent to ${trimmed}. Please check your inbox.`,
    };
  };

  const refreshProfile = async () => {
    if (!user) return null;
    const p = await fetchProfile(user.id);
    if (p) setProfile(p);
    return p;
  };

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      signIn,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [session, user, profile, loading, fetchProfile, updateLastLogin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
