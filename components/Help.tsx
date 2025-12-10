
import React from 'react';

export const Help: React.FC = () => {
  return (
    <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-400">
        <h4 className="font-bold mb-2">Supabase Setup Guide</h4>
        <p className="mb-2">Aplikasi ini membutuhkan update tabel untuk fitur baru (Kelompok, Attachment, Kepala Bidang, Absensi Real-time, Urutan Bidang). Jalankan script berikut di SQL Editor Supabase:</p>
        <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`-- 1. Buat Tabel Groups
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

-- 2. Tambah kolom group_id di tabel members
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS group_id uuid references public.groups(id) on delete set null;

-- 3. Update Permissions Super Admin
UPDATE roles 
SET permissions = array_append(permissions, 'GROUPS')
WHERE (name = 'Super Administration' OR name = 'Super Admin') AND NOT ('GROUPS' = ANY(permissions));

-- 4. UPDATE TERBARU: Tambah Kolom Attachment Program Kerja
ALTER TABLE public.programs 
ADD COLUMN IF NOT EXISTS proof_url text,
ADD COLUMN IF NOT EXISTS doc_url text;

-- 5. UPDATE TERBARU: Tambah Kolom Kepala Bidang & Urutan
ALTER TABLE public.divisions 
ADD COLUMN IF NOT EXISTS head_member_id uuid references public.members(id) on delete set null,
ADD COLUMN IF NOT EXISTS order_index serial;

-- 6. UPDATE TERBARU: Absensi Real-time & Toleransi
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS late_tolerance integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS actual_start_time timestamp with time zone;

ALTER TABLE public.event_attendance
ADD COLUMN IF NOT EXISTS check_in_time timestamp with time zone;

-- 7. UPDATE TERBARU (Kelompok Santri): Tambah Kolom Kelas/Grade
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS grade text;
`}
        </pre>
    </div>
  )
}
