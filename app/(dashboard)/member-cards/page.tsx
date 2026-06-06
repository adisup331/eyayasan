import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { MemberCards } from '@/screens/MemberCards';

export default async function MemberCardsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [membersRes, orgsRes, groupsRes] = await Promise.all([
    scopeToFoundation(supabase.from('members').select('*, roles(name, permissions), organizations(name), groups(name)'), ctx),
    scopeToFoundation(supabase.from('organizations').select('*, foundations(name)'), ctx),
    scopeToFoundation(supabase.from('groups').select('*, foundations(name), villages(name)'), ctx),
  ]);

  return (
    <MemberCards
      members={membersRes.data || []}
      activeFoundation={ctx.activeFoundation}
      organizations={orgsRes.data || []}
      groups={groupsRes.data || []}
    />
  );
}
