'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser Supabase client — used inside client components for auth and
// interactive mutations. Session is persisted to cookies (via @supabase/ssr)
// so the server can read it in middleware and Server Components.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
