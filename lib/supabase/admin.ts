import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client — SERVER ONLY. Bypasses RLS, jadi WAJIB hanya
// dipakai di Server Actions/route handlers yang sudah memvalidasi input sendiri.
// JANGAN pernah meng-import file ini dari komponen client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY belum diset. Tambahkan di .env.local (lihat .env.local.example).'
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
