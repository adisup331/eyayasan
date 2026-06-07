'use client';

import React from 'react';
import { ChevronLeft } from './ui/Icons';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

// Tombol kembali seragam dipakai di semua sub-view (Groups, Events, Attendance,
// Workplaces, Organizations, dst). Default menampilkan ikon + teks "Kembali".
export const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  label = 'Kembali',
  className = '',
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition ${className}`}
  >
    <ChevronLeft size={18} />
    <span>{label}</span>
  </button>
);
