
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layers, UserPlus, LogIn, Lock, Key, Eye, EyeOff, User, Phone, Boxes, Building2 } from './ui/Icons';

interface AuthProps {
  onLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Registration
  const [loading, setLoading] = useState(false);
  
  // Registration Type State
  const [regType, setRegType] = useState<'STUDENT' | 'MEMBER'>('STUDENT');
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState(''); 
  const [fullName, setFullName] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [selectedGroupId, setSelectedGroupId] = useState('');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);

  // Fetch Groups for Student Registration
  useEffect(() => {
      const fetchGroups = async () => {
          // Public read access enabled via RLS in setup script
          const { data, error } = await supabase
            .from('groups')
            .select(`
                id, 
                name, 
                foundation_id,
                organizations ( name ),
                foundations ( name )
            `)
            .order('name');
          
          if (!error && data) {
              setAvailableGroups(data);
          }
      };

      if (!isLogin) {
          fetchGroups();
      }
  }, [isLogin]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
        if (isLogin) {
            // --- LOGIN LOGIC ---
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw error;
            onLogin();
        } else {
            // --- REGISTRATION LOGIC ---
            
            let targetFoundationId = '';
            let foundationName = '';
            let finalMemberType = 'Generus'; // Default

            if (regType === 'MEMBER') {
                // TYPE: ANGGOTA YAYASAN (Pakai PIN)
                if (!pin) throw new Error("PIN Yayasan wajib diisi untuk Anggota.");

                const { data: foundationData, error: fdnError } = await supabase
                    .from('foundations')
                    .select('id, name')
                    .eq('activation_pin', pin)
                    .single();

                if (fdnError || !foundationData) {
                     throw new Error("PIN Yayasan salah atau tidak ditemukan.");
                }
                targetFoundationId = foundationData.id;
                foundationName = foundationData.name;
                finalMemberType = 'Lima Unsur'; // Assume Foundation Member is Adult/5 Unsur
            
            } else {
                // TYPE: SISWA (Pilih Kelompok, Tanpa PIN)
                if (!selectedGroupId) throw new Error("Mohon pilih Kelompok Anda.");
                
                const selectedGroupData = availableGroups.find(g => g.id === selectedGroupId);
                if (!selectedGroupData) throw new Error("Data kelompok tidak valid.");

                targetFoundationId = selectedGroupData.foundation_id;
                foundationName = selectedGroupData.foundations?.name || 'Yayasan';
                finalMemberType = 'Generus';
            }

            // 2. Proceed to Create Auth Account
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName }
                }
            });

            if (signUpError) throw signUpError;

            // 3. Upsert into Members Table
            const memberPayload: any = {
                email: email,
                full_name: fullName,
                phone: phone,
                foundation_id: targetFoundationId,
                status: 'Active',
                member_type: finalMemberType,
                // Only link group if Student
                group_id: regType === 'STUDENT' ? selectedGroupId : null
            };

            const { error: dbError } = await supabase
                .from('members')
                .upsert(memberPayload, { onConflict: 'email' });

            if (dbError) throw dbError;

            setSuccessMsg(`Pendaftaran berhasil di ${foundationName}! Silakan login.`);
            setIsLogin(true); 
            setPassword(''); 
            setPin(''); 
        }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Terjadi kesalahan sistem.';
      if (msg.includes('User already registered')) msg = 'Email sudah terdaftar. Silakan login.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-dark-bg p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-dark-card p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-100 dark:border-dark-border">
        <div className="text-center mb-8">
           <div className="flex justify-center mb-3">
              <div className="bg-primary-600 p-3 rounded-xl text-white shadow-lg shadow-primary-600/30">
                <Layers size={32} />
              </div>
           </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">E-Rapi</h1>
          <p className="text-gray-500 dark:text-dark-muted text-sm mt-2">Portal Yayasan & Siswa</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-4 border border-red-100 dark:border-red-800 flex items-start gap-2">
            <Lock size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded-lg text-sm mb-4 border border-green-100 dark:border-green-800">
            {successMsg}
          </div>
        )}

        {/* Toggle Login / Register */}
        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
            <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    isLogin 
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
                <LogIn size={16} /> Masuk
            </button>
            <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    !isLogin 
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
                <UserPlus size={16} /> Daftar
            </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          
          {/* Registration Type Selector */}
          {!isLogin && (
              <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800 mb-2 animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">Daftar Sebagai:</label>
                  <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                          <input 
                            type="radio" 
                            name="regType"
                            checked={regType === 'STUDENT'}
                            onChange={() => setRegType('STUDENT')}
                            className="text-primary-600 focus:ring-primary-500"
                          />
                          Siswa (Generus)
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                          <input 
                            type="radio" 
                            name="regType"
                            checked={regType === 'MEMBER'}
                            onChange={() => setRegType('MEMBER')}
                            className="text-primary-600 focus:ring-primary-500"
                          />
                          Anggota Yayasan
                      </label>
                  </div>
              </div>
          )}

          {/* Registration Fields */}
          {!isLogin && (
              <>
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                    <div className="relative">
                        <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-white dark:bg-gray-800 dark:text-white text-sm"
                        placeholder="Nama Siswa / Anggota"
                        />
                        <User size={16} className="absolute left-3 top-3 text-gray-400" />
                    </div>
                </div>
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. WhatsApp</label>
                    <div className="relative">
                        <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-white dark:bg-gray-800 dark:text-white text-sm"
                        placeholder="08..."
                        />
                        <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                    </div>
                </div>
              </>
          )}

          {/* GROUP SELECTION (ONLY FOR STUDENT) */}
          {!isLogin && regType === 'STUDENT' && (
             <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pilih Kelompok (Tanpa PIN)</label>
                <div className="relative">
                    <select
                        required
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-white dark:bg-gray-800 dark:text-white text-sm appearance-none"
                    >
                        <option value="">-- Cari Kelompok Anda --</option>
                        {availableGroups.map(g => (
                            <option key={g.id} value={g.id}>
                                {g.name} ({g.organizations?.name} - {g.foundations?.name})
                            </option>
                        ))}
                    </select>
                    <Boxes size={16} className="absolute left-3 top-3 text-gray-400" />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                    *Pilih kelompok tempat Anda mengaji/sekolah.
                </p>
             </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-white dark:bg-gray-800 dark:text-white text-sm"
              placeholder="nama@contoh.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password {isLogin ? '' : 'Baru'}</label>
            <div className="relative">
                <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-white dark:bg-gray-800 dark:text-white text-sm"
                placeholder="••••••••"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            {!isLogin && <p className="text-[10px] text-gray-400 mt-1">Minimal 6 karakter</p>}
          </div>
          
          {/* PIN Input - Only Show during MEMBER Registration */}
          {!isLogin && regType === 'MEMBER' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PIN Yayasan (Wajib)</label>
                <div className="relative">
                    <input
                        type="text"
                        required
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-white dark:bg-gray-800 dark:text-white text-sm"
                        placeholder="Masukan PIN dari Pengurus"
                    />
                    <Key size={16} className="absolute left-3 top-3 text-gray-400" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Khusus Pengurus/Anggota Yayasan. Tanya admin untuk PIN.</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex justify-center items-center shadow-md shadow-primary-600/20 mt-4"
          >
            {loading ? 'Memproses...' : (isLogin ? 'Masuk' : 'Daftar Sekarang')}
          </button>
        </form>
        
        {!isLogin && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded border border-blue-100 dark:border-blue-800">
                <p className="font-semibold mb-1">Catatan Pendaftaran:</p>
                <ul className="list-disc pl-4 space-y-1">
                    {regType === 'STUDENT' ? (
                        <li>Pilih <strong>Kelompok</strong> yang sesuai agar data masuk ke database yang benar.</li>
                    ) : (
                        <li>Pastikan Anda memiliki <strong>PIN Yayasan</strong> yang valid.</li>
                    )}
                    <li>Akun Anda akan langsung aktif setelah mendaftar.</li>
                </ul>
            </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 text-center">
          <p>© 2024 E-Rapi Foundation System</p>
        </div>
      </div>
    </div>
  );
};
