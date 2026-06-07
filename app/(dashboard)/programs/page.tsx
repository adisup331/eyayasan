import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Programs } from '@/screens/Programs';
import { refreshData } from '@/app/actions';

export default async function ProgramsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [programsRes, divisionsRes, orgsRes, membersRes] = await Promise.all([
    scopeToFoundation(supabase.from('programs').select('*'), ctx),
    scopeToFoundation(supabase.from('divisions').select('*').order('order_index', { ascending: true }), ctx),
    scopeToFoundation(supabase.from('organizations').select('id, name, foundation_id'), ctx),
    scopeToFoundation(supabase.from('members').select('id, full_name, division_id'), ctx),
  ]);

  async function onRefresh() {
    'use server';
    await refreshData('/programs');
  }

  return (
    <Programs
      data={programsRes.data || []}
      divisions={divisionsRes.data || []}
      organizations={orgsRes.data || []}
      members={membersRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
