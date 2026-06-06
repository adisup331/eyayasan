'use server';

import { revalidatePath } from 'next/cache';

// Generic refresh hook passed to screens as `onRefresh`. After a client-side
// mutation (still done via the browser Supabase client + protected by RLS),
// this re-runs the server fetch for the current route so the UI reflects the
// new data. Replaces the old in-memory fetchData() refetch.
export async function refreshData(path: string = '/') {
  revalidatePath(path, 'layout');
}
