import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getWorkplacesCached } from '@/lib/cache';
import { Workplaces } from '@/screens/Workplaces';
import { refreshData } from '@/app/actions';

export default async function WorkplacesPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [workplaces, membersRes] = await Promise.all([
    getWorkplacesCached(ctx.foundationId),
    scopeToFoundation(supabase.from('members').select('id, full_name, gender, member_type, workplace_id'), ctx),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/workplaces');
  }

  return (
    <Workplaces
      data={workplaces}
      members={membersRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
