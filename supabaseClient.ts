import { createClient } from '@supabase/supabase-js';

// PENTING: Untuk Vercel, Anda WAJIB mengatur Environment Variables di dashboard Vercel
// Settings -> Environment Variables
// VITE_SUPABASE_URL = (URL Project Supabase Anda)
// VITE_SUPABASE_ANON_KEY = (Anon Key Project Supabase Anda)

// Use optional chaining to prevent crash if import.meta.env is undefined in some environments
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://vdbgowimtatttfkhozee.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_g8-fcRHexioK2BzjbgEBsA_VgWc0JO0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);