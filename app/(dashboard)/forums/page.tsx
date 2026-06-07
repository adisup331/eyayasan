import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getRolesCached, getDivisionsCached, getOrganizationsCached, getWorkplacesCached } from '@/lib/cache';
import { Forums } from '@/screens/Forums';
import { refreshData } from '@/app/actions';

export default async function ForumsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const fid = ctx.foundationId;
  const [forumsRes, membersRes, groupsRes, roles, divisions, organizations, workplaces] =
    await Promise.all([
      scopeToFoundation(supabase.from('forums').select('*'), ctx),
      scopeToFoundation(supabase.from('members').select('id, full_name, nickname, email, group_id, groups(name)'), ctx),
      scopeToFoundation(supabase.from('groups').select('id, name'), ctx),
      getRolesCached(fid),
      getDivisionsCached(fid),
      getOrganizationsCached(fid),
      getWorkplacesCached(fid),
    ]);

  async function onRefresh() {
    'use server';
    await refreshData('/forums');
  }

  return (
    <Forums
      data={forumsRes.data || []}
      members={membersRes.data || []}
      groups={groupsRes.data || []}
      roles={roles}
      divisions={divisions}
      organizations={organizations}
      foundations={ctx.foundations}
      workplaces={workplaces}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
