'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// Server Actions untuk alur pra-login (registrasi & reset password).
//
// Sebelumnya alur ini berjalan di browser sebagai anon — itu (a) gagal setelah
// RLS aktif, dan (b) membocorkan PIN kelompok/yayasan ke client. Sekarang semua
// berjalan di server dengan service-role: PIN divalidasi di server dan tidak
// pernah dikirim ke browser.
// =============================================================================

export interface FormGroup {
  id: string;
  name: string;
  foundation_id: string;
  foundationName: string;
}
export interface FormWorkplace {
  id: string;
  name: string;
  parent_workplace_id: string | null;
}

// Data yang dibutuhkan form pendaftaran (dropdown kelompok & tempat kerja).
// Hanya mengembalikan kolom non-sensitif (TANPA pin).
export async function getRegistrationOptions(): Promise<{
  groups: FormGroup[];
  workplaces: FormWorkplace[];
}> {
  const admin = createAdminClient();
  const [groupsRes, workplacesRes] = await Promise.all([
    admin.from('groups').select('id, name, foundation_id, foundations(name)').order('name'),
    admin.from('workplaces').select('id, name, parent_workplace_id'),
  ]);

  const groups: FormGroup[] = (groupsRes.data || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    foundation_id: g.foundation_id,
    foundationName: g.foundations?.name || 'Yayasan',
  }));
  const workplaces: FormWorkplace[] = (workplacesRes.data || []).map((w: any) => ({
    id: w.id,
    name: w.name,
    parent_workplace_id: w.parent_workplace_id ?? null,
  }));

  return { groups, workplaces };
}

export interface RegisterInput {
  regType: 'STUDENT' | 'MEMBER';
  email: string;
  password: string;
  fullName: string;
  phone: string;
  birthDate: string;
  employmentStatus: string;
  workplaceId: string;
  selectedGroupId: string;
  pin: string; // PIN Yayasan (hanya untuk regType MEMBER)
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

// Mendaftarkan akun baru: validasi PIN/kelompok di server, buat user auth,
// lalu upsert profil member. Semua via service-role (lolos RLS).
export async function registerAccount(input: RegisterInput): Promise<ActionResult> {
  const admin = createAdminClient();
  const email = input.email.trim();

  try {
    if (!email || !input.password || input.password.length < 6) {
      return { ok: false, error: 'Email wajib diisi dan password minimal 6 karakter.' };
    }
    if (!input.fullName.trim()) {
      return { ok: false, error: 'Nama lengkap wajib diisi.' };
    }

    let targetFoundationId = '';
    let foundationName = '';
    let finalMemberType = 'Generus';

    if (input.regType === 'MEMBER') {
      if (!input.pin) return { ok: false, error: 'PIN Yayasan wajib diisi untuk aktivasi.' };
      const { data: fdn } = await admin
        .from('foundations')
        .select('id, name')
        .eq('activation_pin', input.pin)
        .maybeSingle();
      if (!fdn) return { ok: false, error: 'PIN Yayasan salah atau tidak terdaftar.' };
      targetFoundationId = fdn.id;
      foundationName = fdn.name;
      finalMemberType = 'Lima Unsur';
    } else {
      if (!input.selectedGroupId) return { ok: false, error: 'Mohon tentukan Kelompok Anda.' };
      const { data: grp } = await admin
        .from('groups')
        .select('id, foundation_id, foundations(name)')
        .eq('id', input.selectedGroupId)
        .maybeSingle();
      if (!grp) return { ok: false, error: 'Kelompok yang dipilih tidak valid.' };
      targetFoundationId = grp.foundation_id;
      foundationName = (grp as any).foundations?.name || 'Yayasan';
      finalMemberType = 'Generus';
    }

    // Validasi tempat kerja (jika Karyawan): wajib pilih outlet bila parent punya cabang.
    let resolvedWorkplaceName: string | null = null;
    if (input.employmentStatus === 'Karyawan') {
      if (!input.workplaceId) return { ok: false, error: 'Mohon tentukan tempat kerja Anda.' };
      const { data: wps } = await admin
        .from('workplaces')
        .select('id, name, parent_workplace_id');
      const selected = (wps || []).find((w: any) => w.id === input.workplaceId);
      const isParent = selected && !selected.parent_workplace_id;
      const parentHasBranches = isParent && (wps || []).some((w: any) => w.parent_workplace_id === input.workplaceId);
      if (parentHasBranches) {
        return { ok: false, error: 'Mohon pilih Cabang / Outlet spesifik lokasi Anda bekerja.' };
      }
      resolvedWorkplaceName = selected?.name || null;
    }

    // Buat user auth (email terkonfirmasi langsung — mirror perilaku signUp lama
    // pada project tanpa email confirmation).
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });
    if (createErr) {
      if (createErr.message.toLowerCase().includes('already')) {
        return { ok: false, error: 'Email sudah terdaftar. Silakan gunakan menu Masuk.' };
      }
      return { ok: false, error: createErr.message };
    }

