import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Finance } from '@/screens/Finance';

export default async function FinancePage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [programsRes, divisionsRes, orgsRes] = await Promise.all([
    scopeToFoundation(supabase.from('programs').select('*'), ctx),
    scopeToFoundation(supabase.from('divisions').select('*').order('order_index', { ascending: true }), ctx),
    scopeToFoundation(supabase.from('organizations').select('*, foundations(name)'), ctx),
  ]);

  return (
    <Finance
      programs={programsRes.data || []}
      divisions={divisionsRes.data || []}
      organizations={orgsRes.data || []}
      currentUser={ctx.member}
    />
  );
}
