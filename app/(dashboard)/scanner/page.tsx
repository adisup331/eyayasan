import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { ScannerClient } from './scanner-client';

export default async function ScannerPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  const supabase = await createClient();

  const [eventsRes, membersRes, groupsRes] = await Promise.all([
    scopeToFoundation(supabase.from('events').select('*'), ctx),
    scopeToFoundation(supabase.from('members').select('id, full_name, nickname, group_id, division_id, foundation_id'), ctx),
    scopeToFoundation(supabase.from('groups').select('id, name, foundation_id'), ctx),
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
    <ScannerClient
      events={eventsRes.data || []}
      members={membersRes.data || []}
      attendance={attendance}
      groups={groupsRes.data || []}
      activeFoundation={ctx.activeFoundation}
    />
  );
}
