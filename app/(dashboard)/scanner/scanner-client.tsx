'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import { Scanner } from '@/screens/Scanner';
import type { Event, EventAttendance, Member } from '@/types';

interface Props {
  events: Event[];
  members: Member[];
  attendance: EventAttendance[];
}

export function ScannerClient({ events, members, attendance }: Props) {
  const router = useRouter();
  return (
    <Scanner
      events={events}
      members={members}
      attendance={attendance}
      onRefresh={() => router.refresh()}
      onLogout={async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }}
    />
  );
}
