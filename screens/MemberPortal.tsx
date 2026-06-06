'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Member, Event, EventAttendance, Organization, Program, Division } from '../types';
import { 
  User, QrCode, CalendarDays, LogOut, CheckCircle2, XCircle, 
  Clock, Lock, MapPin, Activity, ChevronRight, GraduationCap, 
  TrendingUp, Building2, BadgeCheck, Timer, Boxes, Edit, Save, X,
  Briefcase, FileText, History, AlertCircle, History as HistoryIcon, Plus, Trash2, AlertTriangle, Search, RefreshCw
} from '../components/ui/Icons';
import { supabase } from '../supabaseClient';
import { Modal } from '../components/Modal';
import { ReviewItem } from '../types';

interface MemberPortalProps {
  currentUser: Member | null;
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

export const MemberPortal: React.FC<MemberPortalProps> = ({ currentUser, events, attendance, organizations, programs = [], divisions = [], onLogout, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'HOME' | 'HISTORY' | 'REPORTS' | 'PROFILE'>('HOME');

  // Hydrate persisted tab after mount (avoids SSR localStorage access).
  useEffect(() => {
    const saved = localStorage.getItem('portal_active_tab') as 'HOME' | 'HISTORY' | 'REPORTS' | 'PROFILE' | null;
    if (saved) setActiveTab(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('portal_active_tab', activeTab);
  }, [activeTab]);

  const [userForumIds, setUserForumIds] = useState<string[]>([]);
  
  // Review/Evaluation State (Ported from Programs.tsx)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewProgram, setReviewProgram] = useState<Program | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deleteReviewConfirm, setDeleteReviewConfirm] = useState<{isOpen: boolean, prog: Program | null, reviewId: string | null}>({ isOpen: false, prog: null, reviewId: null });
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [reviewTargetMonth, setReviewTargetMonth] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewResult, setReviewResult] = useState<'Success'|'Warning'|'Failed'|'Pending'>('Success');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState(currentUser?.full_name || '');
  const [editNickname, setEditNickname] = useState(currentUser?.nickname || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  const [editBirthDate, setEditBirthDate] = useState(currentUser?.birth_date || '');
  const [editGender, setEditGender] = useState(currentUser?.gender || '');

  const fetchUserForums = async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('forum_members')
      .select('forum_id')
      .eq('member_id', currentUser.id);
    
    if (!error && data) {
      setUserForumIds(data.map(f => f.forum_id));
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchUserForums();
      setEditFullName(currentUser.full_name);
      setEditNickname(currentUser.nickname || '');
      setEditPhone(currentUser.phone || '');
      setEditBirthDate(currentUser.birth_date || '');
      setEditGender(currentUser.gender || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setMsg(null);
    setLoading(true);

    try {
        const { error } = await supabase
            .from('members')
            .update({
                full_name: editFullName,
                nickname: editNickname,
                phone: editPhone,
                birth_date: editBirthDate,
                gender: editGender
            })
            .eq('id', currentUser.id);

        if (error) throw error;
        
        setMsg({ text: 'Profil berhasil diperbarui.', type: 'success' });
        setIsEditing(false);
        onRefresh(); // Refresh parent data
    } catch (err: any) {
        setMsg({ text: err.message, type: 'error' });
    } finally {
        setLoading(false);
    }
  };

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
      if (!currentUser) return { present: 0, total: 0, percentage: 0, myRecords: [] };
      const myRecords = attendance.filter(a => a.member_id === currentUser.id);
      const present = myRecords.filter(a => a.status === 'Present' || a.status === 'Present Late' || a.status === 'izin_telat').length;
      const total = myRecords.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      return { present, total, percentage, myRecords };
  }, [attendance, currentUser]);

  // --- UPCOMING EVENTS (NEXT 5) ---
  const upcomingEvents = useMemo(() => {
      if (!currentUser) return [];
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
  }, [events, userForumIds, attendance, currentUser]);

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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const handleOpenReview = (program: Program) => {
    setReviewProgram(program);
    setEditingReviewId(null);
    setReviewDate(new Date().toISOString().split('T')[0]);
    setReviewTitle('');
    setReviewContent('');
    setReviewResult('Success');
    
    // Parse months helper
    const parseMonths = (monthStr: string | null | undefined): string[] => {
        if (!monthStr) return [];
        try {
          const parsed = JSON.parse(monthStr);
          return Array.isArray(parsed) ? parsed : [monthStr];
        } catch (e) {
          return monthStr ? [monthStr] : [];
        }
    };
    const pMonths = parseMonths(program.month);
    setReviewTargetMonth(pMonths[0] || '');
    
    setIsReviewModalOpen(true);
  };

  const handleEditReview = (rev: ReviewItem) => {
      setEditingReviewId(rev.id);
      setReviewDate(rev.date);
      setReviewTargetMonth(rev.target_month || '');
      setReviewTitle(rev.title);
      setReviewContent(rev.content);
      setReviewResult(rev.result_status);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reviewProgram) return;
      setLoading(true);
      
      let updatedReviews: ReviewItem[] = [];
      
      if (editingReviewId) {
          updatedReviews = (reviewProgram.review_data || []).map(r => {
              if (r.id === editingReviewId) {
                  return {
                      ...r,
                      date: reviewDate,
                      target_month: reviewTargetMonth,
                      title: reviewTitle,
                      content: reviewContent,
                      result_status: reviewResult
                  } 
              }
              return r;
          });
      } else {
          const newReview: ReviewItem = { 
              id: Date.now().toString(), 
              date: reviewDate, 
              target_month: reviewTargetMonth,
              title: reviewTitle, 
              content: reviewContent, 
              result_status: reviewResult, 
              images: [] 
          };
          updatedReviews = [...(reviewProgram.review_data || []), newReview];
      }

      try {
          const { error } = await supabase.from('programs').update({ review_data: updatedReviews }).eq('id', reviewProgram.id);
          if (error) throw error;
          showToast(editingReviewId ? "Laporan diperbarui" : "Laporan disimpan");
          onRefresh();
          setReviewProgram(prev => prev ? {...prev, review_data: updatedReviews} : null);
          setEditingReviewId(null);
          setReviewTitle('');
          setReviewContent('');
      } catch (err: any) { 
          showToast(err.message, "error"); 
      } finally { 
          setLoading(false);
      }
  };

  const handleDeleteReview = (prog: Program, reviewId: string) => {
      setDeleteReviewConfirm({ isOpen: true, prog, reviewId });
  };

  const executeDeleteReview = async () => {
      const { prog, reviewId } = deleteReviewConfirm;
      if (!prog || !reviewId) return;

      setLoading(true);
      const updated = (prog.review_data || []).filter(r => r.id !== reviewId);
      try {
          const { error } = await supabase.from('programs').update({ review_data: updated }).eq('id', prog.id);
          if (error) throw error;
          
          onRefresh();
          setReviewProgram(prev => prev ? {...prev, review_data: updated} : null);
          showToast("Laporan berhasil dihapus");
          setDeleteReviewConfirm({ isOpen: false, prog: null, reviewId: null });
      } catch (err: any) { 
          showToast(err.message, "error"); 
      } finally {
          setLoading(false);
      }
  };

  const myPrograms = useMemo(() => {
    if (!currentUser) return [];
    return programs.filter(p => 
        p.division_id === currentUser.division_id || 
        p.organization_id === currentUser.organization_id
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [programs, currentUser]);

  const [searchReport, setSearchReport] = useState('');
  const filteredMyPrograms = useMemo(() => {
      if (!searchReport) return myPrograms;
      return myPrograms.filter(p => p.name.toLowerCase().includes(searchReport.toLowerCase()));
  }, [myPrograms, searchReport]);

  const parseMonths = (monthStr: string | null | undefined): string[] => {
    if (!monthStr) return [];
    try {
      const parsed = JSON.parse(monthStr);
      return Array.isArray(parsed) ? parsed : [monthStr];
    } catch (e) {
      return monthStr ? [monthStr] : [];
    }
  };

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  if (!currentUser) {
    return <div className="h-screen flex items-center justify-center p-6 text-slate-500 font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-950">Memuat Profil...</div>;
  }

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
        
        {/* --- TOAST --- */}
        {toast && (
            <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100] animate-in fade-in slide-in-from-bottom-4 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
                <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
            </div>
        )}

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

            {/* TAB: REPORTS */}
            {activeTab === 'REPORTS' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Evaluasi Program</h3>
                            <span className="text-[10px] font-black bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 px-3 py-1 rounded-full">{myPrograms.length} PROGRAM</span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                placeholder="Cari program kerja..."
                                value={searchReport}
                                onChange={e => setSearchReport(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {filteredMyPrograms.map(prog => (
                            <div key={prog.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">{prog.name}</h4>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {parseMonths(prog.month).slice(0, 3).map(m => (
                                                <span key={m} className="text-[8px] font-black bg-slate-50 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-widest">{m}</span>
                                            ))}
                                            {parseMonths(prog.month).length > 3 && <span className="text-[8px] font-black text-slate-400">+{parseMonths(prog.month).length - 3}</span>}
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                        prog.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                        prog.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {prog.status === 'Completed' ? 'Selesai' : 
                                         prog.status === 'In Progress' ? 'Proses' : 'Rencana'}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <div className="flex -space-x-1.5">
                                            {[...Array(Math.min(3, prog.review_data?.length || 0))].map((_, i) => (
                                                <div key={i} className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                                                    <CheckCircle2 size={10} className="text-primary-600 whitespace-nowrap"/>
                                                </div>
                                            ))}
                                        </div>
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                            {prog.review_data?.length || 0} Laporan
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => handleOpenReview(prog)}
                                        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl dark:shadow-white/10 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <Plus size={14}/> Input Laporan
                                    </button>
                                </div>
                            </div>
                        ))}

                        {filteredMyPrograms.length === 0 && (
                            <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-900/30 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <FileText size={48} className="mx-auto text-slate-300 mb-4 opacity-50"/>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Tidak Ada Program Terkait</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
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
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-3">
                                <User size={18} className="text-primary-600" />
                                <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Biodata Lengkap</h3>
                            </div>
                            <button 
                                onClick={() => setIsEditing(!isEditing)}
                                className="flex items-center gap-1.5 text-[10px] font-black text-primary-600 uppercase tracking-widest hover:bg-primary-50 dark:hover:bg-primary-950 p-2 rounded-lg transition-colors border border-primary-100 dark:border-primary-900/50 shadow-sm"
                            >
                                {isEditing ? <><X size={14}/> Batal</> : <><Edit size={14}/> Edit Profile</>}
                            </button>
                        </div>
                        
                        <div className="h-px w-full bg-slate-100 dark:bg-slate-800"></div>

                        {isEditing ? (
                            <form onSubmit={handleUpdateProfile} className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                {msg && msg.type === 'error' && (
                                    <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-100">
                                        <XCircle size={16}/> {msg.text}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                                        <input 
                                            type="text" required value={editFullName} onChange={e => setEditFullName(e.target.value)}
                                            className="w-full px-5 py-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition font-bold"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Panggilan</label>
                                        <input 
                                            type="text" value={editNickname} onChange={e => setEditNickname(e.target.value)}
                                            className="w-full px-5 py-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition font-bold"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Kelamin</label>
                                            <select 
                                                value={editGender} onChange={e => setEditGender(e.target.value as any)}
                                                className="w-full px-5 py-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition font-bold"
                                            >
                                                <option value="L">Laki-laki</option>
                                                <option value="P">Perempuan</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">No. WhatsApp</label>
                                            <input 
                                                type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                                                className="w-full px-5 py-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Lahir</label>
                                        <input 
                                            type="date" value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)}
                                            className="w-full px-5 py-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition font-bold"
                                        />
                                    </div>
                                    <button 
                                        type="submit" disabled={loading}
                                        className="w-full bg-primary-600 dark:bg-primary-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary-600/20"
                                    >
                                        {loading ? 'Menyimpan...' : <><Save size={16}/> SIMPAN PERUBAHAN</>}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                        )}
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
                    onClick={() => setActiveTab('REPORTS')} 
                    className={`p-3 rounded-full transition-all duration-300 ${
                        activeTab === 'REPORTS' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <FileText size={20} />
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

        {/* REVIEW MODAL (Ported from Programs.tsx) */}
        <Modal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} title="Laporan & Evaluasi Program">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800/50">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="bg-primary-600 p-2 rounded-xl text-white shadow-lg shadow-primary-600/20">
                              <Briefcase size={18}/>
                          </div>
                          <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detail Program Kerja</p>
                              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{reviewProgram?.name}</h4>
                          </div>
                      </div>
                      <div className="space-y-3">
                          <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic border-l-4 border-slate-200 dark:border-slate-700 pl-4">
                            {reviewProgram?.description || 'Tidak ada deskripsi rinci program ini.'}
                          </p>
                      </div>
                  </div>

                  <form onSubmit={handleSaveReview} className="space-y-5">
                      <div className="flex items-center justify-between">
                         <h5 className="text-[10px] font-black text-primary-600 uppercase tracking-widest flex items-center gap-2">
                             {editingReviewId ? <Edit size={14}/> : <Plus size={14}/>} {editingReviewId ? 'Edit Laporan' : 'Input Laporan Baru'}
                         </h5>
                         {editingReviewId && (
                             <button type="button" onClick={() => {setEditingReviewId(null); setReviewTitle(''); setReviewContent('');}} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline">Batal Edit</button>
                         )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tgl Pelaksanaan</label>
                              <input type="date" required value={reviewDate} onChange={e => setReviewDate(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500" />
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Bulan</label>
                              <select value={reviewTargetMonth} onChange={e => setReviewTargetMonth(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500">
                                {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Hasil</label>
                          <div className="flex gap-2">
                            {['Success', 'Warning', 'Failed', 'Pending'].map(s => (
                                <button key={s} type="button" onClick={() => setReviewResult(s as any)} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-tight transition-all border ${
                                    reviewResult === s ? 
                                    (s === 'Success' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/20' :
                                     s === 'Warning' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' :
                                     s === 'Failed' ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-slate-700 border-slate-700 text-white shadow-lg shadow-slate-700/20')
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                                }`}>
                                    {s === 'Success' ? 'Berhasil' : s === 'Warning' ? 'Kendala' : s === 'Failed' ? 'Gagal' : 'Antri'}
                                </button>
                            ))}
                          </div>
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul Temuan / Laporan</label>
                          <input type="text" required value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500" placeholder="Misal: Progress Pekerjaan 75%" />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Uraian Detail Evaluasi</label>
                          <textarea rows={6} required value={reviewContent} onChange={e => setReviewContent(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500 transition custom-scrollbar" placeholder="Ketik secara detail kondisi di lapangan..." />
                      </div>
                      <button type="submit" disabled={loading} className={`w-full ${editingReviewId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-primary-600 shadow-primary-600/20'} text-white py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3`}>
                          {editingReviewId ? <Save size={18}/> : <CheckCircle2 size={18}/>} {editingReviewId ? 'Update Laporan' : 'Simpan Laporan'}
                      </button>
                  </form>
              </div>

              <div className="lg:col-span-3 space-y-6">
                  <div className="flex items-center justify-between border-b dark:border-slate-800 pb-4">
                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                        <HistoryIcon size={18}/> Riwayat Laporan
                    </h4>
                    <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-full">{reviewProgram?.review_data?.length || 0} TOTAL</span>
                  </div>
                  
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                      {reviewProgram?.review_data && reviewProgram.review_data.length > 0 ? [...reviewProgram.review_data].reverse().map(rev => (
                          <div key={rev.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 relative group/rev shadow-sm hover:shadow-md transition">
                              <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-4">
                                      <div className={`p-3 rounded-2xl text-white shadow-lg ${
                                          rev.result_status === 'Success' ? 'bg-green-500 shadow-green-500/20' :
                                          rev.result_status === 'Warning' ? 'bg-amber-500 shadow-amber-500/20' :
                                          rev.result_status === 'Failed' ? 'bg-red-500 shadow-red-500/20' : 'bg-slate-500 shadow-slate-500/20'
                                      }`}>
                                          {rev.result_status === 'Success' ? <CheckCircle2 size={18}/> : 
                                           rev.result_status === 'Warning' ? <AlertCircle size={18}/> :
                                           rev.result_status === 'Failed' ? <XCircle size={18}/> : <Timer size={18}/>}
                                      </div>
                                      <div>
                                          <div className="flex flex-wrap items-center gap-2">
                                              <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{rev.title}</p>
                                              <span className="text-[8px] bg-primary-600 text-white px-2 py-0.5 rounded-full font-black uppercase shadow-sm">{rev.target_month}</span>
                                          </div>
                                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(rev.date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                       <button onClick={() => handleEditReview(rev)} className="p-2 text-slate-400 hover:text-primary-500 transition" title="Edit Laporan">
                                           <Edit size={16}/>
                                       </button>
                                       <button onClick={() => handleDeleteReview(reviewProgram, rev.id)} className="p-2 text-slate-400 hover:text-red-500 transition" title="Hapus Laporan">
                                           <Trash2 size={16}/>
                                       </button>
                                  </div>
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 px-5 py-4 rounded-2xl border border-slate-50 dark:border-slate-700/50 whitespace-pre-wrap font-medium">
                                  {rev.content}
                              </div>
                          </div>
                      )) : (
                          <div className="py-20 text-center text-slate-300 flex flex-col items-center gap-4">
                              <FileText size={48} className="opacity-20"/>
                              <p className="text-[10px] font-black uppercase tracking-widest">Belum ada evaluasi tersimpan</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
        </Modal>

        {/* DELETE REVIEW CONFIRMATION MODAL */}
        <Modal isOpen={deleteReviewConfirm.isOpen} onClose={() => setDeleteReviewConfirm({ isOpen: false, prog: null, reviewId: null })} title="Konfirmasi Hapus Laporan">
            <div className="space-y-6 text-center py-4">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Trash2 size={40} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Hapus Laporan Ini?</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Laporan yang sudah dihapus tidak dapat dikembalikan. Apakah Anda yakin?</p>
                </div>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={executeDeleteReview} 
                        disabled={loading}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18}/> : <><Trash2 size={18}/> Hapus Laporan</>}
                    </button>
                    <button 
                        onClick={() => setDeleteReviewConfirm({ isOpen: false, prog: null, reviewId: null })} 
                        className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                        Batalkan
                    </button>
                </div>
            </div>
        </Modal>
    </div>
  );
};