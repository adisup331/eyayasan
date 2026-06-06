import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Villages } from '@/screens/Villages';
import { refreshData } from '@/app/actions';

export default async function VillagesPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const villagesRes = await scopeToFoundation(supabase.from('villages').select('*'), ctx);

  async function onRefresh() {
    'use server';
    await refreshData('/villages');
  }

  return (
    <Villages
      data={villagesRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
