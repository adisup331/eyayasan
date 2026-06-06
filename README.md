# E-Yayasan / Ruang-GMB CMS

Sistem Informasi & Manajemen Terpadu yayasan — **Next.js 15 (App Router) + Supabase**.

## Arsitektur

- **Next.js App Router** dengan Server Components: tiap halaman mengambil datanya
  sendiri di server (`app/(dashboard)/<route>/page.tsx`), tidak lagi prop-drilling
  satu state global seperti versi Vite/React-Router sebelumnya.
- **Auth server-side** via `@supabase/ssr`: sesi disimpan di cookie, di-refresh
  oleh `middleware.ts`, dan dibaca di Server Components lewat `lib/auth.ts`
  (`getUserContext()` — resolve foundation, permissions, super-admin).
- **Mutasi** masih dijalankan dari client (browser Supabase client) di tiap
  screen, diamankan oleh **Row Level Security** di database (lihat di bawah).
  Setelah mutasi, UI di-refresh via `router.refresh()` / Server Action
  `revalidatePath`.

### Struktur direktori

```
app/
  layout.tsx                 # root (font, globals, anti-flash theme)
  login/page.tsx             # halaman login (Auth)
  portal/                    # member portal (tanpa sidebar)
  (dashboard)/
    layout.tsx               # guard server-side + Shell
    shell.tsx                # sidebar/header (client)
    page.tsx                 # Dashboard
    <route>/page.tsx         # 1 file per modul (members, events, dst.)
lib/
  auth.ts                    # getUserContext, scopeToFoundation
  supabase/{server,client,middleware}.ts
screens/                     # komponen UI per modul (client components)
components/                  # Modal, Auth, ikon, dll.
middleware.ts                # refresh sesi + redirect unauth
supabase/rls_policies.sql    # kebijakan RLS multi-tenant
```

## Menjalankan secara lokal

**Prasyarat:** Node.js 18+

1. Install dependency:
   ```
   npm install
   ```
2. Salin `.env.local.example` → `.env.local` dan isi kredensial Supabase:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
   (ambil dari Supabase Dashboard → Settings → API)
3. Jalankan dev server:
   ```
   npm run dev
   ```
4. Build production:
   ```
   npm run build && npm start
   ```

## Keamanan: Row Level Security

Versi lama memfilter data per-yayasan **di client** — anon key bisa membaca data
lintas yayasan. Terapkan `supabase/rls_policies.sql` (SQL Editor di Supabase) agar
penjagaan ada di database. Lihat catatan di akhir file SQL soal alur registrasi
anon (Auth.tsx) yang mungkin perlu policy khusus.

## Deploy

Deploy ke Vercel sebagai project Next.js standar. Set environment variables
`NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di dashboard Vercel.