    const memberPayload = {
      email,
      full_name: input.fullName,
      phone: input.phone,
      birth_date: input.birthDate || null,
      employment_status: input.employmentStatus,
      workplace: input.employmentStatus === 'Karyawan' ? resolvedWorkplaceName : null,
      workplace_id: input.employmentStatus === 'Karyawan' ? input.workplaceId || null : null,
      foundation_id: targetFoundationId,
      status: 'Active',
      member_type: finalMemberType,
      group_id: input.regType === 'STUDENT' ? input.selectedGroupId : null,
    };

    const { error: dbErr } = await admin
      .from('members')
      .upsert(memberPayload, { onConflict: 'email' });
    if (dbErr) return { ok: false, error: dbErr.message };

    return { ok: true, message: `Pendaftaran berhasil di ${foundationName}! Silakan masuk.` };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Terjadi gangguan koneksi ke sistem.' };
  }
}

// Reset password via PIN kelompok — divalidasi di server (PIN tak ke client).
export async function resetPasswordWithPin(input: {
  email: string;
  resetPin: string;
  newPassword: string;
}): Promise<ActionResult> {
  const admin = createAdminClient();
  const email = input.email.trim();

  try {
    if (input.newPassword.length < 6) {
      return { ok: false, error: 'Password baru minimal 6 karakter.' };
    }

    const { data: member } = await admin
      .from('members')
      .select('id, full_name, group_id, groups(name, pin)')
      .eq('email', email)
      .maybeSingle();

    if (!member) return { ok: false, error: 'Email tidak ditemukan dalam sistem.' };
    if (!member.group_id || !member.groups) {
      return { ok: false, error: 'Anda belum terdaftar dalam kelompok manapun. Hubungi admin.' };
    }
    const groupPin = (member.groups as any).pin;
    const groupName = (member.groups as any).name;
    if (!groupPin) {
      return { ok: false, error: 'PIN Kelompok belum diatur oleh pengurus. Hubungi admin kelompok Anda.' };
    }
    if (input.resetPin !== groupPin) {
      return { ok: false, error: `PIN Kelompok salah untuk Kelompok ${groupName}.` };
    }

    // Cari user auth berdasarkan email lalu update password.
    const { data: usersList, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) return { ok: false, error: listErr.message };
    const authUser = usersList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!authUser) return { ok: false, error: 'Akun login tidak ditemukan. Hubungi admin.' };

    const { error: updErr } = await admin.auth.admin.updateUserById(authUser.id, {
      password: input.newPassword,
    });
    if (updErr) return { ok: false, error: updErr.message };

    return { ok: true, message: 'Password berhasil diubah! Silakan login dengan password baru Anda.' };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Terjadi gangguan koneksi ke sistem.' };
  }
}
