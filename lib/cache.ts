import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// Cache data master (jarang berubah): divisions, roles, organizations,
// villages, workplaces, foundations. Tanpa cache, tiap pindah page query ulang
// tabel-tabel ini ke Supabase. Di-cache per foundationId, di-tag 'master'
// sehingga bisa di-invalidate saat ada mutasi (lihat app/actions.ts).
//
// Aman dengan service-role: setiap getter memfilter foundation_id secara
// eksplisit sesuai argumen (yang sudah di-resolve dari user terautentikasi di
// getUserContext), jadi scoping multi-tenant tetap terjaga. Super admin
// (foundationId null) melihat semua — sama seperti perilaku sebelumnya.
// =============================================================================

const REVALIDATE_SECONDS = 300; // backstop 5 menit; tag-invalidation utama

// Key cache memerlukan string stabil; null (super admin / tanpa foundation) -> 'all'.
const keyOf = (foundationId: string | null) => foundationId ?? 'all';

export const getDivisionsCached = (foundationId: string | null) =>
  unstable_cache(
    async () => {
      const admin = createAdminClient();
      let q = admin.from('divisions').select('*').order('order_index', { ascending: true });
      if (foundationId) q = q.eq('foundation_id', foundationId);
      return (await q).data ?? [];
    },
    ['divisions', keyOf(foundationId)],
    { tags: ['master', 'divisions'], revalidate: REVALIDATE_SECONDS }
  )();

export const getRolesCached = (foundationId: string | null) =>
  unstable_cache(
    async () => {
      const admin = createAdminClient();
      let q = admin.from('roles').select('*');
      // Role global (foundation_id null) selalu ikut terbaca (mirror logika app).
      if (foundationId) q = q.or(`foundation_id.eq.${foundationId},foundation_id.is.null`);
      return (await q).data ?? [];
    },
    ['roles', keyOf(foundationId)],
    { tags: ['master', 'roles'], revalidate: REVALIDATE_SECONDS }
  )();

export const getOrganizationsCached = (foundationId: string | null) =>
  unstable_cache(
    async () => {
      const admin = createAdminClient();
      let q = admin.from('organizations').select('*');
      if (foundationId) q = q.eq('foundation_id', foundationId);
      return (await q).data ?? [];
    },
    ['organizations', keyOf(foundationId)],
    { tags: ['master', 'organizations'], revalidate: REVALIDATE_SECONDS }
  )();

export const getVillagesCached = (foundationId: string | null) =>
  unstable_cache(
    async () => {
      const admin = createAdminClient();
      let q = admin.from('villages').select('*');
      if (foundationId) q = q.eq('foundation_id', foundationId);
      return (await q).data ?? [];
    },
    ['villages', keyOf(foundationId)],
    { tags: ['master', 'villages'], revalidate: REVALIDATE_SECONDS }
  )();

export const getWorkplacesCached = (foundationId: string | null) =>
  unstable_cache(
    async () => {
      const admin = createAdminClient();
      let q = admin.from('workplaces').select('*');
      if (foundationId) q = q.eq('foundation_id', foundationId);
      return (await q).data ?? [];
    },
    ['workplaces', keyOf(foundationId)],
    { tags: ['master', 'workplaces'], revalidate: REVALIDATE_SECONDS }
  )();

export const getFoundationsCached = () =>
  unstable_cache(
    async () => {
      const admin = createAdminClient();
      return (await admin.from('foundations').select('*')).data ?? [];
    },
    ['foundations', 'all'],
    { tags: ['master', 'foundations'], revalidate: REVALIDATE_SECONDS }
  )();
