import { createClient } from '@/lib/supabase/server';
import { getUserContext, scopeToFoundation } from '@/lib/auth';
import { getRolesCached, getDivisionsCached, getOrganizationsCached, getWorkplacesCached } from '@/lib/cache';
import { Members } from '@/screens/Members';
import { refreshData } from '@/app/actions';

// Server Component: fetches members + related lookups scoped to the user's
// foundation, then renders the interactive (client) Members screen. Replaces
// the data this page used to receive via prop-drilling from App.tsx.
export default async function MembersPage() {
  const ctx = await getUserContext();
  if (!ctx) return null;

  const supabase = await createClient();

  // Hanya kolom yang dibaca screen (kurangi over-fetching). `groups` tak dipakai
  // di Members sama sekali -> tidak di-fetch. DetailMemberModal merefetch sendiri.
  const MEMBER_COLS =
    'id, full_name, nickname, email, phone, role_id, division_id, organization_id, foundation_id, status, member_type, birth_date, employment_status, workplace, workplace_id, service_period, service_end_date, roles(name), foundations(name)';

  const fid = ctx.foundationId;
  const [membersRes, roles, divisions, organizations, workplaces] =
    await Promise.all([
      scopeToFoundation(supabase.from('members').select(MEMBER_COLS), ctx),
      getRolesCached(fid),
      getDivisionsCached(fid),
      getOrganizationsCached(fid),
      getWorkplacesCached(fid),
    ]);

  async function onRefresh() {
    'use server';
    await refreshData('/members');
  }

  return (
    <Members
      data={membersRes.data || []}
      roles={roles}
      divisions={divisions}
      organizations={organizations}
      foundations={ctx.foundations}
      workplaces={workplaces}
      onRefresh={onRefresh}
      isSuperAdmin={ctx.isSuperAdmin}
      activeFoundation={ctx.activeFoundation}
    />
  );
}
