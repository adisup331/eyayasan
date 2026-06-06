import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Roles } from '@/screens/Roles';
import { refreshData } from '@/app/actions';

export default async function RolesPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [rolesRes, workplacesRes] = await Promise.all([
    ctx.isSuperAdmin || !ctx.foundationId
      ? supabase.from('roles').select('*')
      : supabase.from('roles').select('*').or(`foundation_id.eq.${ctx.foundationId},foundation_id.is.null`),
    scopeToFoundation(supabase.from('workplaces').select('*'), ctx),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/roles');
  }

  return (
    <Roles
      data={rolesRes.data || []}
      workplaces={workplacesRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
