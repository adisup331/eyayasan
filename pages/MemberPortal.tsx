import React, { useState, useMemo } from 'react';
import { Member, Event, EventAttendance, Organization, Program, Division } from '../types';
import { 
  User, QrCode, CalendarDays, LogOut, CheckCircle2, XCircle, 
  Clock, Lock, MapPin, Activity, ChevronRight, GraduationCap, 
  TrendingUp, Building2, BadgeCheck, Timer
} from '../components/ui/Icons';
import { supabase } from '../supabaseClient';

interface MemberPortalProps {
  currentUser: Member;
  events: Event[];
  attendance: EventAttendance[];
  organizations: Organization[];
  programs?: Program[];
  divisions?: Division[];
  onLogout: () => void;
  onRefresh: () => void;
}

export const MemberPortal: React.FC<MemberPortalProps> = ({ currentUser, events, attendance, organizations, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'HOME' | 'HISTORY' | 'PROFILE'>('HOME');
  
  // Profile State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
      const myRecords = attendance.filter(a => a.member_id === currentUser.id);
      const present = myRecords.filter(a => a.status === 'Present' || a.status === 'Present Late' || a.status === 'izin_telat').length;
      const total = myRecords.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      return { present, total, percentage, myRecords };
  }, [attendance, currentUser.id]);

  // --- UPCOMING EVENTS (NEXT 3) ---
  const upcomingEvents = useMemo(() => {
      return events
        .filter(e => e.status === 'Upcoming')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 3);
  }, [events]);

  // --- HISTORY LIST ---
  const historyList = useMemo(() => {
      return stats.myRecords.map(record => {
          const event = events.find(e => e.id === record.event_id);
          return { ...record, event };
      }).sort((a, b) => {
          const dateA = a.event ? new Date(a.event.date).getTime() : 0;
          const dateB = b.event ? new Date(b.event.date).getTime() : 0;
          return dateB - dateA;
      });
  }, [stats.myRecords, events]);

  const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      setMsg(null);
      if (newPassword.length < 6) { setMsg({text: 'Password minimal 6 karakter.', type: 'error'}); return; }
      if (newPassword !== confirmPassword) { setMsg({text: 'Konfirmasi password tidak cocok.', type: 'error'}); return; }

      setLoading(true);
      try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          setMsg({text: 'Password berhasil diubah.', type: 'success'});
          setNewPassword('');
          setConfirmPassword('');
      } catch (err: any) {
          setMsg({text: err.message, type: 'error'});
      } finally {
          setLoading(false);
      }
  };

  const orgName = organizations.find(o => o.id === currentUser.organization_id)?.name || 'Yayasan';

  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Selamat Pagi';
      if (hour < 15) return 'Selamat Siang';
      if (hour < 18) return 'Selamat Sore';
      return 'Selamat Malam';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-50 selection:bg-primary-100 pb-28">
        
        {/* --- HEADER (Clean & Sticky) --- */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center transition-all">
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-0.5">{getGreeting()},</p>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{currentUser.full_name.split(' ')[0]}</h1>
            </div>
            <button 
                onClick={onLogout} 
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"
                title="Keluar"
            >
                <LogOut size={20} />
            </button>
        </div>

        {/* --- MAIN CONTENT (Centered Container) --- */}
        <div className="max-w-md mx-auto px-6 py-6 space-y-8">
            
            {/* TAB: HOME */}
            {activeTab === 'HOME' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* DIGITAL ID CARD (Sleek Modern Style) */}
                    <div className="relative w-full aspect-[1.58/1] rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all hover:scale-[1.02] active:scale-95 group">
                        {/* Background with dynamic gradients */}
                        <div className="absolute inset-0 bg-slate-900">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-primary-500/40 transition-colors"></div>
                            <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-600/20 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/3"></div>
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                        </div>
                        
                        {/* Content Layer */}
                        <div className="absolute inset-0 p-6 flex flex-col justify-between text-white relative z-10">
                            
                            {/* Top: Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-inner">
                                        <Building2 size={18} className="text-primary-400" />
                                    </div>
                                    <div className="text-left">
                                        <h2 className="text-sm font-black leading-tight tracking-tight uppercase">{orgName}</h2>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Official Member Card</p>
                                    </div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                    <span className="text-[9px] font-black tracking-widest uppercase">{currentUser.member_type}</span>
                                </div>
                            </div>

                            {/* Middle: QR Code & Name */}
                            <div className="flex items-center gap-6 mt-2">
                                <div className="relative">
                                    <div className="absolute -inset-3 bg-primary-500/30 blur-2xl rounded-full"></div>
                                    <div className="bg-white p-3 rounded-2xl shadow-2xl relative z-10 ring-8 ring-white/10">
                                        <img 
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${currentUser.id}`} 
                                            alt="QR" 
                                            className="w-28 h-28 object-contain"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xl font-black truncate leading-none mb-1 drop-shadow-lg uppercase tracking-tight">{currentUser.full_name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-widest mb-3 opacity-80">{currentUser.id.substring(0,16).toUpperCase()}</p>
                                    <div className="flex gap-2">
                                        {currentUser.grade && (
                                            <span className="text-[9px] bg-white/10 backdrop-blur-md text-white px-2 py-1 rounded-lg font-black border border-white/10 uppercase tracking-tighter">
                                                Kelas {currentUser.grade}
                                            </span>
                                        )}
                                        <span className="text-[9px] bg-primary-500 text-white px-2 py-1 rounded-lg font-black shadow-lg uppercase tracking-tighter">
                                            Aktif
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom: Footer Info */}
                            <div className="flex justify-between items-end mt-4 pt-4 border-t border-white/5">
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">ID Anggota</span>
                                    <span className="text-[10px] font-bold">{currentUser.id.substring(0, 8).toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Status Keanggotaan</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] font-bold uppercase tracking-tighter">Terverifikasi</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* QUICK ACTIONS / STATS BENTO */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 p-6 rounded-[2rem] bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-xl shadow-primary-600/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-primary-100 uppercase tracking-widest mb-1">Persentase Hadir</p>
                                    <h3 className="text-4xl font-black tracking-tighter">{stats.percentage}%</h3>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                                    <TrendingUp size={32} />
                                </div>
                            </div>
                            <div className="mt-6 h-2 w-full bg-white/20 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-white rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                                    style={{ width: `${stats.percentage}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center justify-center text-center group hover:border-primary-200 transition-colors">
                            <div className="mb-3 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                                <CalendarDays size={24} />
                            </div>
                            <span className="text-2xl font-black tracking-tighter">{stats.total}</span>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Acara</span>
                        </div>

                        <div className="p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center justify-center text-center group hover:border-primary-200 transition-colors">
                            <div className="mb-3 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                                <BadgeCheck size={24} />
                            </div>
                            <span className="text-2xl font-black tracking-tighter">{stats.present}</span>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Hadir</span>
                        </div>
                    </div>

                    {/* UPCOMING AGENDA */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Agenda Terdekat</h3>
                            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800 mx-4"></div>
                        </div>
                        
                        <div className="space-y-4">
                            {upcomingEvents.map(event => (
                                <div key={event.id} className="group relative flex gap-5 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                                    <div className="flex-shrink-0 w-14 h-14 flex flex-col items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-black border border-slate-100 dark:border-slate-700 shadow-inner">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-tighter">{new Date(event.date).toLocaleDateString('id-ID', {month: 'short'})}</span>
                                        <span className="text-xl leading-none tracking-tighter">{new Date(event.date).getDate()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0 py-1">
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{event.name}</h4>
                                        <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-primary-500"/> {new Date(event.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                            </span>
                                            {event.location && (
                                                <span className="flex items-center gap-1.5 truncate max-w-[120px]">
                                                    <MapPin size={14} className="text-red-500"/> {event.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-primary-500 group-hover:bg-primary-50 transition-all">
                                            <ChevronRight size={18}/>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {upcomingEvents.length === 0 && (
                                <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] bg-slate-50/50 dark:bg-slate-900/30">
                                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <CalendarDays size={32} className="text-slate-300"/>
                                    </div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Belum ada agenda terdekat.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: HISTORY */}
            {activeTab === 'HISTORY' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Riwayat Kehadiran</h3>
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-full font-medium">
                            {stats.myRecords.length} Data
                        </span>
                    </div>
                    
                    {historyList.length > 0 ? (
                        <div className="space-y-0 border rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 shadow-sm">
                            {historyList.map((item) => (
                                <div key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 line-clamp-1">{item.event?.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <CalendarDays size={10} />
                                            {item.event ? new Date(item.event.date).toLocaleDateString('id-ID', {weekday: 'short', day: 'numeric', month: 'long'}) : '-'}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
                                        item.status === 'Present' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900' :
                                        item.status === 'Present Late' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900' :
                                        item.status === 'izin_telat' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-900' :
                                        item.status === 'Excused' ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-900' :
                                        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900'
                                    }`}>
                                        {item.status === 'Present' ? 'Hadir' : 
                                         item.status === 'Present Late' ? 'Hadir Telat' :
                                         item.status === 'izin_telat' ? 'Izin Telat' :
                                         item.status === 'Excused' ? 'Izin' : 'Alpha'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock size={24} className="text-slate-400"/>
                            </div>
                            <p className="text-slate-500 text-sm">Belum ada riwayat absensi.</p>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: PROFILE */}
            {activeTab === 'PROFILE' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                    
                    {/* Profile Header */}
                    <div className="text-center space-y-2">
                        <div className="w-24 h-24 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl font-bold text-slate-400 dark:text-slate-500 border-4 border-white dark:border-slate-900 shadow-lg">
                            {currentUser.full_name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{currentUser.full_name}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{currentUser.email}</p>
                        </div>
                    </div>

                    {/* Data List */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                        <div className="p-4 flex justify-between items-center">
                            <span className="text-sm text-slate-500">No. HP</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{currentUser.phone || '-'}</span>
                        </div>
                        <div className="p-4 flex justify-between items-center">
                            <span className="text-sm text-slate-500">Kelas</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{currentUser.grade || '-'}</span>
                        </div>
                        <div className="p-4 flex justify-between items-center">
                            <span className="text-sm text-slate-500">Kelompok</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{(currentUser as any).groups?.name || '-'}</span>
                        </div>
                        <div className="p-4 flex justify-between items-center">
                            <span className="text-sm text-slate-500">Organisasi</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{orgName}</span>
                        </div>
                    </div>

                    {/* Password Form */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Lock size={16}/> Ganti Password
                        </h4>
                        
                        {msg && (
                            <div className={`p-3 mb-4 rounded-md text-xs font-medium flex items-center gap-2 ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {msg.type === 'success' ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                                {msg.text}
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Password Baru</label>
                                <input 
                                    type="password" 
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 outline-none transition"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Konfirmasi Password</label>
                                <input 
                                    type="password" 
                                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 outline-none transition"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <button disabled={loading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                                {loading ? 'Menyimpan...' : 'Simpan Password'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>

        {/* --- BOTTOM NAVIGATION (Floating Dock) --- */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
            <div className="flex items-center gap-1 p-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-full shadow-2xl ring-1 ring-slate-900/5">
                <button 
                    onClick={() => setActiveTab('HOME')} 
                    className={`p-3 rounded-full transition-all duration-300 ${
                        activeTab === 'HOME' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <BadgeCheck size={20} />
                </button>
                <button 
                    onClick={() => setActiveTab('HISTORY')} 
                    className={`p-3 rounded-full transition-all duration-300 ${
                        activeTab === 'HISTORY' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <CalendarDays size={20} />
                </button>
                <button 
                    onClick={() => setActiveTab('PROFILE')} 
                    className={`p-3 rounded-full transition-all duration-300 ${
                        activeTab === 'PROFILE' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <User size={20} />
                </button>
            </div>
        </div>
    </div>
  );
};