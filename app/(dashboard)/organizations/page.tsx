import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Organizations } from '@/screens/Organizations';
import { refreshData } from '@/app/actions';

export default async function OrganizationsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [orgsRes, membersRes, rolesRes, groupsRes] = await Promise.all([
    scopeToFoundation(supabase.from('organizations').select('id, name, description, type, foundation_id'), ctx),
    scopeToFoundation(supabase.from('members').select('id, full_name, email, phone, role_id, organization_id, gender, origin, birth_date, group_id, roles(name)'), ctx),
    ctx.isSuperAdmin || !ctx.foundationId
      ? supabase.from('roles').select('*')
      : supabase.from('roles').select('*').or(`foundation_id.eq.${ctx.foundationId},foundation_id.is.null`),
    scopeToFoundation(supabase.from('groups').select('id, name, organization_id'), ctx),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/organizations');
  }

  return (
    <Organizations
      data={orgsRes.data || []}
      members={membersRes.data || []}
      roles={rolesRes.data || []}
      groups={groupsRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
