
import { createClient } from '@supabase/supabase-js';
import { User, UserRole } from './types';

/**
 * DEPLOYMENT NOTE:
 * Replace these values with your actual Supabase Project URL and Anon Key
 * found in Settings -> API of your Supabase dashboard.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-live-anon-key';

export const isSupabaseConfigured = 
  SUPABASE_URL !== 'https://your-project-id.supabase.co' && 
  SUPABASE_ANON_KEY !== 'your-live-anon-key' &&
  SUPABASE_URL.length > 0 &&
  SUPABASE_ANON_KEY.length > 0;

/**
 * Single Supabase Instance
 * This singleton is used for all DB and Auth interactions.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Helper to map Supabase User metadata to our application's User type.
 */
export const mapSupabaseUser = (supabaseUser: any): User | null => {
  if (!supabaseUser) return null;

  const metadata = supabaseUser.user_metadata || {};
  
  return {
    id: supabaseUser.id,
    name: metadata.full_name || supabaseUser.email?.split('@')[0] || 'Unknown User',
    role: (metadata.role as UserRole) || UserRole.STAFF,
    branch_id: metadata.branch_id || 'LOC-JHB-01'
  };
};
