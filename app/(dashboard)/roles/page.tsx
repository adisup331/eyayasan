import { getUserContext } from '@/lib/auth';
import { getRolesCached, getWorkplacesCached } from '@/lib/cache';
import { Roles } from '@/screens/Roles';
import { refreshData } from '@/app/actions';

export default async function RolesPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;

  const [roles, workplaces] = await Promise.all([
    getRolesCached(ctx.foundationId),
    getWorkplacesCached(ctx.foundationId),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/roles');
  }

  return (
    <Roles
      data={roles}
      workplaces={workplaces}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
