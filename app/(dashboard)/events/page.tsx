import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { Events } from '@/screens/Events';
import { refreshData } from '@/app/actions';

export default async function EventsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [eventsRes, membersRes, groupsRes, rolesRes, divisionsRes, orgsRes, workplacesRes, villagesRes, forumsRes] =
    await Promise.all([
      scopeToFoundation(supabase.from('events').select('*'), ctx),
      scopeToFoundation(supabase.from('members').select('id, full_name, nickname, group_id, division_id, foundation_id'), ctx),
      scopeToFoundation(supabase.from('groups').select('id, name, village_id, villages(name)'), ctx),
      ctx.isSuperAdmin || !ctx.foundationId
        ? supabase.from('roles').select('*')
        : supabase.from('roles').select('*').or(`foundation_id.eq.${ctx.foundationId},foundation_id.is.null`),
      scopeToFoundation(supabase.from('divisions').select('*').order('order_index', { ascending: true }), ctx),
      scopeToFoundation(supabase.from('organizations').select('id, name'), ctx),
      scopeToFoundation(supabase.from('workplaces').select('*'), ctx),
      scopeToFoundation(supabase.from('villages').select('*'), ctx),
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
      roles={rolesRes.data || []}
      divisions={divisionsRes.data || []}
      organizations={orgsRes.data || []}
      foundations={ctx.foundations}
      workplaces={workplacesRes.data || []}
      villages={villagesRes.data || []}
      forums={forumsRes.data || []}
      onRefresh={onRefresh}
      activeFoundation={ctx.activeFoundation}
      isSuperAdmin={ctx.isSuperAdmin}
    />
  );
}
