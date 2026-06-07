import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getDivisionsCached, getOrganizationsCached } from '@/lib/cache';
import { Programs } from '@/screens/Programs';
import { refreshData } from '@/app/actions';

export default async function ProgramsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [programsRes, divisions, organizations, membersRes] = await Promise.all([
    scopeToFoundation(supabase.from('programs').select('*'), ctx),
    getDivisionsCached(ctx.foundationId),
    getOrganizationsCached(ctx.foundationId),
    scopeToFoundation(supabase.from('members').select('id, full_name, division_id'), ctx),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/programs');
  }

  return (
    <Programs
      data={programsRes.data || []}
      divisions={divisions}
      organizations={organizations}
      members={membersRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
