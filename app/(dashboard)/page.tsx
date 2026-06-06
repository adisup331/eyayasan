import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { DashboardClient } from './dashboard-client';

// Dashboard (route "/"): server-fetches the aggregate data the charts need,
// scoped to the user's foundation.
export default async function DashboardPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;

  const supabase = await createClient();

  const [membersRes, programsRes, divisionsRes, eventsRes, orgsRes] =
    await Promise.all([
      scopeToFoundation(supabase.from('members').select('*, roles(name, permissions)'), ctx),
      scopeToFoundation(supabase.from('programs').select('*'), ctx),
      scopeToFoundation(supabase.from('divisions').select('*').order('order_index', { ascending: true }), ctx),
      scopeToFoundation(supabase.from('events').select('*'), ctx),
      scopeToFoundation(supabase.from('organizations').select('*, foundations(name)'), ctx),
    ]);

  // Attendance is scoped via the (already foundation-scoped) event ids.
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
    <DashboardClient
      members={membersRes.data || []}
      programs={programsRes.data || []}
      divisions={divisionsRes.data || []}
      events={eventsRes.data || []}
      attendance={attendance}
      organizations={orgsRes.data || []}
      activeFoundation={ctx.activeFoundation}
    />
  );
}
