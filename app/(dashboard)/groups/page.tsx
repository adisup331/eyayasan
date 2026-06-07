import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getOrganizationsCached, getRolesCached, getVillagesCached, getWorkplacesCached, getDivisionsCached } from '@/lib/cache';
import { Groups } from '@/screens/Groups';
import { refreshData } from '@/app/actions';

export default async function GroupsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const fid = ctx.foundationId;
  const [groupsRes, organizations, membersRes, roles, villages, workplaces, divisions] =
    await Promise.all([
      scopeToFoundation(supabase.from('groups').select('*, villages(name)'), ctx),
      getOrganizationsCached(fid),
      scopeToFoundation(supabase.from('members').select('id, full_name, nickname, email, phone, gender, birth_date, grade, member_type, employment_status, workplace, workplace_id, role_id, organization_id, group_id, foundation_id'), ctx),
      getRolesCached(fid),
      getVillagesCached(fid),
      getWorkplacesCached(fid),
      getDivisionsCached(fid),
    ]);

  async function onRefresh() {
    'use server';
    await refreshData('/groups');
  }

  return (
    <Groups
      data={groupsRes.data || []}
      organizations={organizations}
      members={membersRes.data || []}
      roles={roles}
      villages={villages}
      workplaces={workplaces}
      divisions={divisions}
      foundations={ctx.foundations}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
