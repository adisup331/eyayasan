import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getDivisionsCached, getOrganizationsCached, getWorkplacesCached, getVillagesCached, getRolesCached } from '@/lib/cache';
import { Events } from '@/screens/Events';
import { refreshData } from '@/app/actions';

export default async function EventsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const fid = ctx.foundationId;
  const [eventsRes, membersRes, groupsRes, roles, divisions, organizations, workplaces, villages, forumsRes] =
    await Promise.all([
      scopeToFoundation(supabase.from('events').select('*'), ctx),
      scopeToFoundation(supabase.from('members').select('id, full_name, nickname, group_id, division_id, foundation_id'), ctx),
      scopeToFoundation(supabase.from('groups').select('id, name, village_id, villages(name)'), ctx),
      getRolesCached(fid),
      getDivisionsCached(fid),
      getOrganizationsCached(fid),
      getWorkplacesCached(fid),
      getVillagesCached(fid),
      scopeToFoundation(supabase.from('forums').select('*'), ctx),
    ]);

  // Attendance scoped via the (foundation-scoped) event ids.
  const eventIds = (eventsRes.data || []).map((e: { id: string }) => e.id);
  let attendance: any[] = [];
  if (ctx.isSuperAdmin) {
    const { data } = await supabase.from('event_attendance').select('*');
    attendance = data || [];
  } else if (eventIds.length) {
    const { data } = await supabase.from('event_attendance').select('*').in('event_id', eventIds);
    attendance = data || [];
  }

  async function onRefresh() {
    'use server';
    await refreshData('/events');
  }

  return (
    <Events
      events={eventsRes.data || []}
      members={membersRes.data || []}
      attendance={attendance}
      groups={groupsRes.data || []}
      roles={roles}
      divisions={divisions}
      organizations={organizations}
      foundations={ctx.foundations}
      workplaces={workplaces}
      villages={villages}
      forums={forumsRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
