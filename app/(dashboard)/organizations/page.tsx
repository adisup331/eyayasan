import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getOrganizationsCached, getRolesCached } from '@/lib/cache';
import { Organizations } from '@/screens/Organizations';
import { refreshData } from '@/app/actions';

export default async function OrganizationsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [organizations, membersRes, roles, groupsRes] = await Promise.all([
    getOrganizationsCached(ctx.foundationId),
    scopeToFoundation(supabase.from('members').select('id, full_name, email, phone, role_id, organization_id, gender, origin, birth_date, group_id, roles(name)'), ctx),
    getRolesCached(ctx.foundationId),
    scopeToFoundation(supabase.from('groups').select('id, name, organization_id'), ctx),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/organizations');
  }

  return (
    <Organizations
      data={organizations}
      members={membersRes.data || []}
      roles={roles}
      groups={groupsRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
