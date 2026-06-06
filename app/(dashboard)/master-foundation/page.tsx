import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/auth';
import { Foundations } from '@/screens/Foundations';
import { refreshData } from '@/app/actions';

export default async function MasterFoundationPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  // Super-admin only (ports the App.tsx <Navigate to="/" /> guard).
  if (!ctx.isSuperAdmin) redirect('/');

  async function onRefresh() {
    'use server';
    await refreshData('/master-foundation');
  }

  return <Foundations data={ctx.foundations} onRefresh={onRefresh} />;
}
