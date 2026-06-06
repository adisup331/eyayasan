'use client';

import { createClient } from '@/lib/supabase/client';

// Backwards-compatible singleton used by client components and screens that
// import `../supabaseClient`. Backed by the cookie-aware browser client so
// auth state stays in sync with the server (middleware + Server Components).
export const supabase = createClient();
