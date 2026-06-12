import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'supabase_url';
const STORAGE_KEY_ANON = 'supabase_anon_key';

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedAnon = '';

/**
 * Check if environment credentials exist.
 */
export function isUsingEnvCredentials(): boolean {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return !!(envUrl && envAnon);
}

/**
 * Get or create a Supabase client.
 * Returns null if credentials are not configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  // Prioritize environment variables, fallback to localStorage
  const url = envUrl || localStorage.getItem(STORAGE_KEY_URL) || '';
  const anon = envAnon || localStorage.getItem(STORAGE_KEY_ANON) || '';

  if (!url || !anon) {
    cachedClient = null;
    return null;
  }

  // Reuse cached client if credentials haven't changed
  if (cachedClient && cachedUrl === url && cachedAnon === anon) {
    return cachedClient;
  }

  cachedUrl = url;
  cachedAnon = anon;
  cachedClient = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'inventario-auth',
    },
  });

  return cachedClient;
}

/**
 * Save Supabase credentials to localStorage.
 */
export function saveSupabaseCredentials(url: string, anonKey: string): void {
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
  // Invalidate cached client so it gets recreated
  cachedClient = null;
  cachedUrl = '';
  cachedAnon = '';
}

/**
 * Get stored credentials (for display in settings).
 * Returns environment values if set, otherwise localStorage.
 */
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envAnon) {
    return { url: envUrl, anonKey: envAnon };
  }

  return {
    url: localStorage.getItem(STORAGE_KEY_URL) || '',
    anonKey: localStorage.getItem(STORAGE_KEY_ANON) || '',
  };
}

/**
 * Check if Supabase is configured (either by Env vars or LocalStorage).
 */
export function isSupabaseConfigured(): boolean {
  if (isUsingEnvCredentials()) return true;
  
  const url = localStorage.getItem(STORAGE_KEY_URL) || '';
  const anon = localStorage.getItem(STORAGE_KEY_ANON) || '';
  return !!(url && anon);
}
