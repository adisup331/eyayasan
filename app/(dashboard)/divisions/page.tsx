import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Divisions } from '@/screens/Divisions';
import { refreshData } from '@/app/actions';

export default async function DivisionsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [divisionsRes, membersRes, programsRes] = await Promise.all([
    scopeToFoundation(supabase.from('divisions').select('*').order('order_index', { ascending: true }), ctx),
    scopeToFoundation(supabase.from('members').select('*, roles(name, permissions)'), ctx),
    scopeToFoundation(supabase.from('programs').select('*'), ctx),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/divisions');
  }

  return (
    <Divisions
      data={divisionsRes.data || []}
      members={membersRes.data || []}
      programs={programsRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
