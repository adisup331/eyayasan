'use client';

import { useEffect } from 'react';

// Menyinkronkan sub-view dalam satu halaman (mis. DETAIL) dengan tombol back
// perangkat/browser. Saat `active` true (user di sub-view), kita push satu entri
// history; menekan back HP/browser memicu popstate -> memanggil `onBack` (balik
// ke LIST) alih-alih keluar dari route.
//
// Tombol "Kembali" di dalam layar sebaiknya memanggil window.history.back()
// supaya melewati jalur yang sama (popstate -> onBack), menjaga history rapi.
export function useBackGuard(active: boolean, onBack: () => void) {
  useEffect(() => {
    if (!active) return;
    if (typeof window === 'undefined') return;

    window.history.pushState({ backGuard: true }, '');
    const handlePop = () => onBack();
    window.addEventListener('popstate', handlePop);

    return () => {
      window.removeEventListener('popstate', handlePop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

// Pemicu back terpadu: gunakan ini di tombol "Kembali" agar lewat popstate.
export const goBack = () => {
  if (typeof window !== 'undefined') window.history.back();
};
