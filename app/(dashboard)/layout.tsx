import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/auth';
import { Shell } from './shell';

// Server-side guard for the whole authenticated app. Middleware already blocks
// unauthenticated requests; here we resolve the user's foundation/permissions
// and route members without management access to the portal.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');

  const hasManagementAccess = ctx.permissions.length > 0;
  const memberType = ctx.member?.member_type;

  // Members who are plain "Generus" or have no management permissions get the
  // member portal instead of the admin shell (ports App.tsx gating).
  if (
    !ctx.isSuperAdmin &&
    memberType !== 'Scanner' &&
    (!hasManagementAccess || memberType === 'Generus')
  ) {
    redirect('/portal');
  }

  return (
    <Shell
      permissions={ctx.permissions}
      isSuperAdmin={ctx.isSuperAdmin}
      foundationName={ctx.activeFoundation?.name || 'E-Yayasan'}
    >
      {children}
    </Shell>
  );
}
