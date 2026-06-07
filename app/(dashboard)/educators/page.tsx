import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getOrganizationsCached, getRolesCached } from '@/lib/cache';
import { Educators } from '@/screens/Educators';

export default async function EducatorsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [membersRes, organizations, roles] = await Promise.all([
    scopeToFoundation(supabase.from('members').select('*, roles(name, permissions), organizations(name)'), ctx),
    getOrganizationsCached(ctx.foundationId),
    getRolesCached(ctx.foundationId),
  ]);

  return (
    <Educators
      members={membersRes.data || []}
      organizations={organizations}
      roles={roles}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
