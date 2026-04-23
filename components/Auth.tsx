import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
// Added CheckCircle2 to imports
import { Layers, UserPlus, LogIn, Lock, Key, Eye, EyeOff, User, Phone, Boxes, Building2, RefreshCw, CheckCircle2, Info } from './ui/Icons';

interface AuthProps {
  onLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true); 
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [regType, setRegType] = useState<'STUDENT' | 'MEMBER'>('STUDENT');
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [availableWorkplaces, setAvailableWorkplaces] = useState<any[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pin, setPin] = useState(''); 
  const [fullName, setFullName] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [birthDate, setBirthDate] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('Pribumi');
  const [workplace, setWorkplace] = useState('');
  const [workplaceId, setWorkplaceId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
      let mounted = true;
      const fetchGroups = async () => {
          try {
              const [groupsRes, workplacesRes] = await Promise.all([
                supabase.from('groups').select(`id, name, foundation_id, organizations ( name ), foundations ( name )`).order('name'),
                supabase.from('workplaces').select('id, name, parent_workplace_id')
              ]);
              
              if (groupsRes.error) throw groupsRes.error;
              if (workplacesRes.error) throw workplacesRes.error;
              
              if (mounted) {
                  if (groupsRes.data) setAvailableGroups(groupsRes.data);
                  if (workplacesRes.data) setAvailableWorkplaces(workplacesRes.data);
              }
          } catch (err) {
              console.error("Error fetching data:", err);
          }
      };

      if (!isLogin || isForgot) {
          fetchGroups();
      }
      return () => { mounted = false; };
  }, [isLogin, isForgot]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
        // 1. Get member and their group
        const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id, full_name, group_id, groups(name, pin)')
            .eq('email', email.trim())
            .maybeSingle();

        if (memberError || !memberData) throw new Error("Email tidak ditemukan dalam sistem.");
        if (!memberData.group_id || !memberData.groups) throw new Error("Anda belum terdaftar dalam kelompok manapun. Hubungi admin.");

        const groupPin = (memberData.groups as any).pin;
        if (!groupPin) throw new Error("PIN Kelompok belum diatur oleh pengurus. Hubungi admin kelompok Anda.");

        if (resetPin !== groupPin) throw new Error(`PIN Kelompok salah. Silakan masukkan PIN yang benar untuk Kelompok ${(memberData.groups as any).name}.`);

        if (newPassword.length < 6) throw new Error("Password baru minimal 6 karakter.");

        // 2. Reset password using RPC
        const { error: resetError } = await supabase.rpc('admin_reset_password', {
            target_email: email.trim(),
            new_password: newPassword
        });

        if (resetError) throw resetError;

        setSuccessMsg("Password berhasil diubah! Silakan login dengan password baru Anda.");
        setIsForgot(false);
        setIsLogin(true);
        setPassword('');
        setNewPassword('');
        setResetPin('');
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
        const birthByDate = birthDate;
        if (isLogin) {
            const { error: loginError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (loginError) {
                if (loginError.message.includes('Invalid login credentials')) {
                    throw new Error("Email atau password salah. Jika Anda belum pernah mendaftar, silakan gunakan menu DAFTAR terlebih dahulu.");
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
                birth_date: birthByDate || null,
                employment_status: employmentStatus,
                workplace: employmentStatus === 'Karyawan' ? (availableWorkplaces.find(w => w.id === workplaceId)?.name || workplace) : null,
                workplace_id: workplaceId || null,
                foundation_id: targetFoundationId,
                status: 'Active',
                member_type: finalMemberType,
                group_id: regType === 'STUDENT' ? selectedGroupId : null
            };

            // Mandatory branch selection if branches exist
            if (employmentStatus === 'Karyawan') {
                if (!workplaceId) throw new Error("Mohon tentukan tempat kerja Anda.");
                
                const selectedWp = availableWorkplaces.find(w => w.id === workplaceId);
                const isParent = selectedWp && !selectedWp.parent_workplace_id;
                const parentHasBranches = isParent && availableWorkplaces.some(w => w.parent_workplace_id === workplaceId);
                
                if (parentHasBranches) {
                    throw new Error("Mohon pilih Cabang / Outlet spesifik lokasi Anda bekerja.");
                }
            }

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
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Ruang-GMB</h1>
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
                onClick={() => { setIsLogin(true); setIsForgot(false); setError(''); setSuccessMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-black rounded-lg transition-all ${
                    isLogin && !isForgot
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-lg' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}
            >
                <LogIn size={16} /> MASUK
            </button>
            <button
                type="button"
                onClick={() => { setIsLogin(false); setIsForgot(false); setError(''); setSuccessMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-black rounded-lg transition-all ${
                    !isLogin && !isForgot
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-lg' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}
            >
                <UserPlus size={16} /> DAFTAR
            </button>
        </div>

        {isForgot ? (
            <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/40 mb-2">
                    <p className="text-[10px] text-orange-700 dark:text-orange-400 font-bold uppercase tracking-widest leading-relaxed">
                        Masukkan Email dan PIN Kelompok Anda untuk mereset password.
                    </p>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Alamat Email</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold"
                        placeholder="email@anda.com"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">PIN Kelompok</label>
                    <div className="relative">
                        <input
                            type="text"
                            required
                            maxLength={6}
                            value={resetPin}
                            onChange={(e) => setResetPin(e.target.value)}
                            className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-blue-50 dark:bg-gray-800 dark:text-white text-sm font-black tracking-widest"
                            placeholder="6 Digit PIN"
                        />
                        <Key size={16} className="absolute left-3.5 top-3.5 text-blue-400" />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Password Baru</label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full pl-4 pr-12 py-3 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold"
                            placeholder="Min. 6 karakter"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3 text-gray-400"><Lock size={18}/></button>
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-primary-600/30 mt-4 h-14 flex items-center justify-center"
                >
                    {loading ? <RefreshCw className="animate-spin" /> : 'GANTI PASSWORD'}
                </button>
                <button
                    type="button"
                    onClick={() => { setIsForgot(false); setIsLogin(true); setError(''); setSuccessMsg(''); }}
                    className="w-full text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
                >
                    Kembali ke Login
                </button>
            </form>
        ) : (
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
                <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tanggal Lahir</label>
                    <input
                        type="date"
                        required
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Status Pekerjaan</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-bold">
                            <input 
                                type="radio" 
                                checked={employmentStatus === 'Pribumi'}
                                onChange={() => setEmploymentStatus('Pribumi')}
                                className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                            />
                            Pribumi
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-bold">
                            <input 
                                type="radio" 
                                checked={employmentStatus === 'Karyawan'}
                                onChange={() => setEmploymentStatus('Karyawan')}
                                className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                            />
                            Karyawan
                        </label>
                    </div>
                </div>
                {employmentStatus === 'Karyawan' && (
                    <div className="space-y-4 animate-in slide-in-from-top-2">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Kantor Pusat / Utama</label>
                            <select
                                required
                                value={availableWorkplaces.find(w => w.id === workplaceId)?.parent_workplace_id || workplaceId}
                                onChange={(e) => setWorkplaceId(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold appearance-none"
                            >
                                <option value="">-- Pilih Kantor Pusat --</option>
                                {availableWorkplaces.filter(w => !w.parent_workplace_id).map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        {availableWorkplaces.some(w => w.parent_workplace_id === (availableWorkplaces.find(p => p.id === workplaceId)?.parent_workplace_id || workplaceId)) && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="block text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1.5">
                                    <Info size={14}/> Pilih Cabang/Outlet (Wajib)
                                </label>
                                <select 
                                    required
                                    value={workplaceId} 
                                    onChange={(e) => setWorkplaceId(e.target.value)} 
                                    className="w-full px-4 py-3 border-2 border-primary-200 dark:border-primary-900/50 rounded-xl text-sm bg-white dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm font-bold"
                                >
                                    <option value="">-- Pilih Cabang/Outlet --</option>
                                    {availableWorkplaces.filter(w => w.parent_workplace_id === (availableWorkplaces.find(p => p.id === workplaceId)?.parent_workplace_id || workplaceId)).map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}
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
            {!isLogin && (
                <p className="mt-1.5 text-[10px] text-primary-600 font-bold italic ml-1 flex items-center gap-1">
                    <Lock size={10} /> buat password yang mudah di ingat
                </p>
            )}
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
          
          {isLogin && (
              <button
                  type="button"
                  onClick={() => { setIsForgot(true); setIsLogin(false); setError(''); setSuccessMsg(''); }}
                  className="w-full mt-4 text-xs font-bold text-gray-400 hover:text-primary-600 transition-colors uppercase tracking-widest text-center"
              >
                  Lupa Password?
              </button>
          )}
        </form>
        )}
        
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-600 text-center font-bold tracking-widest uppercase">
          <p>© 2024 Ruang-GMB Foundation Management</p>
        </div>
      </div>
    </div>
  );
};