
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Layers, UserPlus, LogIn, Lock, Key, Eye, EyeOff } from './ui/Icons';

interface AuthProps {
  onLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Activation
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState(''); // New State for PIN
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);

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
            // --- ACTIVATION / REGISTER LOGIC ---
            
            // 1. Check if email exists in 'members' table first
            // This ensures only people invited by Super Admin can create a login.
            const { data: memberData, error: memberError } = await supabase
                .from('members')
                .select('id, full_name, foundation_id')
                .eq('email', email)
                .single();

            if (memberError || !memberData) {
                throw new Error("Email ini belum terdaftar di sistem Yayasan. Silakan hubungi Super Admin untuk menambahkan data Anda terlebih dahulu.");
            }

            // 2. PIN Validation Logic
            if (memberData.foundation_id) {
                // If the user belongs to a specific Foundation, check the PIN
                const { data: foundationData, error: fdnError } = await supabase
                    .from('foundations')
                    .select('activation_pin')
                    .eq('id', memberData.foundation_id)
                    .single();

                if (fdnError || !foundationData) {
                     throw new Error("Data yayasan tidak ditemukan.");
                }

                if (foundationData.activation_pin && foundationData.activation_pin !== pin) {
                    throw new Error("PIN Aktivasi Yayasan salah. Silakan minta PIN kepada Super Admin.");
                }
            } else {
                // If Global User (No foundation_id), maybe require a master PIN or skip?
                // For safety, let's assume global users are created manually or use a hardcoded check if needed.
                // Assuming "Super Admin" accounts are pre-created or handled differently.
                // Or simply proceed if no foundation assigned (Global Admin).
            }

            // 3. If valid member & PIN correct, proceed to create Auth Account
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (signUpError) throw signUpError;

            setSuccessMsg("Akun berhasil diaktifkan! Silakan login.");
            setIsLogin(true); // Switch back to login
            setPassword(''); // Clear password
            setPin(''); 
        }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan sistem.');
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
          <p className="text-gray-500 dark:text-dark-muted text-sm mt-2">Sistem Manajemen Multi-Yayasan</p>
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

        {/* Toggle Tabs */}
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
                <LogIn size={16} /> Login
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
                <UserPlus size={16} /> Aktivasi Akun
            </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-white dark:bg-gray-800 dark:text-white text-sm"
              placeholder="nama@yayasan.org"
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
          
          {/* PIN Input - Only Show during Activation */}
          {!isLogin && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PIN Aktivasi Yayasan</label>
                <div className="relative">
                    <input
                        type="text"
                        required
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition bg-white dark:bg-gray-800 dark:text-white text-sm"
                        placeholder="Masukan PIN Yayasan"
                    />
                    <Key size={16} className="absolute left-3 top-3 text-gray-400" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Minta PIN kepada Super Admin Yayasan Anda.</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex justify-center items-center shadow-md shadow-primary-600/20 mt-2"
          >
            {loading ? 'Memproses...' : (isLogin ? 'Masuk' : 'Aktifkan Akun')}
          </button>
        </form>
        
        {!isLogin && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded border border-blue-100 dark:border-blue-800">
                <p className="font-semibold mb-1">Panduan Koordinator:</p>
                <ul className="list-disc pl-4 space-y-1">
                    <li>Gunakan email yang telah didaftarkan oleh Super Admin.</li>
                    <li>Masukan <strong>PIN Yayasan</strong> yang valid.</li>
                    <li>Buat password baru untuk akun Anda.</li>
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
