import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Foundation, Member } from '@/types';

const ALL_PERMISSIONS = [
  'DASHBOARD', 'MEMBERS', 'DIVISIONS', 'ORGANIZATIONS', 'GROUPS', 'WORKPLACES',
  'VILLAGES', 'PROGRAMS', 'ROLES', 'EVENTS', 'FINANCE', 'EDUCATORS', 'FORUMS',
  'MASTER_FOUNDATION', 'PROFILE', 'DOCUMENTATION', 'SCANNER', 'MEMBER_CARDS',
];

const SUPER_ADMIN_EMAILS = ['super@yayasan.org', 'novannanega@gmail.com'];

export interface UserContext {
  email: string;
  member: (Member & { roles?: { name: string; permissions?: string[] } }) | null;
  isSuperAdmin: boolean;
  foundationId: string | null;
  activeFoundation: Foundation | null;
  foundations: Foundation[];
  permissions: string[];
}

// Resolves the signed-in user's identity, foundation scope, super-admin flag
// and permission set on the server. Ports the logic from the old client-side
// fetchData(). Cached per-request so multiple Server Components share one query.
export const getUserContext = cache(async (): Promise<UserContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email;

  const { data: member } = await supabase
    .from('members')
    .select('*, roles(name, permissions)')
    .eq('email', email)
    .maybeSingle();

  const isSuperAdmin =
    SUPER_ADMIN_EMAILS.includes(email) ||
    !!member?.roles?.name?.toLowerCase().includes('super');

  const { data: foundations } = await supabase.from('foundations').select('*');
  const foundationId = member?.foundation_id ?? null;
  const activeFoundation =
    foundations?.find((f: Foundation) => f.id === foundationId) ?? null;

  let permissions: string[] = [];
  if (isSuperAdmin) {
    permissions = [...ALL_PERMISSIONS];
  } else if (member?.roles?.permissions) {
    permissions = [...member.roles.permissions];
    if (member.member_type === 'Scanner' && !permissions.includes('SCANNER')) {
      permissions.push('SCANNER');
    }
    if (!permissions.includes('MEMBER_CARDS')) permissions.push('MEMBER_CARDS');
  }

  return {
    email,
    member: member ?? null,
    isSuperAdmin,
    foundationId,
    activeFoundation,
    foundations: foundations ?? [],
    permissions,
  };
});

// Applies the foundation scope filter to a query, mirroring the old
// client-side `.eq('foundation_id', ...)` gating. Super admins see everything.
// Typed loosely on purpose: Supabase's query-builder generics are too deep to
// thread through a generic wrapper without "excessively deep" type errors.
export function scopeToFoundation(query: any, ctx: UserContext): any {
  if (!ctx.isSuperAdmin && ctx.foundationId) {
    return query.eq('foundation_id', ctx.foundationId);
  }
  return query;
}
