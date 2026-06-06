import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Forums } from '@/screens/Forums';
import { refreshData } from '@/app/actions';

export default async function ForumsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [forumsRes, membersRes, groupsRes, rolesRes, divisionsRes, orgsRes, workplacesRes] =
    await Promise.all([
      scopeToFoundation(supabase.from('forums').select('*'), ctx),
      scopeToFoundation(supabase.from('members').select('*, roles(name, permissions)'), ctx),
      scopeToFoundation(supabase.from('groups').select('*, foundations(name), villages(name)'), ctx),
      ctx.isSuperAdmin || !ctx.foundationId
        ? supabase.from('roles').select('*')
        : supabase.from('roles').select('*').or(`foundation_id.eq.${ctx.foundationId},foundation_id.is.null`),
      scopeToFoundation(supabase.from('divisions').select('*').order('order_index', { ascending: true }), ctx),
      scopeToFoundation(supabase.from('organizations').select('*, foundations(name)'), ctx),
      scopeToFoundation(supabase.from('workplaces').select('*'), ctx),
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
      roles={rolesRes.data || []}
      divisions={divisionsRes.data || []}
      organizations={orgsRes.data || []}
      foundations={ctx.foundations}
      workplaces={workplacesRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
