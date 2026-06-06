-- =============================================================================
-- Row Level Security (RLS) untuk E-Yayasan / Ruang-GMB
-- =============================================================================
-- Sebelumnya filtering multi-tenant dilakukan di sisi client (App.tsx fetchData
-- + .eq('foundation_id', ...)). Itu TIDAK aman: anon key bisa membaca semua
-- data lintas yayasan. File ini memindahkan penjagaan ke database.
--
-- CARA PAKAI:
--   1. Jalankan di Supabase: SQL Editor -> tempel -> Run.
--   2. Uji login sebagai (a) super admin, (b) anggota yayasan biasa,
--      (c) Generus/portal — pastikan tiap peran hanya melihat datanya.
--   3. Jika ada tabel yang "kosong" setelah ini, berarti ada policy yang
--      kurang — sesuaikan, jangan menonaktifkan RLS di production.
--
-- CATATAN: jalankan SETELAH aplikasi Next.js berjalan & login sudah teruji,
-- supaya kalau ada policy yang salah, mudah dibedakan dari bug aplikasi.
-- =============================================================================

-- Helper: foundation_id milik user yang sedang login (berdasarkan email auth).
create or replace function public.current_member_foundation()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select foundation_id from public.members where email = auth.email() limit 1;
$$;

-- Helper: apakah user yang login adalah super admin.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.email() in ('super@yayasan.org', 'novannanega@gmail.com'), false)
    or exists (
      select 1
      from public.members m
      join public.roles r on r.id = m.role_id
      where m.email = auth.email()
        and lower(r.name) like '%super%'
    );
$$;

-- -----------------------------------------------------------------------------
-- Tabel ber-foundation_id: super admin lihat semua; selain itu hanya yayasannya.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  fdn_tables text[] := array[
    'members', 'divisions', 'groups', 'villages', 'programs',
    'organizations', 'events', 'workplaces', 'forums', 'member_mutations'
  ];
begin
  foreach t in array fdn_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_tenant_all', t);
    execute format($f$
      create policy %I on public.%I
        for all
        to authenticated
        using (
          public.is_super_admin()
          or foundation_id = public.current_member_foundation()
        )
        with check (
          public.is_super_admin()
          or foundation_id = public.current_member_foundation()
        );
    $f$, t || '_tenant_all', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- roles: punya foundation_id TAPI role global (foundation_id IS NULL) boleh
-- dibaca semua authenticated (mirror logika .or(...is.null) di aplikasi).
-- -----------------------------------------------------------------------------
alter table public.roles enable row level security;

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (
    public.is_super_admin()
    or foundation_id is null
    or foundation_id = public.current_member_foundation()
  );

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for all to authenticated
  using (
    public.is_super_admin()
    or foundation_id = public.current_member_foundation()
  )
  with check (
    public.is_super_admin()
    or foundation_id = public.current_member_foundation()
  );

-- -----------------------------------------------------------------------------
-- foundations: semua authenticated boleh BACA (dipakai untuk dropdown & nama),
-- hanya super admin yang boleh menulis.
-- -----------------------------------------------------------------------------
alter table public.foundations enable row level security;

drop policy if exists foundations_select on public.foundations;
create policy foundations_select on public.foundations
  for select to authenticated
  using (true);

drop policy if exists foundations_write on public.foundations;
create policy foundations_write on public.foundations
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- event_attendance: tidak punya foundation_id langsung — diturunkan dari event.
-- -----------------------------------------------------------------------------
alter table public.event_attendance enable row level security;

drop policy if exists event_attendance_tenant on public.event_attendance;
create policy event_attendance_tenant on public.event_attendance
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.events e
      where e.id = event_attendance.event_id
        and e.foundation_id = public.current_member_foundation()
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.events e
      where e.id = event_attendance.event_id
        and e.foundation_id = public.current_member_foundation()
    )
  );

-- -----------------------------------------------------------------------------
-- forum_members: diturunkan dari forum (jika tabel ini ada di skema Anda).
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.forum_members') is not null then
    execute 'alter table public.forum_members enable row level security';
    execute 'drop policy if exists forum_members_tenant on public.forum_members';
    execute $f$
      create policy forum_members_tenant on public.forum_members
        for all to authenticated
        using (
          public.is_super_admin()
          or exists (
            select 1 from public.forums f
            where f.id = forum_members.forum_id
              and f.foundation_id = public.current_member_foundation()
          )
        )
        with check (
          public.is_super_admin()
          or exists (
            select 1 from public.forums f
            where f.id = forum_members.forum_id
              and f.foundation_id = public.current_member_foundation()
          )
        );
    $f$;
  end if;
end $$;

-- =============================================================================
-- CATATAN PENDAFTARAN (REGISTRASI):
-- Halaman login (Auth.tsx) membaca `groups`, `workplaces`, `foundations` dan
-- meng-upsert ke `members` SEBELUM user punya sesi (anon). Policy di atas hanya
-- mengizinkan `authenticated`. Jika alur daftar/lupa-password perlu jalan untuk
-- anon, tambahkan policy khusus (mis. SELECT terbatas untuk anon pada groups/
-- workplaces, dan INSERT terbatas pada members) ATAU pindahkan alur tsb ke
-- Server Action dengan service role. Tinjau sesuai kebutuhan keamanan Anda.
-- =============================================================================
