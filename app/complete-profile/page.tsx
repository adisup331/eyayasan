import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/auth';
import { getRegistrationOptions } from '@/app/login/actions';
import { CompleteProfileForm } from './complete-profile-form';

// Halaman lengkapi-detail untuk user yang baru login via Google dan belum
// punya profil member. Jika sudah punya profil (atau super admin), tak perlu
// di sini -> ke beranda.
export default async function CompleteProfilePage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  if (ctx.member || ctx.isSuperAdmin) redirect('/');

  const { groups, workplaces } = await getRegistrationOptions();

  return (
    <CompleteProfileForm
      email={ctx.email}
      defaultName={ctx.email.split('@')[0]}
      groups={groups}
      workplaces={workplaces}
    />
  );
}
