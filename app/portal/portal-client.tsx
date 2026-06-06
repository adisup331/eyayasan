'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import { MemberPortal } from '@/screens/MemberPortal';
import type {
  Member, Event, EventAttendance, Organization, Program, Division,
} from '@/types';

interface Props {
  currentUser: Member | null;
  events: Event[];
  attendance: EventAttendance[];
  organizations: Organization[];
  programs: Program[];
  divisions: Division[];
}

export function PortalClient(props: Props) {
  const router = useRouter();
  return (
    <MemberPortal
      {...props}
      onRefresh={() => router.refresh()}
      onLogout={async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }}
    />
  );
}
