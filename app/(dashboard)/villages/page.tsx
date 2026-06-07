import { getUserContext } from '@/lib/auth';
import { getVillagesCached } from '@/lib/cache';
import { Villages } from '@/screens/Villages';
import { refreshData } from '@/app/actions';

export default async function VillagesPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;

  const villages = await getVillagesCached(ctx.foundationId);

  async function onRefresh() {
    'use server';
    await refreshData('/villages');
  }

  return (
    <Villages
      data={villages}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
