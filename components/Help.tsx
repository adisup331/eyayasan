import React from 'react';

export const Help: React.FC = () => {
  return (
    <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-400">
        <h4 className="font-bold mb-2">Supabase Setup Guide</h4>
        <p className="mb-2">Aplikasi ini membutuhkan update tabel untuk Permissions. Jalankan script berikut di SQL Editor Supabase untuk memperbaiki akses Super Admin:</p>
        <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`-- 1. Tambah kolom permissions di tabel roles (jika belum ada)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'permissions') THEN
        ALTER TABLE public.roles ADD COLUMN permissions text[]; 
    END IF;
END $$;

-- 2. Pastikan Role Super Administration ada
INSERT INTO roles (name, permissions)
SELECT 'Super Administration', ARRAY['DASHBOARD', 'MEMBERS', 'DIVISIONS', 'ORGANIZATIONS', 'PROGRAMS', 'ROLES', 'EVENTS', 'FINANCE', 'EDUCATORS']
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Super Administration');

-- 3. FORCE UPDATE: Pastikan Super Admin punya SEMUA akses
UPDATE roles 
SET permissions = ARRAY['DASHBOARD', 'MEMBERS', 'DIVISIONS', 'ORGANIZATIONS', 'PROGRAMS', 'ROLES', 'EVENTS', 'FINANCE', 'EDUCATORS']
WHERE name = 'Super Administration' OR name = 'Super Admin';

-- 4. Tambah Role Lain (Optional)
INSERT INTO roles (name, permissions)
SELECT 'Guru', ARRAY['DASHBOARD', 'EVENTS', 'EDUCATORS']
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Guru');
`}
        </pre>
    </div>
  )
}