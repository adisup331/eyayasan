'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import {
  completeProfile, type FormGroup, type FormWorkplace,
} from '@/app/login/actions';
import {
  Layers, User, Phone, Boxes, Key, Info, RefreshCw, CheckCircle2, Lock, LogOut,
} from '@/components/ui/Icons';

interface Props {
  email: string;
  defaultName: string;
  groups: FormGroup[];
  workplaces: FormWorkplace[];
}

export function CompleteProfileForm({ email, defaultName, groups, workplaces }: Props) {
  const router = useRouter();
  const [regType, setRegType] = useState<'STUDENT' | 'MEMBER'>('STUDENT');
  const [fullName, setFullName] = useState(defaultName || '');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('Pribumi');
  const [workplaceId, setWorkplaceId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parentWorkplaceId =
    workplaces.find((w) => w.id === workplaceId)?.parent_workplace_id || workplaceId;
  const hasBranches = workplaces.some((w) => w.parent_workplace_id === parentWorkplaceId);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await completeProfile({
        regType,
        fullName,
        phone,
        birthDate,
        employmentStatus,
        workplaceId,
        selectedGroupId,
        pin,
      });
      if (!result.ok) throw new Error(result.error);
      // Profil tersimpan -> refresh agar guard server mengarahkan ke app/portal.
      router.replace('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-dark-bg p-4">
      <div className="bg-white dark:bg-dark-card p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-dark-border">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="bg-primary-600 p-4 rounded-2xl text-white shadow-xl shadow-primary-600/30">
              <Layers size={36} />
            </div>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Lengkapi Profil</h1>
          <p className="text-gray-500 dark:text-dark-muted text-sm mt-2 font-medium">
            Masuk sebagai <span className="font-black text-primary-600">{email}</span>
          </p>
          <p className="text-gray-400 text-xs mt-1">Lengkapi data berikut untuk mengaktifkan akun.</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm mb-6 border border-red-100 dark:border-red-800 flex items-start gap-3">
            <Lock size={18} className="mt-0.5 shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
            <label className="block text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest mb-3">Tipe Pendaftaran:</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-bold">
                <input type="radio" name="regType" checked={regType === 'STUDENT'} onChange={() => setRegType('STUDENT')} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                Siswa / Santri
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-bold">
                <input type="radio" name="regType" checked={regType === 'MEMBER'} onChange={() => setRegType('MEMBER')} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                Anggota Yayasan
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nama Lengkap</label>
            <div className="relative">
              <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold" placeholder="Nama Lengkap Sesuai ID" />
              <User size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nomor WhatsApp</label>
            <div className="relative">
              <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold" placeholder="08xxxxxxxxxx" />
              <Phone size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tanggal Lahir</label>
            <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold" />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Status Pekerjaan</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-bold">
                <input type="radio" checked={employmentStatus === 'Pribumi'} onChange={() => setEmploymentStatus('Pribumi')} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                Pribumi
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-bold">
                <input type="radio" checked={employmentStatus === 'Karyawan'} onChange={() => setEmploymentStatus('Karyawan')} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                Karyawan
              </label>
            </div>
          </div>

          {employmentStatus === 'Karyawan' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Kantor Pusat / Utama</label>
                <select required value={parentWorkplaceId} onChange={(e) => setWorkplaceId(e.target.value)} className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold appearance-none">
                  <option value="">-- Pilih Kantor Pusat --</option>
                  {workplaces.filter((w) => !w.parent_workplace_id).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              {hasBranches && (
                <div>
                  <label className="block text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1.5">
                    <Info size={14} /> Pilih Cabang/Outlet (Wajib)
                  </label>
                  <select required value={workplaceId} onChange={(e) => setWorkplaceId(e.target.value)} className="w-full px-4 py-3 border-2 border-primary-200 dark:border-primary-900/50 rounded-xl text-sm bg-white dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition font-bold">
                    <option value="">-- Pilih Cabang/Outlet --</option>
                    {workplaces.filter((w) => w.parent_workplace_id === parentWorkplaceId).map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {regType === 'STUDENT' && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Pilih Kelompok Anda</label>
              <div className="relative">
                <select required value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold appearance-none">
                  <option value="">-- Cari Kelompok / Kelas --</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.foundationName})</option>
                  ))}
                </select>
                <Boxes size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
              </div>
            </div>
          )}

          {regType === 'MEMBER' && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">PIN Aktivasi Yayasan</label>
              <div className="relative">
                <input type="text" required value={pin} onChange={(e) => setPin(e.target.value)} className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-blue-50 dark:bg-gray-800 dark:text-white text-sm font-black tracking-widest" placeholder="Masukan 6 Digit PIN" />
                <Key size={16} className="absolute left-3.5 top-3.5 text-blue-400" />
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center shadow-xl shadow-primary-600/30 mt-6 active:scale-95">
            {loading ? <RefreshCw size={24} className="animate-spin" /> : 'SIMPAN & MASUK'}
          </button>

          <button type="button" onClick={handleLogout} className="w-full mt-2 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest text-center flex items-center justify-center gap-2">
            <LogOut size={14} /> Keluar / Ganti Akun
          </button>
        </form>
      </div>
    </div>
  );
}
