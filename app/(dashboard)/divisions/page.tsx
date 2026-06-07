import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getDivisionsCached } from '@/lib/cache';
import { Divisions } from '@/screens/Divisions';
import { refreshData } from '@/app/actions';

export default async function DivisionsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [divisions, membersRes, programsRes] = await Promise.all([
    getDivisionsCached(ctx.foundationId),
    scopeToFoundation(supabase.from('members').select('id, full_name, division_id'), ctx),
    scopeToFoundation(supabase.from('programs').select('*'), ctx),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/divisions');
  }

  return (
    <Divisions
      data={divisions}
      members={membersRes.data || []}
      programs={programsRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
