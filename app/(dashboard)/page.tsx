import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getDivisionsCached, getOrganizationsCached } from '@/lib/cache';
import { DashboardClient } from './dashboard-client';

// Dashboard (route "/"): server-fetches the aggregate data the charts need,
// scoped to the user's foundation.
export default async function DashboardPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;

  const supabase = await createClient();

  const [membersRes, programsRes, divisions, eventsRes, organizations] =
    await Promise.all([
      scopeToFoundation(supabase.from('members').select('id, full_name, organization_id, role_id, service_end_date'), ctx),
      scopeToFoundation(supabase.from('programs').select('*'), ctx),
      getDivisionsCached(ctx.foundationId),
      scopeToFoundation(supabase.from('events').select('*'), ctx),
      getOrganizationsCached(ctx.foundationId),
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
      divisions={divisions}
      events={eventsRes.data || []}
      attendance={attendance}
      organizations={organizations}
      activeFoundation={ctx.activeFoundation}
    />
  );
}
