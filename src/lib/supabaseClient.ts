import { createClient } from '@supabase/supabase-js';

// Client for browser / frontend usage (public anon key)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep minimal runtime failure mode; apps should surface env issues earlier.
  // Do not throw here to allow server-side tools to read the file during build.
  // Log for developer awareness in dev only.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export default supabase;
