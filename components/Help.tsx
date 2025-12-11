
import React from 'react';

export const Help: React.FC = () => {
  return (
    <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-400">
        <h4 className="font-bold mb-2">Supabase Setup Guide</h4>
        <p className="mb-2">Aplikasi ini membutuhkan update tabel untuk fitur baru. Jalankan script berikut di SQL Editor Supabase:</p>
        <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`-- 1. Buat Tabel Groups (Jika belum)
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  organization_id uuid references public.organizations(id) on delete cascade,
  foundation_id uuid references public.foundations(id) on delete cascade,
  created_at timestamp with time zone default now()
);

-- Enable RLS for Groups
alter table public.groups enable row level security;
drop policy if exists "Enable all access for groups" on public.groups;
create policy "Enable all access for groups" on public.groups for all using (true) with check (true);

-- 2. Update Members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS group_id uuid references public.groups(id) on delete set null;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS member_type text DEFAULT 'Generus';

-- 3. Update Programs
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS proof_url text;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS doc_url text;

-- 4. Update Divisions
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS head_member_id uuid references public.members(id) on delete set null;
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS order_index serial;

-- 5. UPDATE TERBARU: MULTI-SESSION ATTENDANCE
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS sessions jsonb DEFAULT '[{"id": "default", "name": "Kehadiran"}]'::jsonb;
ALTER TABLE public.event_attendance ADD COLUMN IF NOT EXISTS logs jsonb DEFAULT '{}'::jsonb;

-- Kolom lama untuk backward compatibility
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS late_tolerance integer DEFAULT 15;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS actual_start_time timestamp with time zone;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'Pengajian';
ALTER TABLE public.event_attendance ADD COLUMN IF NOT EXISTS check_in_time timestamp with time zone;

-- 6. FIX: MEMBER TYPE FOR NON-GROUP MEMBERS
-- Ubah anggota yang tidak masuk kelompok menjadi 'Lima Unsur'
UPDATE public.members SET member_type = 'Lima Unsur' WHERE group_id IS NULL;
`}
        </pre>
    </div>
  )
}
