import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
// Added CheckCircle2 to imports
import { Layers, UserPlus, LogIn, Lock, Key, Eye, EyeOff, User, Phone, Boxes, Building2, RefreshCw, CheckCircle2 } from './ui/Icons';

interface AuthProps {
  onLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true); 
  const [loading, setLoading] = useState(false);
  
  const [regType, setRegType] = useState<'STUDENT' | 'MEMBER'>('STUDENT');
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState(''); 
  const [fullName, setFullName] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [selectedGroupId, setSelectedGroupId] = useState('');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
      let mounted = true;
      const fetchGroups = async () => {
          try {
              const { data, error: groupsError } = await supabase
                .from('groups')
                .select(`
                    id, 
                    name, 
                    foundation_id,
                    organizations ( name ),
                    foundations ( name )
                `)
                .order('name');
              
              if (groupsError) throw groupsError;
              if (mounted && data) setAvailableGroups(data);
          } catch (err) {
              console.error("Error fetching groups:", err);
          }
      };

      if (!isLogin) {
          fetchGroups();
      }
      return () => { mounted = false; };
  }, [isLogin]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
        if (isLogin) {
            const { error: loginError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (loginError) {
                if (loginError.message.includes('Invalid login credentials')) {
                    throw new Error("Email atau password salah. Pastikan data benar.");
                }
                throw loginError;
            }
            onLogin();
        } else {
            let targetFoundationId = '';
            let foundationName = '';
            let finalMemberType = 'Generus';

            if (regType === 'MEMBER') {
                if (!pin) throw new Error("PIN Yayasan wajib diisi untuk aktivasi.");

                const { data: foundationData, error: fdnError } = await supabase
                    .from('foundations')
                    .select('id, name')
                    .eq('activation_pin', pin)
                    .maybeSingle();

                if (fdnError || !foundationData) {
                     throw new Error("PIN Yayasan salah atau tidak terdaftar.");
                }
                targetFoundationId = foundationData.id;
                foundationName = foundationData.name;
                finalMemberType = 'Lima Unsur';
            
            } else {
                if (!selectedGroupId) throw new Error("Mohon tentukan Kelompok Anda.");
                
                const selectedGroupData = availableGroups.find(g => g.id === selectedGroupId);
                if (!selectedGroupData) throw new Error("Kelompok yang dipilih tidak valid.");

                targetFoundationId = selectedGroupData.foundation_id;
                foundationName = selectedGroupData.foundations?.name || 'Yayasan';
                finalMemberType = 'Generus';
            }

            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: { full_name: fullName }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes('User already registered')) {
                    throw new Error("Email sudah terdaftar. Silakan gunakan menu Masuk.");
                }
                throw signUpError;
            }

            const memberPayload: any = {
                email: email.trim(),
                full_name: fullName,
                phone: phone,
                foundation_id: targetFoundationId,
                status: 'Active',
                member_type: finalMemberType,
                group_id: regType === 'STUDENT' ? selectedGroupId : null
            };

            const { error: dbError } = await supabase
                .from('members')
                .upsert(memberPayload, { onConflict: 'email' });

            if (dbError) throw dbError;

            setSuccessMsg(`Pendaftaran berhasil di ${foundationName}! Silakan masuk.`);
            setIsLogin(true); 
            setPassword(''); 
            setPin(''); 
        }
    } catch (err: any) {
      console.error("Authentication process error:", err);
      setError(err.message || 'Terjadi gangguan koneksi ke sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-dark-bg p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-dark-card p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-dark-border">
        <div className="text-center mb-8">
           <div className="flex justify-center mb-4">
              <div className="bg-primary-600 p-4 rounded-2xl text-white shadow-xl shadow-primary-600/30">
                <Layers size={36} />
              </div>
           </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">E-Yayasan</h1>
          <p className="text-gray-500 dark:text-dark-muted text-sm mt-2 font-medium">Sistem Informasi & Manajemen Terpadu</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm mb-6 border border-red-100 dark:border-red-800 flex items-start gap-3 animate-in shake duration-300">
            <Lock size={18} className="mt-0.5 shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-4 rounded-xl text-sm mb-6 border border-green-100 dark:border-green-800 font-bold flex items-center gap-2 animate-in zoom-in">
            <CheckCircle2 size={18}/> {successMsg}
          </div>
        )}

        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
            <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-black rounded-lg transition-all ${
                    isLogin 
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-lg' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}
            >
                <LogIn size={16} /> MASUK
            </button>
            <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-black rounded-lg transition-all ${
                    !isLogin 
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-lg' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}
            >
                <UserPlus size={16} /> DAFTAR
            </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 mb-2 animate-in slide-in-from-top-2">
                  <label className="block text-[10px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest mb-3">Tipe Pendaftaran:</label>
                  <div className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-bold">
                          <input 
                            type="radio" 
                            name="regType"
                            checked={regType === 'STUDENT'}
                            onChange={() => setRegType('STUDENT')}
                            className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                          />
                          Siswa / Santri
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-bold">
                          <input 
                            type="radio" 
                            name="regType"
                            checked={regType === 'MEMBER'}
                            onChange={() => setRegType('MEMBER')}
                            className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                          />
                          Anggota Yayasan
                      </label>
                  </div>
              </div>
          )}

          {!isLogin && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nama Lengkap</label>
                    <div className="relative">
                        <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold"
                        placeholder="Nama Lengkap Sesuai ID"
                        />
                        <User size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nomor WhatsApp</label>
                    <div className="relative">
                        <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold"
                        placeholder="08xxxxxxxxxx"
                        />
                        <Phone size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    </div>
                </div>
              </div>
          )}

          {!isLogin && regType === 'STUDENT' && (
             <div className="animate-in fade-in duration-300">
                <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Pilih Kelompok Anda</label>
                <div className="relative">
                    <select
                        required
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold appearance-none"
                    >
                        <option value="">-- Cari Kelompok / Kelas --</option>
                        {availableGroups.map(g => (
                            <option key={g.id} value={g.id}>
                                {g.name} ({g.foundations?.name})
                            </option>
                        ))}
                    </select>
                    <Boxes size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                </div>
             </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Alamat Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold"
              placeholder="nama@email.com"
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Kata Sandi</label>
            <div className="relative">
                <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold"
                placeholder="Minimal 6 karakter"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-gray-400 hover:text-primary-600 transition-colors"
                    tabIndex={-1}
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
          </div>
          
          {!isLogin && regType === 'MEMBER' && (
            <div className="animate-in fade-in duration-300">
                <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">PIN Aktivasi Yayasan</label>
                <div className="relative">
                    <input
                        type="text"
                        required
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-blue-50 dark:bg-gray-800 dark:text-white text-sm font-black tracking-widest"
                        placeholder="Masukan 6 Digit PIN"
                    />
                    <Key size={16} className="absolute left-3.5 top-3.5 text-blue-400" />
                </div>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center shadow-xl shadow-primary-600/30 mt-6 active:scale-95"
          >
            {loading ? <RefreshCw size={24} className="animate-spin" /> : (isLogin ? 'MASUK KE SISTEM' : 'DAFTAR SEKARANG')}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-600 text-center font-bold tracking-widest uppercase">
          <p>© 2024 E-Yayasan Foundation Management</p>
        </div>
      </div>
    </div>
  );
};