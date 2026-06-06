'use client';

import { useRouter } from 'next/navigation';
import { Auth } from '@/components/Auth';

export default function LoginPage() {
  const router = useRouter();
  // After a successful sign-in the browser client persists the session cookie;
  // refresh so middleware/Server Components pick it up and route to the app.
  return <Auth onLogin={() => router.refresh()} />;
}
