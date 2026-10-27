/**
 * Supabase Client Configuration
 * GarmentsERP (src/lib/supabaseClient.js)
 */
import { createClient } from '@supabase/supabase-js';

// Resolve project URL ensuring it is always a valid HTTP/HTTPS URL
function getSanitizedSupabaseUrl() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  if (
    typeof envUrl === 'string' &&
    (envUrl.trim().startsWith('http://') || envUrl.trim().startsWith('https://')) &&
    !envUrl.includes('your-project-id')
  ) {
    return envUrl.trim();
  }
  // Target production Supabase project URL
  return 'https://kuijnmyyafpzhnbesemh.supabase.co';
}

// Resolve anon/publishable key ensuring public key is used
function getSanitizedSupabaseAnonKey() {
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const envUrl = import.meta.env.VITE_SUPABASE_URL;

  // 1. If VITE_SUPABASE_ANON_KEY is a publishable key
  if (typeof envKey === 'string' && envKey.trim().startsWith('sb_publishable_')) {
    return envKey.trim();
  }

  // 2. If publishable key was provided in VITE_SUPABASE_URL by mistake
  if (typeof envUrl === 'string' && envUrl.trim().startsWith('sb_publishable_')) {
    return envUrl.trim();
  }

  // 3. If standard anon JWT or token
  if (
    typeof envKey === 'string' &&
    envKey.trim().length > 20 &&
    !envKey.trim().startsWith('sb_secret_') &&
    envKey.trim() !== 'your-anon-key-here'
  ) {
    return envKey.trim();
  }

  // Target production Supabase publishable key
  return 'sb_publishable_r8nYXZ56AaYlNeFTHC0tgA_bUB7NFCU';
}

const supabaseUrl = getSanitizedSupabaseUrl();
const supabaseAnonKey = getSanitizedSupabaseAnonKey();

export const REMEMBER_ME_KEY = 'garments_erp_remember_me';

/**
 * Check if user opted into persistent storage ("Remember me")
 */
export function getRememberMePreference() {
  const value = localStorage.getItem(REMEMBER_ME_KEY);
  return value !== 'false';
}

export function setRememberMePreference(remember) {
  localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
  if (!remember) {
    // If not remembered, transfer auth tokens to sessionStorage so session ends when browser closes
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
        const val = localStorage.getItem(key);
        if (val) {
          sessionStorage.setItem(key, val);
          localStorage.removeItem(key);
        }
      }
    }
  }
}

/**
 * Storage adapter dynamically respecting Remember Me:
 * - If Remember Me is TRUE: writes to localStorage (persists across browser restarts)
 * - If Remember Me is FALSE: writes to sessionStorage (session ends when browser closes)
 */
const dynamicStorageAdapter = {
  getItem: (key) => {
    const remember = getRememberMePreference();
    if (remember) {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    }
    return sessionStorage.getItem(key);
  },
  setItem: (key, value) => {
    const remember = getRememberMePreference();
    if (remember) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: dynamicStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
