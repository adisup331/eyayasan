
import React, { useState, useMemo } from 'react';
import { Member, Event, EventAttendance, Organization, Program, Division } from '../types';
import { 
  User, QrCode, CalendarDays, LogOut, CheckCircle2, XCircle, 
  Clock, Lock, MapPin, Activity, ChevronRight, GraduationCap, 
  TrendingUp, Building2, BadgeCheck
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
      const present = myRecords.filter(a => a.status === 'Present').length;
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

  // Group Name Resolution
  const groupName = (currentUser as any).groups?.name || '-';
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
                    
                    {/* DIGITAL ID CARD (Sleek Dark Style) */}
                    <div className="relative w-full aspect-[1.58/1] rounded-2xl overflow-hidden shadow-2xl transition-transform hover:scale-[1.01]">
                        {/* Background */}
                        <div className="absolute inset-0 bg-slate-900 dark:bg-slate-900">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3"></div>
                        </div>
                        
                        <div className="absolute inset-0 p-6 flex flex-col justify-between text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Kartu Pelajar</p>
                                    <h2 className="text-lg font-bold leading-tight line-clamp-1">{orgName}</h2>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm p-1.5 rounded-lg border border-white/10">
                                    <Activity size={16} className="text-primary-400" />
                                </div>
                            </div>

                            <div className="flex items-end gap-4">
                                <div className="bg-white p-2 rounded-xl">
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${currentUser.id}`} 
                                        alt="QR" 
                                        className="w-20 h-20 object-contain mix-blend-multiply"
                                    />
                                </div>
                                <div>
                                    <p className="text-lg font-bold">{currentUser.full_name}</p>
                                    <p className="text-xs text-slate-400 font-mono mb-2">{currentUser.id.substring(0,8).toUpperCase()}</p>
                                    <div className="flex gap-2">
                                        <span className="text-[10px] bg-primary-500 text-white px-2 py-0.5 rounded font-bold">
                                            {currentUser.member_type}
                                        </span>
                                        {currentUser.grade && (
                                            <span className="text-[10px] bg-slate-700 text-slate-200 px-2 py-0.5 rounded font-bold border border-slate-600">
                                                {currentUser.grade}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STATS ROW */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="mb-2 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 p-2 rounded-full">
                                <TrendingUp size={18} />
                            </div>
                            <span className="text-2xl font-bold tracking-tight">{stats.percentage}%</span>
                            <span className="text-xs text-slate-500 font-medium">Kehadiran</span>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="mb-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 p-2 rounded-full">
                                <CalendarDays size={18} />
                            </div>
                            <span className="text-2xl font-bold tracking-tight">{stats.total}</span>
                            <span className="text-xs text-slate-500 font-medium">Total Acara</span>
                        </div>
                    </div>

                    {/* UPCOMING AGENDA */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Agenda Terdekat</h3>
                        </div>
                        
                        <div className="space-y-3">
                            {upcomingEvents.map(event => (
                                <div key={event.id} className="group relative flex gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all hover:border-primary-200 dark:hover:border-primary-800">
                                    <div className="flex-shrink-0 w-12 flex flex-col items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border border-slate-200 dark:border-slate-700">
                                        <span className="text-[10px] text-slate-500 uppercase">{new Date(event.date).toLocaleDateString('id-ID', {month: 'short'})}</span>
                                        <span className="text-lg leading-none">{new Date(event.date).getDate()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0 py-0.5">
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{event.name}</h4>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Clock size={12}/> {new Date(event.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                            </span>
                                            {event.location && (
                                                <span className="flex items-center gap-1 truncate max-w-[100px]">
                                                    <MapPin size={12}/> {event.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight size={16} className="text-slate-300"/>
                                    </div>
                                </div>
                            ))}
                            {upcomingEvents.length === 0 && (
                                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                    <CalendarDays size={24} className="mx-auto text-slate-300 mb-2"/>
                                    <p className="text-xs text-slate-400">Belum ada agenda terdekat.</p>
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
                                        item.status === 'Excused' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-900' :
                                        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900'
                                    }`}>
                                        {item.status === 'Present' ? 'Hadir' : item.status === 'Excused' ? 'Izin' : 'Alpha'}
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
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{groupName}</span>
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
