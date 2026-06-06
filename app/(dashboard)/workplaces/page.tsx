import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Workplaces } from '@/screens/Workplaces';
import { refreshData } from '@/app/actions';

export default async function WorkplacesPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [workplacesRes, membersRes] = await Promise.all([
    scopeToFoundation(supabase.from('workplaces').select('*'), ctx),
    scopeToFoundation(supabase.from('members').select('*, roles(name, permissions)'), ctx),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/workplaces');
  }

  return (
    <Workplaces
      data={workplacesRes.data || []}
      members={membersRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
