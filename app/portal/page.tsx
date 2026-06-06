import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { PortalClient } from './portal-client';

// Member portal for users without management access. Lives outside the
// (dashboard) group so it has no sidebar and avoids the Generus -> /portal
// redirect loop enforced by the dashboard layout.
export default async function PortalPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');

  const supabase = await createClient();

  const [eventsRes, orgsRes, programsRes, divisionsRes] = await Promise.all([
    scopeToFoundation(supabase.from('events').select('*'), ctx),
    scopeToFoundation(supabase.from('organizations').select('*, foundations(name)'), ctx),
    scopeToFoundation(supabase.from('programs').select('*'), ctx),
    scopeToFoundation(supabase.from('divisions').select('*').order('order_index', { ascending: true }), ctx),
  ]);

  const eventIds = (eventsRes.data || []).map((e: { id: string }) => e.id);
  let attendance: any[] = [];
  if (ctx.isSuperAdmin) {
    const { data } = await supabase.from('event_attendance').select('*');
    attendance = data || [];
  } else if (eventIds.length) {
    const { data } = await supabase.from('event_attendance').select('*').in('event_id', eventIds);
    attendance = data || [];
  }

  return (
    <PortalClient
      currentUser={ctx.member}
      events={eventsRes.data || []}
      attendance={attendance}
      organizations={orgsRes.data || []}
      programs={programsRes.data || []}
      divisions={divisionsRes.data || []}
    />
  );
}
