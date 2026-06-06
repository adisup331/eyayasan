import { getUserContext } from '@/lib/auth';
import { Profile } from '@/screens/Profile';

export default async function ProfilePage() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  return <Profile currentUser={ctx.member} isSuperAdmin={ctx.isSuperAdmin} />;
}
