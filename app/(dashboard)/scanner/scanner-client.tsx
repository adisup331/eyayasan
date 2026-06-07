'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import { Scanner } from '@/screens/Scanner';
import type { Event, EventAttendance, Member, Group, Foundation } from '@/types';

interface Props {
  events: Event[];
  members: Member[];
  attendance: EventAttendance[];
  groups: Group[];
  activeFoundation: Foundation | null;
}

export function ScannerClient({ events, members, attendance, groups, activeFoundation }: Props) {
  const router = useRouter();
  return (
    <Scanner
      events={events}
      members={members}
      attendance={attendance}
      groups={groups}
      activeFoundation={activeFoundation}
      onRefresh={() => router.refresh()}
      onLogout={async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }}
    />
  );
}
