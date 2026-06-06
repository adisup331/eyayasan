import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Members } from '@/screens/Members';
import { refreshData } from '@/app/actions';

// Server Component: fetches members + related lookups scoped to the user's
// foundation, then renders the interactive (client) Members screen. Replaces
// the data this page used to receive via prop-drilling from App.tsx.
export default async function MembersPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;

  const supabase = await createClient();

  const [membersRes, rolesRes, divisionsRes, orgsRes, groupsRes, workplacesRes] =
    await Promise.all([
      scopeToFoundation(
        supabase.from('members').select('*, roles(name, permissions), foundations(name), organizations(name), groups(name)'),
        ctx
      ),
      ctx.isSuperAdmin || !ctx.foundationId
        ? supabase.from('roles').select('*')
        : supabase.from('roles').select('*').or(`foundation_id.eq.${ctx.foundationId},foundation_id.is.null`),
      scopeToFoundation(supabase.from('divisions').select('*').order('order_index', { ascending: true }), ctx),
      scopeToFoundation(supabase.from('organizations').select('*, foundations(name)'), ctx),
      scopeToFoundation(supabase.from('groups').select('*, foundations(name), villages(name)'), ctx),
      scopeToFoundation(supabase.from('workplaces').select('*'), ctx),
    ]);

  async function onRefresh() {
    'use server';
    await refreshData('/members');
  }

  return (
    <Members
      data={membersRes.data || []}
      roles={rolesRes.data || []}
      divisions={divisionsRes.data || []}
      organizations={orgsRes.data || []}
      foundations={ctx.foundations}
      groups={groupsRes.data || []}
      workplaces={workplacesRes.data || []}
      onRefresh={onRefresh}
      isSuperAdmin={ctx.isSuperAdmin}
      activeFoundation={ctx.activeFoundation}
    />
  );
}
