import { createClient } from '@supabase/supabase-js';

// Client for browser / frontend usage (public anon key)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep minimal runtime failure mode; apps should surface env issues earlier.
  // Do not throw here to allow server-side tools to read the file during build.
  // Log for developer awareness in dev only.
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn('SUPABASE_URL or SUPABASE_ANON_KEY is not set');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

export default supabase;
