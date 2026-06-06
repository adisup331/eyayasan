import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Educators } from '@/screens/Educators';

export default async function EducatorsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [membersRes, orgsRes, rolesRes] = await Promise.all([
    scopeToFoundation(supabase.from('members').select('*, roles(name, permissions), organizations(name)'), ctx),
    scopeToFoundation(supabase.from('organizations').select('*, foundations(name)'), ctx),
    ctx.isSuperAdmin || !ctx.foundationId
      ? supabase.from('roles').select('*')
      : supabase.from('roles').select('*').or(`foundation_id.eq.${ctx.foundationId},foundation_id.is.null`),
  ]);

  return (
    <Educators
      members={membersRes.data || []}
      organizations={orgsRes.data || []}
      roles={rolesRes.data || []}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
