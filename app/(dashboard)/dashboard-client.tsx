'use client';

import { useEffect, useState } from 'react';
import { Dashboard } from '@/screens/Dashboard';
import type {
  Member, Program, Division, Event, EventAttendance, Organization, Foundation,
} from '@/types';

interface Props {
  members: Member[];
  programs: Program[];
  divisions: Division[];
  events: Event[];
  attendance: EventAttendance[];
  organizations: Organization[];
  activeFoundation: Foundation | null;
}

// Thin client wrapper: supplies the live dark-mode flag (from the <html> class
// toggled by the shell) to the Dashboard charts, which the server can't know.
export function DashboardClient(props: Props) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const read = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <Dashboard {...props} isDarkMode={isDarkMode} />;
}
