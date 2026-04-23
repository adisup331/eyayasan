import React, { useState, useMemo, useEffect } from 'react';
import { Member, Event, EventAttendance, Organization, Program, Division } from '../types';
import { 
  User, QrCode, CalendarDays, LogOut, CheckCircle2, XCircle, 
  Clock, Lock, MapPin, Activity, ChevronRight, GraduationCap, 
  TrendingUp, Building2, BadgeCheck, Timer, Boxes
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

const BioItem = ({ label, value, icon: Icon }: { label: string; value: string; icon: any }) => (
    <div className="flex items-center gap-5 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-primary-100 dark:hover:border-primary-900">
        <div className="flex-shrink-0 w-11 h-11 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center">
            <Icon size={18} />
        </div>
        <div className="min-w-0">
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{value}</p>
        </div>
    </div>
);

export const MemberPortal: React.FC<MemberPortalProps> = ({ currentUser, events, attendance, organizations, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'HOME' | 'HISTORY' | 'PROFILE'>('HOME');
  const [userForumIds, setUserForumIds] = useState<string[]>([]);
  
  // Profile State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchUserForums();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const fetchUserForums = async () => {
    const { data, error } = await supabase
      .from('forum_members')
      .select('forum_id')
      .eq('member_id', currentUser.id);
    
    if (!error && data) {
      setUserForumIds(data.map(f => f.forum_id));
    }
  };

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
      const myRecords = attendance.filter(a => a.member_id === currentUser.id);
      const present = myRecords.filter(a => a.status === 'Present' || a.status === 'Present Late' || a.status === 'izin_telat').length;
      const total = myRecords.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      return { present, total, percentage, myRecords };
  }, [attendance, currentUser.id]);

  // --- UPCOMING EVENTS (NEXT 5) ---
  const upcomingEvents = useMemo(() => {
      return events
        .filter(e => {
            if (e.status !== 'Upcoming') return false;
            if (e.is_active === false) return false;
            
            // Check if user is explicitly in the attendance list for this event
            const isInvited = attendance.some(a => a.event_id === e.id && a.member_id === currentUser.id);
            
            // If exclusive, MUST be invited or in the forum
            if (e.is_exclusive) {
                if (e.forum_id) return userForumIds.includes(e.forum_id);
                return isInvited;
            }
            
            // For general events, we still show them if they are NOT exclusive
            // BUT the user said "ONLY events they are invited to". 
            // In this system, "invited" usually means an attendance record was created for them.
            // Let's assume all events they should see have an attendance record (status 'Alpha' initially).
            return isInvited;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);
  }, [events, userForumIds, attendance, currentUser.id]);

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
                    <div className="relative w-full aspect-[1/1.3] sm:aspect-[1.58/1] rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all hover:scale-[1.02] active:scale-95 group">
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

                            {/* Middle: Centered QR Code */}
                            <div className="flex flex-col items-center justify-center py-2">
                                <div className="relative">
                                    <div className="absolute -inset-4 bg-primary-500/20 blur-3xl rounded-full animate-pulse"></div>
                                    <div className="bg-white p-3 rounded-2xl shadow-2xl relative z-10 ring-4 ring-white/10">
                                        <img 
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${currentUser.id}`} 
                                            alt="QR" 
                                            className="w-44 h-44 sm:w-40 sm:h-40 object-contain"
                                        />
                                    </div>
                                </div>
                                <div className="mt-4 text-center">
                                    <p className="text-xl font-black truncate leading-none mb-1 drop-shadow-md uppercase tracking-tight">{currentUser.full_name}</p>
                                    <p className="text-[9px] text-slate-400 font-mono tracking-widest opacity-80">{currentUser.id.toUpperCase()}</p>
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

            {/* TAB: PROFILE (Complete Biodata) */}
            {activeTab === 'PROFILE' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8 pb-32">
                    
                    {/* Profile Header */}
                    <div className="text-center space-y-4">
                        <div className="relative inline-block">
                            <div className="w-28 h-28 mx-auto bg-gradient-to-tr from-primary-100 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-[2.5rem] flex items-center justify-center text-4xl font-black text-primary-600 dark:text-primary-400 border-4 border-white dark:border-slate-800 shadow-2xl overflow-hidden">
                                {currentUser.full_name.charAt(0)}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-2 rounded-2xl border-4 border-white dark:border-slate-950 shadow-lg">
                                <BadgeCheck size={16} />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{currentUser.full_name}</h2>
                            {currentUser.nickname && <p className="text-sm text-primary-600 dark:text-primary-400 font-bold mt-1">"{currentUser.nickname}"</p>}
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{currentUser.email}</p>
                        </div>
                    </div>

                    {/* COMPLETE BIODATA SECTION */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 px-2">
                            <User size={18} className="text-primary-600" />
                            <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Biodata Lengkap</h3>
                            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <BioItem label="Jenis Kelamin" value={currentUser.gender === 'L' ? 'Laki-laki' : 'Perempuan'} icon={User} />
                            <BioItem 
                                label="Tempat, Tgl Lahir" 
                                value={currentUser.birth_date ? new Date(currentUser.birth_date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'}) : '-'} 
                                icon={CalendarDays} 
                            />
                            <BioItem label="Nomor WhatsApp" value={currentUser.phone || '-'} icon={Activity} />
                            <BioItem label="Tipe Anggota" value={currentUser.member_type || '-'} icon={BadgeCheck} />
                            <BioItem label="Kelas / Grade" value={currentUser.grade || '-'} icon={GraduationCap} />
                            <BioItem label="Kelompok" value={(currentUser as any).groups?.name || '-'} icon={Boxes} />
                            <BioItem label="Organisasi" value={orgName} icon={Building2} />
                            <BioItem label="Status Kerja" value={currentUser.employment_status || 'Pribumi'} icon={Timer} />
                            {currentUser.employment_status === 'Karyawan' && (
                                <BioItem label="Tempat Kerja" value={currentUser.workplace || '-'} icon={Building2} />
                            )}
                        </div>
                    </div>

                    {/* Password Form (Simplified card) */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white mb-6 uppercase tracking-[0.15em] flex items-center gap-2">
                            <Lock size={16} className="text-primary-600"/> Keamanan Akun
                        </h4>
                        
                        {msg && (
                            <div className={`p-4 mb-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in zoom-in ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                {msg.type === 'success' ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                                {msg.text}
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password Baru</label>
                                <input 
                                    type="password" 
                                    placeholder="••••••••"
                                    className="w-full px-5 py-3.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition font-bold"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Konfirmasi Password</label>
                                <input 
                                    type="password" 
                                    placeholder="••••••••"
                                    className="w-full px-5 py-3.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition font-bold"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <button disabled={loading} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-xl dark:shadow-white/10">
                                {loading ? 'Menyimpan...' : 'GANTI PASSWORD'}
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