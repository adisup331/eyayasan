'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

// Generic refresh hook passed to screens as `onRefresh`. After a client-side
// mutation (still done via the browser Supabase client + protected by RLS),
// this re-runs the server fetch for the current route so the UI reflects the
// new data. Replaces the old in-memory fetchData() refetch.
//
// Juga invalidasi cache data master (lib/cache.ts) — karena mutasi bisa
// mengubah divisions/roles/orgs/dll yang di-cache lintas halaman.
export async function refreshData(path: string = '/') {
  revalidateTag('master');
  revalidatePath(path, 'layout');
}
