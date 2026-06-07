import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Groups } from '@/screens/Groups';
import { refreshData } from '@/app/actions';

export default async function GroupsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [groupsRes, orgsRes, membersRes, rolesRes, villagesRes, workplacesRes, divisionsRes] =
    await Promise.all([
      scopeToFoundation(supabase.from('groups').select('*, villages(name)'), ctx),
      scopeToFoundation(supabase.from('organizations').select('id, name, foundation_id'), ctx),
      scopeToFoundation(supabase.from('members').select('id, full_name, nickname, email, phone, gender, birth_date, grade, member_type, employment_status, workplace, workplace_id, role_id, organization_id, group_id, foundation_id'), ctx),
      ctx.isSuperAdmin || !ctx.foundationId
        ? supabase.from('roles').select('*')
        : supabase.from('roles').select('*').or(`foundation_id.eq.${ctx.foundationId},foundation_id.is.null`),
      scopeToFoundation(supabase.from('villages').select('*'), ctx),
      scopeToFoundation(supabase.from('workplaces').select('*'), ctx),
      scopeToFoundation(supabase.from('divisions').select('*').order('order_index', { ascending: true }), ctx),
    ]);

  async function onRefresh() {
    'use server';
    await refreshData('/groups');
  }

  return (
    <Groups
      data={groupsRes.data || []}
      organizations={orgsRes.data || []}
      members={membersRes.data || []}
      roles={rolesRes.data || []}
      villages={villagesRes.data || []}
      workplaces={workplacesRes.data || []}
      divisions={divisionsRes.data || []}
      foundations={ctx.foundations}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
