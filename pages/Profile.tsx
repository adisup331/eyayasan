
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Member } from '../types';
import { User, Mail, Phone, ShieldCheck, Building2, Lock, Save, Globe } from '../components/ui/Icons';

interface ProfileProps {
  currentUser: Member | null;
  isSuperAdmin: boolean;
}

export const Profile: React.FC<ProfileProps> = ({ currentUser, isSuperAdmin }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
        setMessage({ type: 'error', text: 'Password minimal 6 karakter.' });
        return;
    }
    if (newPassword !== confirmPassword) {
        setMessage({ type: 'error', text: 'Konfirmasi password tidak cocok.' });
        return;
    }

    setLoading(true);
    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        
        setMessage({ type: 'success', text: 'Password berhasil diperbarui.' });
        setNewPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        setMessage({ type: 'error', text: error.message });
    } finally {
        setLoading(false);
    }
  };

  if (!currentUser && !isSuperAdmin) {
      return <div className="p-8 text-center text-gray-500">Memuat data profil...</div>;
  }

  // Fallback for Super Admin main account if not in members table
  const displayUser = currentUser || {
      full_name: 'Super Admin Utama',
      email: 'super@yayasan.org',
      phone: '-',
      roles: { name: 'Super Administration' },
      foundations: { name: 'Global Access' },
      organizations: { name: '-' }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <User className="text-primary-600 dark:text-primary-400" /> Profil Saya
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Profile Card */}
            <div className="md:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                <div className="bg-primary-600 h-24 relative">
                    <div className="absolute -bottom-10 left-6">
                        <div className="w-20 h-20 rounded-full bg-white dark:bg-dark-card p-1 shadow-md">
                            <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 text-2xl font-bold">
                                {displayUser.full_name?.charAt(0) || 'U'}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="pt-12 pb-6 px-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{displayUser.full_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{displayUser.email}</p>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-sm">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded">
                                <ShieldCheck size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200">
                                    {(displayUser as any).roles?.name || 'User'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-sm">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded">
                                <Globe size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Yayasan</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200">
                                    {(displayUser as any).foundations?.name || 'Global / Tidak Terikat'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-sm">
                            <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded">
                                <Building2 size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Organisasi</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200">
                                    {(displayUser as any).organizations?.name || '-'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-sm">
                            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded">
                                <Phone size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">No. Telepon</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200">{displayUser.phone || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Security */}
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border p-6 h-fit">
                <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <Lock size={18} className="text-gray-500" /> Keamanan Akun
                </h4>
                
                {message && (
                    <div className={`p-3 mb-4 text-sm rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Password Baru</label>
                        <input 
                            type="password" 
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                            placeholder="Minimal 6 karakter"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Konfirmasi Password</label>
                        <input 
                            type="password" 
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                            placeholder="Ulangi password baru"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Save size={16} /> {loading ? 'Memproses...' : 'Simpan Password'}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
};
