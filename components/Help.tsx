import React from 'react';

export const Help: React.FC = () => {
  return (
    <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-400">
        <h4 className="font-bold mb-2">Supabase Setup Guide</h4>
        <p className="mb-2">Jalankan script berikut di SQL Editor Supabase untuk mendukung fitur baru:</p>
        <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`-- 1. Tambah kolom alasan izin
ALTER TABLE public.event_attendance ADD COLUMN IF NOT EXISTS leave_reason text;

-- 2. Pastikan tabel groups tersedia
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  organization_id uuid references public.organizations(id) on delete cascade,
  foundation_id uuid references public.foundations(id) on delete cascade,
  created_at timestamp with time zone default now()
);

-- 3. Update status absensi (jika belum)
DO $$ 
BEGIN 
    ALTER TABLE public.event_attendance DROP CONSTRAINT IF EXISTS event_attendance_status_check;
    ALTER TABLE public.event_attendance ADD CONSTRAINT event_attendance_status_check 
    CHECK (status IN ('Present', 'Excused', 'Absent', 'Excused Late', 'Present Late'));
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;
`}
        </pre>
    </div>
  )
}