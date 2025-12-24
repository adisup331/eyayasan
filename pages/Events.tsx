import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Event, EventAttendance, Member, Foundation, EventSession, Group, ParentEvent, Division } from '../types';
import { 
  Plus, Edit, Trash2, CalendarDays, MapPin, 
  Clock, Search, AlertTriangle, MessageCircle, Copy, Check, Minimize2, Maximize2,
  ClipboardCheck, BarChart3, ChevronLeft, ChevronRight, Filter, TrendingUp, Activity, Minus, TrendingDown, Ban, CheckCircle2, HelpCircle, XCircle, RotateCcw, Timer, PlayCircle, X, List, StopCircle, Lock, UserPlus, RefreshCw, Boxes, Layers, Tag, Share2, FileText, Download, UserX, Save, Users, ChevronDown, MoreVertical
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';
import { jsPDF } from 'jspdf';

interface EventsProps {
  events: Event[];
  members: Member[];
  attendance: EventAttendance[];
  groups: Group[]; 
  divisions: Division[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

export const Events: React.FC<EventsProps> = ({ events, members, attendance, groups, divisions, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'ATTENDANCE' | 'PARENT_EVENTS'>('AGENDA');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const activeEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events]);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [parentEvents, setParentEvents] = useState<ParentEvent[]>([]);
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<ParentEvent | null>(null);
  const [parentName, setParentName] = useState('');
  const [parentDesc, setParentDesc] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Event | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('Pengajian');
  const [parentEventId, setParentEventId] = useState('');
  const [status, setStatus] = useState<'Upcoming' | 'Completed' | 'Cancelled'>('Upcoming');
  const [lateTolerance, setLateTolerance] = useState<number>(15);
  
  // WhatsApp Preview State
  const [isWAPreviewOpen, setIsWAPreviewOpen] = useState(false);
  const [waPreviewText, setWaPreviewText] = useState('');

  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [inviteType, setInviteType] = useState<'ALL' | 'SELECT'>('ALL');
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [inviteSearch, setInviteSearch] = useState(''); 

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [attView, setAttView] = useState<'LIST' | 'DETAIL' | 'PARENT_RECAP'>('LIST');
  const [selectedAttEvent, setSelectedAttEvent] = useState<Event | null>(null);
  const [selectedParentEvent, setSelectedParentEvent] = useState<ParentEvent | null>(null);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'Present' | 'Present Late' | 'Excused' | 'Absent' | 'Excused Late'>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>(''); 

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null, mode: 'EVENT' | 'PARENT' | 'TAKEOUT'}>({ isOpen: false, id: null, mode: 'EVENT' });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState<{memberId: string, status: any} | null>(null);
  const [tempReason, setTempReason] = useState('');

  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
      fetchParentEvents();
  }, [activeFoundation]);

  const fetchParentEvents = async () => {
      if (!activeFoundation) return;
      const { data, error } = await supabase
        .from('parent_events')
        .select('*')
        .eq('foundation_id', activeFoundation.id)
        .order('name');
      if (!error && data) setParentEvents(data);
  };

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await Promise.all([onRefresh(), fetchParentEvents()]);
      setTimeout(() => { setIsRefreshing(false); showToast("Data diperbarui"); }, 500);
  };

  const previewWhatsAppAnnouncement = (event: Event) => {
    const eventDate = new Date(event.date);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const dayName = days[eventDate.getDay()];
    const dateFormatted = `${eventDate.getDate()} ${months[eventDate.getMonth()]} ${eventDate.getFullYear()}`;
    const timeStr = `${eventDate.getHours().toString().padStart(2, '0')}.${eventDate.getMinutes().toString().padStart(2, '0')}`;

    const eventAttRecords = (attendance || []).filter(a => a.event_id === event.id);
    const invitedMemberIds = eventAttRecords.map(a => a.member_id);
    const invitedMembers = members.filter(m => invitedMemberIds.includes(m.id));

    const sortedDivs = [...divisions].sort((a,b) => (a.order_index || 0) - (b.order_index || 0));
    const groupedByDivision: Record<string, string[]> = {};
    invitedMembers.forEach(m => {
        const divName = divisions.find(d => d.id === m.division_id)?.name || 'Lain-lain';
        if (!groupedByDivision[divName]) groupedByDivision[divName] = [];
        groupedByDivision[divName].push(m.full_name);
    });

    let inviteesText = "";
    sortedDivs.forEach(div => {
        if (groupedByDivision[div.name]) {
            inviteesText += `\n*${getDivisionIcon(div.name)} ${div.name}*\n`;
            groupedByDivision[div.name].forEach(name => {
                inviteesText += `${name}\n`;
            });
        }
    });

    const text = `*📢 INFO DAN PENGUMUMAN*

*${event.name.toUpperCase()}*

Assalamu’alaikum warahmatullahi wabarakatuh.

Dengan ini dimohon kehadirannya dalam kegiatan:

📅 *Hari : ${dayName}, ${dateFormatted}*
⏰ *Pukul : ${timeStr} WIB s/d Selesai*
🕋 *Tempat : ${event.location || '-'}*
📒 *Acara : ${event.description || event.name}*

Adapun detail peserta yang diharapkan bisa hadir yaitu : 
${inviteesText}

Atas perhatian dan amal sholihnya di syukuri

*الحمد لله جزا كم الله خيرا*
 والسلام عليكم warahmatullahi wabarakatuh

TTD Pimpinan
${activeFoundation?.name || 'E-Yayasan'}`;

    setWaPreviewText(text);
    setIsWAPreviewOpen(true);
  };

  const getDivisionIcon = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('pembina')) return '👳‍♂';
      if (lower.includes('harian')) return '🤵';
      if (lower.includes('kurikulum')) return '👨‍🏫';
      if (lower.includes('pendidik')) return '👨‍🏫';
      if (lower.includes('dana')) return '👨‍🚒';
      if (lower.includes('mandiri')) return '👨‍🏭';
      if (lower.includes('putri')) return '🧕';
      if (lower.includes('bk')) return '🕵‍♂';
      if (lower.includes('seni') || lower.includes('orsen') || lower.includes('olahraga')) return '🏃‍♂';
      if (lower.includes('sarana')) return '👨‍🔧';
      if (lower.includes('tahfidz')) return '🕌';
      if (lower.includes('gpa') || lower.includes('kmm')) return '👨‍🎓';
      return '👥';
  };

  const handleAttendanceChange = async (memberId: string, newStatus: 'Present' | 'Absent' | 'Excused' | 'Excused Late' | 'Present Late', reason?: string) => {
    if (!selectedAttEvent) return;
    
    // Perbaikan: Jika status adalah Izin atau Izin Telat dan belum ada alasan, tampilkan modal alasan.
    if ((newStatus === 'Excused' || newStatus === 'Excused Late') && reason === undefined) {
        setPendingAttendance({ memberId, status: newStatus });
        setTempReason('');
        setIsReasonModalOpen(true);
        return;
    }

    try {
        const now = new Date();
        const existingRecord = (attendance || []).find(a => a.event_id === selectedAttEvent.id && a.member_id === memberId);
        const updateData: any = { 
           event_id: selectedAttEvent.id, 
           member_id: memberId, 
           status: newStatus,
           check_in_time: (newStatus === 'Present' || newStatus === 'Present Late') ? (existingRecord?.check_in_time || now.toISOString()) : (existingRecord?.check_in_time || null),
           leave_reason: reason || existingRecord?.leave_reason || null
        };
        const { error } = await supabase.from('event_attendance').upsert(updateData, { onConflict: 'event_id, member_id' });
        if (error) throw error;
        onRefresh(); 
        showToast("Status absensi diperbarui", "success");
    } catch (error: any) { 
        showToast('Gagal update: ' + error.message, 'error'); 
    }
  };

  const handleSaveReason = (e: React.FormEvent) => {
      e.preventDefault();
      if (!pendingAttendance) return;
      handleAttendanceChange(pendingAttendance.memberId, pendingAttendance.status, tempReason);
      setIsReasonModalOpen(false);
      setPendingAttendance(null);
  };

  const handleResetStatus = async (memberId: string) => {
      if (!selectedAttEvent) return;
      try {
          const { error } = await supabase.from('event_attendance').update({ status: 'Absent', check_in_time: null, leave_reason: null }).match({ event_id: selectedAttEvent.id, member_id: memberId });
          if (error) throw error;
          onRefresh();
          showToast("Status direset", "info");
      } catch (error: any) { showToast('Gagal reset: ' + error.message, 'error'); }
  };

  const handleAddManualMember = async (memberId: string) => {
    if (!selectedAttEvent) return;
    try {
      const { error } = await supabase.from('event_attendance').insert([{ event_id: selectedAttEvent.id, member_id: memberId, status: 'Absent' }]);
      if (error) { if (error.code === '23505') { showToast("Sudah ada di daftar.", "error"); return; } throw error; }
      showToast("Anggota ditambahkan");
      onRefresh();
    } catch (error: any) { showToast(error.message, 'error'); }
  };

  const handleSaveParent = async (e: React.FormEvent) => {
      e.preventDefault();
      const payload: any = { name: parentName, description: parentDesc };
      if (!editingParent && activeFoundation) payload.foundation_id = activeFoundation.id;
      try {
          if (editingParent) await supabase.from('parent_events').update(payload).eq('id', editingParent.id);
          else await supabase.from('parent_events').insert([payload]);
          fetchParentEvents(); setIsParentModalOpen(false); showToast("Event Utama disimpan");
      } catch (err: any) { showToast(err.message, "error"); }
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      if (deleteConfirm.mode === 'EVENT') {
        await supabase.from('events').delete().eq('id', deleteConfirm.id);
      } else if (deleteConfirm.mode === 'PARENT') {
        await supabase.from('parent_events').delete().eq('id', deleteConfirm.id);
      } else if (deleteConfirm.mode === 'TAKEOUT') {
        await supabase.from('event_attendance').delete().match({ event_id: selectedAttEvent?.id, member_id: deleteConfirm.id });
      }
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null, mode: 'EVENT' });
      showToast("Data berhasil dihapus", "success");
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleDownloadPDF = () => {
    if (!selectedAttEvent || !currentEventResume) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(activeFoundation?.name || 'E-YAYASAN', 105, 15, { align: 'center' });
    doc.setFontSize(12); doc.text(`LAPORAN ABSENSI: ${selectedAttEvent.name}`, 105, 25, { align: 'center' });
    doc.save(`Resume_Absensi_${selectedAttEvent.name.replace(/\s+/g, '_')}.pdf`);
    showToast("PDF Berhasil diunduh");
  };

  const currentEventResume = useMemo(() => {
    if (!selectedAttEvent) return null;
    const eventAtt = (attendance || []).filter(a => a.event_id === selectedAttEvent.id);
    const present = eventAtt.filter(a => a.status === 'Present').length;
    const presentLate = eventAtt.filter(a => a.status === 'Present Late').length;
    const excusedLate = eventAtt.filter(a => a.status === 'Excused Late').length;
    const excused = eventAtt.filter(a => a.status === 'Excused').length;
    const absent = eventAtt.filter(a => a.status === 'Absent').length;
    const total = members.filter(m => (attendance || []).some(a => a.event_id === selectedAttEvent.id && a.member_id === m.id)).length || eventAtt.length;
    return { present, presentLate, excusedLate, excused, absent, total };
  }, [selectedAttEvent, attendance, members]);

  const filteredAttendanceMembers = useMemo(() => {
    if (!selectedAttEvent) return [];
    return members.filter(m => (attendance || []).some(a => a.event_id === selectedAttEvent?.id && a.member_id === m.id))
      .filter(m => m.full_name.toLowerCase().includes(attendanceSearch.toLowerCase()))
      .filter(m => !selectedGroupFilter || m.group_id === selectedGroupFilter) 
      .filter(m => {
          if (attendanceStatusFilter === 'ALL') return true;
          const record = (attendance || []).find(a => a.event_id === selectedAttEvent?.id && a.member_id === m.id);
          return record?.status === attendanceStatusFilter;
      });
  }, [members, attendance, selectedAttEvent, attendanceSearch, attendanceStatusFilter, selectedGroupFilter]);

  const handleOpenModal = (event?: Event) => {
    if (event) {
      setEditingItem(event); setName(event.name);
      const dt = new Date(event.date); setDate(dt.toISOString().split('T')[0]);
      setTime(`${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`);
      setLocation(event.location || ''); setDescription(event.description || ''); setEventType(event.event_type || 'Pengajian');
      setParentEventId(event.parent_event_id || ''); setStatus(event.status);
      setLateTolerance(event.late_tolerance || 15);
      setSessions(event.sessions || []);
      setInviteType('SELECT');
      const invitedIds = (attendance || []).filter(a => a.event_id === event.id).map(a => a.member_id);
      setSelectedInvitees(invitedIds);
    } else {
      setEditingItem(null); setName(''); setDate(new Date().toISOString().split('T')[0]); setTime('09:00');
      setLocation(''); setDescription(''); setEventType('Pengajian'); setParentEventId(''); setStatus('Upcoming');
      setLateTolerance(15); setSessions([]); setInviteType('ALL'); setSelectedInvitees([]);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    const fullDate = new Date(`${date}T${time}:00`);
    const payload: any = { 
        name, date: fullDate.toISOString(), location, description, 
        status, event_type: eventType, parent_event_id: parentEventId || null,
        late_tolerance: lateTolerance,
        sessions: sessions
    };
    if (!editingItem && activeFoundation) payload.foundation_id = activeFoundation.id;
    try {
      let eventId = editingItem?.id;
      if (editingItem) { 
          await supabase.from('events').update(payload).eq('id', editingItem.id); 
      } else { 
          const { data: newEv, error: evError } = await supabase.from('events').insert([payload]).select().single(); 
          if (evError) throw evError;
          eventId = newEv?.id; 
      }

      if (eventId) {
          const finalInvitedIds = inviteType === 'ALL' ? members.filter(m => m.foundation_id === (activeFoundation?.id || m.foundation_id)).map(m => m.id) : selectedInvitees;
          const attendancePayload = finalInvitedIds.map(mId => ({ event_id: eventId, member_id: mId, status: 'Absent' }));
          const { error: attError } = await supabase.from('event_attendance').upsert(attendancePayload, { onConflict: 'event_id, member_id' });
          if (attError) throw attError;
      }

      onRefresh(); setIsModalOpen(false); showToast("Berhasil disimpan");
    } catch (error: any) { showToast(error.message, 'error'); } finally { setIsSubmitting(false); }
  };

  const addSession = () => { setSessions([...sessions, { id: Date.now().toString(), name: '', startTime: '08:00' }]); };
  const updateSession = (index: number, field: keyof EventSession, value: string) => {
      const newSessions = [...sessions];
      newSessions[index] = { ...newSessions[index], [field]: value };
      setSessions(newSessions);
  };
  const removeSession = (index: number) => { setSessions(sessions.filter((_, i) => i !== index)); };
  const toggleInvitee = (memberId: string) => { setSelectedInvitees(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]); };

  const renderMobileUI = () => (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-black -m-4 md:m-0 pb-32">
        <div className="bg-white dark:bg-dark-card border-b dark:border-dark-border p-4 sticky top-0 z-20 flex justify-between items-center shadow-sm">
            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Manajemen Acara</h2>
            <button onClick={handleManualRefresh} className="p-2 text-gray-400"><RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''}/></button>
        </div>
        <div className="flex-1 p-4 space-y-4">
            {activeTab === 'AGENDA' && (
                <div className="space-y-4">
                    <button onClick={() => handleOpenModal()} className="w-full bg-primary-600 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase shadow-lg shadow-primary-600/20 active:scale-95 transition-transform"><Plus size={18}/> Tambah Acara Baru</button>
                    {activeEvents.map(item => (
                        <div key={item.id} className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden shadow-sm flex flex-col active:scale-[0.98] transition-transform">
                            <div className={`h-1 w-full ${item.status === 'Upcoming' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black uppercase text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded">{item.event_type}</span>
                                    <div className="flex gap-4">
                                        <button onClick={() => handleOpenModal(item)} className="text-gray-400"><Edit size={18}/></button>
                                        <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id, mode: 'EVENT'})} className="text-gray-400"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{item.name}</h3>
                                <div className="flex flex-col gap-1 text-[11px] text-gray-500 mb-4">
                                    <div className="flex items-center gap-2"><CalendarDays size={12}/> {new Date(item.date).toLocaleDateString('id-ID', {weekday:'short', day:'numeric', month:'short'})}</div>
                                    <div className="flex items-center gap-2 text-primary-600"><MapPin size={12}/> {item.location || 'Lokasi -'}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setSelectedAttEvent(item); setAttView('DETAIL'); setActiveTab('ATTENDANCE'); }} className="flex-1 py-3 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><ClipboardCheck size={14}/> Absensi</button>
                                    <button onClick={() => previewWhatsAppAnnouncement(item)} className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl"><Share2 size={18}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {activeEvents.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center gap-4 text-gray-400 font-black uppercase tracking-widest text-xs italic">
                            <div className="p-5 bg-gray-100 dark:bg-gray-800 rounded-full mb-2"><CalendarDays size={48} className="opacity-20"/></div>
                            Belum ada agenda acara.<br/>Silakan buat acara pertama Anda.
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'ATTENDANCE' && (
                <div className="space-y-4">
                    {attView === 'LIST' ? (
                        <div className="space-y-4">
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                                <div><h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200">Rekapitulasi Global</h4><p className="text-[10px] text-indigo-600">Gabungkan absensi per event utama</p></div>
                                <button onClick={() => setAttView('PARENT_RECAP')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-transform">Buka Rekap</button>
                            </div>
                            {activeEvents.map(ev => (
                                <button key={ev.id} onClick={() => { setSelectedAttEvent(ev); setAttView('DETAIL'); }} className="w-full text-left bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border flex items-center justify-between shadow-sm active:bg-gray-50 transition-colors">
                                    <div className="flex-1 pr-4"><h4 className="font-bold text-sm truncate dark:text-white">{ev.name}</h4><p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest">{new Date(ev.date).toLocaleDateString('id-ID', {weekday:'short', day:'numeric', month:'short'})}</p></div>
                                    <ChevronRight size={18} className="text-gray-300"/>
                                </button>
                            ))}
                            {activeEvents.length === 0 && (
                                <div className="py-20 text-center text-gray-400 font-black uppercase tracking-widest text-xs italic opacity-30">Tidak ada data absensi</div>
                            )}
                        </div>
                    ) : attView === 'DETAIL' ? (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setAttView('LIST')} className="p-2 bg-white dark:bg-dark-card rounded-xl shadow-sm dark:border dark:border-dark-border"><ChevronLeft size={20}/></button>
                                <h3 className="font-black text-sm uppercase truncate dark:text-white">{selectedAttEvent?.name}</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-green-50 p-2 rounded-xl border border-green-100 text-center"><p className="text-[9px] font-black text-green-600 uppercase">Hadir</p><p className="text-lg font-black">{currentEventResume?.present}</p></div>
                                <div className="bg-amber-50 p-2 rounded-xl border border-amber-100 text-center"><p className="text-[9px] font-black text-amber-600 uppercase">Telat</p><p className="text-lg font-black">{currentEventResume?.presentLate}</p></div>
                                <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 text-center"><p className="text-[9px] font-black text-indigo-600 uppercase">Izin</p><p className="text-lg font-black">{currentEventResume?.excusedLate}</p></div>
                            </div>
                            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden shadow-sm">
                                <div className="p-4 border-b dark:border-dark-border space-y-3">
                                    <div className="flex gap-2">
                                        <button onClick={handleDownloadPDF} className="flex-1 bg-indigo-600 text-white p-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Download size={14}/> PDF</button>
                                        <button onClick={() => setIsAddParticipantModalOpen(true)} className="flex-1 bg-primary-600 text-white p-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Plus size={14}/> Tambah</button>
                                    </div>
                                    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input type="text" placeholder="Cari nama..." value={attendanceSearch} onChange={e => setAttendanceSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-primary-500" /></div>
                                </div>
                                <div className="divide-y dark:divide-dark-border">
                                    {filteredAttendanceMembers.length > 0 ? filteredAttendanceMembers.map(m => {
                                        const record = (attendance || []).find(a => a.event_id === selectedAttEvent?.id && a.member_id === m.id);
                                        return (
                                            <div key={m.id} className="p-4 flex flex-col gap-3">
                                                <div className="flex justify-between items-start">
                                                    <div><p className="font-bold text-sm dark:text-white">{m.full_name}</p><p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{groups.find(g => g.id === m.group_id)?.name}</p></div>
                                                    <div className="text-right"><p className="text-[10px] font-mono font-black text-primary-600">{record?.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p></div>
                                                </div>
                                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                                    <button onClick={() => handleAttendanceChange(m.id, 'Present')} className={`p-2.5 rounded-xl border flex-shrink-0 ${record?.status === 'Present' ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-dark-border'}`}><CheckCircle2 size={18}/></button>
                                                    <button onClick={() => handleAttendanceChange(m.id, 'Present Late')} className={`p-2.5 rounded-xl border flex-shrink-0 ${record?.status === 'Present Late' ? 'bg-amber-50 text-white border-amber-500' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-dark-border'}`}><Timer size={18}/></button>
                                                    <button onClick={() => handleAttendanceChange(m.id, 'Excused')} className={`p-2.5 rounded-xl border flex-shrink-0 ${record?.status === 'Excused' ? 'bg-slate-500 text-white border-slate-500' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-dark-border'}`}><HelpCircle size={18}/></button>
                                                    <button onClick={() => handleAttendanceChange(m.id, 'Absent')} className={`p-2.5 rounded-xl border flex-shrink-0 ${record?.status === 'Absent' ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-dark-border'}`}><XCircle size={18}/></button>
                                                    <div className="w-px bg-gray-100 mx-1 flex-shrink-0"></div>
                                                    <button onClick={() => handleResetStatus(m.id)} className="p-2.5 text-gray-300 active:text-red-500"><RotateCcw size={18}/></button>
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="p-20 text-center text-gray-400 italic font-bold text-xs uppercase tracking-widest">Belum ada peserta terdaftar. <br/>Klik "Tambah" untuk memasukkan peserta.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setAttView('LIST')} className="p-2 bg-white dark:bg-dark-card rounded-xl shadow-sm"><ChevronLeft size={20}/></button>
                                <h3 className="font-black text-sm uppercase dark:text-white">Rekapitulasi Global</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {parentEvents.map(pe => (
                                    <div key={pe.id} className="bg-white dark:bg-dark-card p-5 rounded-2xl border dark:border-dark-border shadow-sm flex flex-col gap-3">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Layers size={20}/></div><h4 className="font-black text-sm uppercase dark:text-white">{pe.name}</h4></div>
                                        <p className="text-xs text-gray-500">{pe.description || 'Tidak ada deskripsi'}</p>
                                        <div className="flex justify-end pt-2"><button onClick={() => { setSelectedParentEvent(pe); showToast("Detail rekap global segera hadir", "info"); }} className="text-[10px] font-black text-primary-600 uppercase tracking-widest bg-primary-50 dark:bg-primary-900/30 px-4 py-2 rounded-lg">LIHAT RINGKASAN</button></div>
                                    </div>
                                ))}
                                {parentEvents.length === 0 && (
                                    <div className="py-20 text-center text-gray-400 font-black uppercase tracking-widest text-xs italic opacity-30">Belum ada event utama</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'PARENT_EVENTS' && (
                <div className="space-y-4">
                    <button onClick={() => { setEditingParent(null); setParentName(''); setParentDesc(''); setIsParentModalOpen(true); }} className="w-full bg-primary-600 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase shadow-lg shadow-primary-600/20 active:scale-95 transition-transform"><Plus size={18}/> Tambah Event Utama Baru</button>
                    {parentEvents.map(pe => (
                        <div key={pe.id} className="bg-white dark:bg-dark-card p-5 rounded-2xl border dark:border-dark-border shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><Layers size={24}/></div>
                                <div className="flex gap-4">
                                    <button onClick={() => { setEditingParent(pe); setParentName(pe.name); setParentDesc(pe.description || ''); setIsParentModalOpen(true); }} className="text-gray-400"><Edit size={18}/></button>
                                    <button onClick={() => setDeleteConfirm({isOpen: true, id: pe.id, mode: 'PARENT'})} className="text-gray-400"><Trash2 size={18}/></button>
                                </div>
                            </div>
                            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight mb-1">{pe.name}</h3>
                            <p className="text-xs text-gray-500 line-clamp-2">{pe.description || '-'}</p>
                            <div className="mt-4 pt-4 border-t dark:border-gray-800 flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{events.filter(e => e.parent_event_id === pe.id).length} SUB-ACARA</span></div>
                        </div>
                    ))}
                    {parentEvents.length === 0 && (
                        <div className="py-20 text-center text-gray-400 font-black uppercase tracking-widest text-xs italic opacity-30">Belum ada event utama terdaftar</div>
                    )}
                </div>
            )}
        </div>
        <div className="h-20 bg-white dark:bg-dark-card border-t dark:border-dark-border fixed bottom-0 left-0 right-0 z-40 flex items-center px-6 gap-8 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <button onClick={() => setActiveTab('AGENDA')} className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === 'AGENDA' ? 'text-primary-600' : 'text-gray-400'}`}><CalendarDays size={24}/><span className="text-[9px] font-black uppercase tracking-widest">Agenda</span></button>
            <button onClick={() => setActiveTab('ATTENDANCE')} className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === 'ATTENDANCE' ? 'text-primary-600' : 'text-gray-400'}`}><ClipboardCheck size={24}/><span className="text-[9px] font-black uppercase tracking-widest">Absensi</span></button>
            <button onClick={() => setActiveTab('PARENT_EVENTS')} className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === 'PARENT_EVENTS' ? 'text-primary-600' : 'text-gray-400'}`}><Layers size={24}/><span className="text-[9px] font-black uppercase tracking-widest">Utama</span></button>
        </div>
    </div>
  );

  const renderDesktopUI = () => (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3"><h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><CalendarDays className="text-primary-600" /> Manajemen Acara</h2><button onClick={handleManualRefresh} className="p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border text-gray-400 hover:text-primary-600 transition"><RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} /></button></div>
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl border dark:border-gray-700">
              <button onClick={() => setActiveTab('AGENDA')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'AGENDA' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500 hover:text-primary-600'}`}><CalendarDays size={14}/> Agenda</button>
              <button onClick={() => { setActiveTab('ATTENDANCE'); setAttView('LIST'); }} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'ATTENDANCE' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500 hover:text-primary-600'}`}><ClipboardCheck size={14}/> Absensi</button>
              <button onClick={() => setActiveTab('PARENT_EVENTS')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'PARENT_EVENTS' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500 hover:text-primary-600'}`}><Layers size={14}/> Event Utama</button>
          </div>
      </div>

      {activeTab === 'AGENDA' && (
          <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => handleOpenModal()} className="bg-primary-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-black shadow-lg shadow-primary-600/20 active:scale-95 transition-all uppercase tracking-widest"><Plus size={18} /> Buat Acara Baru</button></div>
              {activeEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeEvents.map(item => (
                        <div key={item.id} className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden hover:shadow-md transition flex flex-col group relative">
                          <div className={`h-1.5 w-full ${item.status === 'Upcoming' ? 'bg-blue-500' : item.status === 'Completed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <div className="p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                              <span className="px-3 py-1 rounded-lg text-[9px] bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-black uppercase tracking-widest">{item.event_type || 'Umum'}</span>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => previewWhatsAppAnnouncement(item)} className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Copy WA Announcement"><Share2 size={20}/></button>
                                  <button onClick={() => handleOpenModal(item)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Edit size={20}/></button>
                                  <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id, mode: 'EVENT'})} className="p-2 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={20}/></button>
                              </div>
                            </div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-3 line-clamp-1 uppercase tracking-tight">{item.name}</h3>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2 mb-6">
                               <div className="flex items-center gap-3"><CalendarDays size={14}/> <span className="font-bold">{new Date(item.date).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long'})}</span></div>
                               <div className="flex items-center gap-3"><Clock size={14}/> <span className="font-bold">{new Date(item.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} WIB</span></div>
                               <div className="flex items-center gap-3 text-primary-600 font-bold"><MapPin size={14}/> <span className="line-clamp-1">{item.location || 'Lokasi -'}</span></div>
                            </div>
                            <div className="mt-auto pt-4 border-t dark:border-gray-800">
                               <button onClick={() => { setSelectedAttEvent(item); setAttView('DETAIL'); setActiveTab('ATTENDANCE'); }} className="w-full text-center text-xs font-black text-primary-600 bg-primary-50 dark:bg-primary-900/20 py-2.5 rounded-xl hover:bg-primary-100 transition uppercase tracking-widest">Akses Presensi</button>
                            </div>
                          </div>
                        </div>
                    ))}
                </div>
              ) : (
                <div className="py-32 bg-white dark:bg-dark-card rounded-3xl border border-dashed border-gray-200 dark:border-dark-border text-center flex flex-col items-center gap-4 animate-in zoom-in duration-500">
                    <div className="p-8 bg-gray-50 dark:bg-gray-800 rounded-full mb-2"><CalendarDays size={64} className="text-gray-200 dark:text-gray-700"/></div>
                    <h3 className="text-xl font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest">Agenda Anda Kosong</h3>
                    <p className="text-sm text-gray-400 max-w-sm">Anda belum memiliki acara yang direncanakan. Klik tombol "Buat Acara Baru" untuk memulai.</p>
                </div>
              )}
          </div>
      )}

      {activeTab === 'ATTENDANCE' && (
          <div className="space-y-4">
               <div className="flex justify-between items-center bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setAttView('LIST')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${attView === 'LIST' || attView === 'DETAIL' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Pilih Acara</button>
                      <button onClick={() => setAttView('PARENT_RECAP')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${attView === 'PARENT_RECAP' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><BarChart3 size={14}/> Rekapitulasi Global</button>
                  </div>
                  {attView === 'DETAIL' && selectedAttEvent && (
                      <div className="flex items-center gap-3">
                          <button onClick={handleDownloadPDF} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 uppercase tracking-widest"><Download size={16}/> PDF</button>
                          <button onClick={() => setIsAddParticipantModalOpen(true)} className="bg-primary-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 uppercase tracking-widest shadow-md shadow-primary-600/20"><UserPlus size={16}/> Tambah Peserta</button>
                      </div>
                  )}
              </div>
              {attView === 'LIST' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                      {activeEvents.map(ev => (
                          <div key={ev.id} onClick={() => { setSelectedAttEvent(ev); setAttView('DETAIL'); }} className="bg-white dark:bg-dark-card p-6 rounded-3xl border dark:border-dark-border shadow-sm cursor-pointer hover:border-primary-400 transition-all group">
                              <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2 group-hover:text-primary-600">{ev.name}</h4>
                              <p className="text-xs text-gray-500 font-bold mb-4 flex items-center gap-2"><CalendarDays size={12}/> {new Date(ev.date).toLocaleDateString()}</p>
                              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detail</span><ChevronRight size={18} className="text-gray-300 group-hover:translate-x-1 transition-transform"/></div>
                          </div>
                      ))}
                      {activeEvents.length === 0 && (
                          <div className="col-span-full py-20 text-center text-gray-400 font-black uppercase tracking-widest text-xs italic opacity-30">Belum ada data absensi</div>
                      )}
                  </div>
              )}
              {attView === 'DETAIL' && selectedAttEvent && (
                  <div className="space-y-6 animate-in slide-in-from-right-10 duration-300">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 text-center shadow-sm"><p className="text-[10px] font-black text-green-600 uppercase mb-1">Hadir</p><p className="text-2xl font-black text-green-700">{currentEventResume?.present}</p></div>
                          <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 text-center shadow-sm"><p className="text-[10px] font-black text-amber-600 uppercase mb-1">Telat</p><p className="text-2xl font-black text-amber-700">{currentEventResume?.presentLate}</p></div>
                          <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 text-center shadow-sm"><p className="text-[10px] font-black text-indigo-600 uppercase mb-1">Izin Telat</p><p className="text-2xl font-black text-indigo-700">{currentEventResume?.excusedLate}</p></div>
                          <div className="bg-slate-50 dark:bg-slate-900/10 p-4 rounded-2xl border border-slate-100 text-center shadow-sm"><p className="text-[10px] font-black text-slate-500 uppercase mb-1">Izin</p><p className="text-2xl font-black text-slate-700">{currentEventResume?.excused}</p></div>
                          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 text-center shadow-sm"><p className="text-[10px] font-black text-red-600 uppercase mb-1">Alpha</p><p className="text-2xl font-black text-red-700">{currentEventResume?.absent}</p></div>
                      </div>
                      <div className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                            <div className="flex flex-col"><button onClick={() => setAttView('LIST')} className="text-primary-600 text-xs font-black flex items-center gap-1 mb-2 hover:underline w-fit uppercase tracking-widest"><ChevronLeft size={14}/> Kembali</button><h3 className="text-2xl font-black uppercase tracking-tight">{selectedAttEvent.name}</h3></div>
                            <div className="relative w-64"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input type="text" placeholder="Cari nama..." value={attendanceSearch} onChange={e => setAttendanceSearch(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500"/></div>
                        </div>
                        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b dark:border-gray-800"><tr><th className="px-6 py-5">Nama & Kelompok</th><th className="px-6 py-5 text-center">Waktu</th><th className="px-6 py-5 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-dark-border">{filteredAttendanceMembers.length > 0 ? filteredAttendanceMembers.map(m => {
                                        const record = (attendance || []).find(a => a.event_id === selectedAttEvent.id && a.member_id === m.id);
                                        const status = record?.status;
                                        return (
                                            <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"><td className="px-6 py-5"><div className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{m.full_name}</div><div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{(groups.find(g => g.id === m.group_id))?.name || 'UMUM'}</div></td><td className="px-6 py-5 text-center font-mono font-black text-primary-600">{record?.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '--:--'}</td><td className="px-6 py-5 text-right"><div className="flex justify-end gap-1.5"><button onClick={() => handleAttendanceChange(m.id, 'Present')} className={`p-2 rounded-xl border transition ${status === 'Present' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-300 border-gray-100 hover:text-green-500'}`} title="Hadir"><CheckCircle2 size={20} /></button><button onClick={() => handleAttendanceChange(m.id, 'Present Late')} className={`p-2 rounded-xl border transition ${status === 'Present Late' ? 'bg-amber-50 text-white border-amber-500 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-300 border-gray-100 hover:text-amber-500'}`} title="Telat"><Timer size={20} /></button><button onClick={() => handleAttendanceChange(m.id, 'Excused')} className={`p-2 rounded-xl border transition ${status === 'Excused' ? 'bg-slate-400 text-white border-slate-400 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-300 border-gray-100 hover:text-slate-500'}`} title="Izin"><HelpCircle size={20} /></button><button onClick={() => handleAttendanceChange(m.id, 'Absent')} className={`p-2 rounded-xl border transition ${status === 'Absent' ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-300 border-gray-100 hover:text-red-500'}`} title="Alpha"><XCircle size={20} /></button><div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2"></div><button onClick={() => handleResetStatus(m.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><RotateCcw size={16} /></button></div></td></tr>
                                        )
                                    }) : (
                                      <tr><td colSpan={3} className="px-6 py-20 text-center text-gray-400 italic font-black uppercase tracking-widest text-xs">Daftar Absensi Kosong. <br/>Klik "Tambah Peserta" untuk memasukkan data.</td></tr>
                                    )}</tbody></table></div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'PARENT_EVENTS' && (
          <div className="space-y-6">
              <div className="flex justify-end"><button onClick={() => { setEditingParent(null); setParentName(''); setParentDesc(''); setIsParentModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 flex items-center gap-3 transition-transform active:scale-95"><Plus size={20}/> Buat Event Utama Baru</button></div>
              {parentEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {parentEvents.map(pe => (
                        <div key={pe.id} className="bg-white dark:bg-dark-card p-8 rounded-[40px] border dark:border-dark-border shadow-sm hover:shadow-xl transition-all relative group">
                             <div className="flex justify-between items-start mb-6">
                                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform"><Layers size={32}/></div>
                                  <div className="flex gap-2">
                                      <button onClick={() => { setEditingParent(pe); setParentName(pe.name); setParentDesc(pe.description || ''); setIsParentModalOpen(true); }} className="text-gray-400 hover:text-blue-500"><Edit size={24}/></button>
                                      <button onClick={() => setDeleteConfirm({isOpen: true, id: pe.id, mode: 'PARENT'})} className="text-gray-400 hover:text-red-600"><Trash2 size={24}/></button>
                                  </div>
                             </div>
                             <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-tight mb-3">{pe.name}</h3>
                             <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-8">{pe.description || '-'}</p>
                             <div className="mt-auto flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">{events.filter(e => e.parent_event_id === pe.id).length} SUB-ACARA</span></div>
                        </div>
                    ))}
                </div>
              ) : (
                <div className="py-20 text-center opacity-30 font-black uppercase tracking-[0.5em] text-xs">Belum ada event utama</div>
              )}
          </div>
      )}
    </div>
  );

  return (
    <>
        {isMobileView ? renderMobileUI() : renderDesktopUI()}
        
        {/* ADD PARTICIPANT MODAL */}
        <Modal isOpen={isAddParticipantModalOpen} onClose={() => setIsAddParticipantModalOpen(false)} title="Tambah Peserta Absensi">
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                    <input 
                      type="text" 
                      placeholder="Cari anggota..." 
                      value={participantSearch} 
                      onChange={e => setParticipantSearch(e.target.value)} 
                      className="w-full pl-9 pr-4 py-2 border rounded-xl dark:bg-gray-800 dark:border-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>
                <div className="max-h-60 overflow-y-auto divide-y dark:divide-gray-800">
                    {members.filter(m => m.full_name.toLowerCase().includes(participantSearch.toLowerCase())).slice(0, 10).map(m => (
                        <div key={m.id} className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-900 transition">
                            <div>
                                <p className="text-sm font-bold dark:text-white">{m.full_name}</p>
                                <p className="text-[10px] text-gray-400 uppercase">{(groups.find(g => g.id === m.group_id))?.name || 'UMUM'}</p>
                            </div>
                            <button onClick={() => handleAddManualMember(m.id)} className="p-2 bg-primary-50 text-primary-600 rounded-lg"><Plus size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>

        {/* DELETE CONFIRMATION MODAL */}
        <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({...deleteConfirm, isOpen: false})} title="Konfirmasi Hapus">
          <div className="text-center p-6 space-y-6">
              <div className="bg-red-50 p-6 rounded-full w-fit mx-auto text-red-600"><AlertTriangle size={48}/></div>
              <p className="font-bold text-gray-700 dark:text-gray-300">
                  {deleteConfirm.mode === 'EVENT' ? 'Hapus acara ini secara permanen?' : 
                   deleteConfirm.mode === 'PARENT' ? 'Hapus Event Utama ini? Semua sub-acara juga akan terhapus.' :
                   'Keluarkan peserta ini dari daftar absensi?'}
              </p>
              <div className="flex justify-center gap-3 pt-4 border-t dark:border-gray-800">
                  <button onClick={() => setDeleteConfirm({...deleteConfirm, isOpen: false})} className="px-8 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Batal</button>
                  <button onClick={executeDelete} className="px-12 py-3 text-xs font-black text-white bg-red-600 rounded-xl shadow-lg shadow-red-600/20 active:scale-95 transition-all uppercase">YA, HAPUS</button>
              </div>
          </div>
        </Modal>

        {/* REASON MODAL (Fix Logic) */}
        <Modal isOpen={isReasonModalOpen} onClose={() => setIsReasonModalOpen(false)} title="Alasan Izin / Telat">
            <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 flex items-start gap-3">
                    <HelpCircle className="text-blue-600 mt-1" size={20}/>
                    <div className="text-xs text-blue-800 dark:text-blue-200 font-bold uppercase tracking-tight">
                        Keterangan Izin: <br/>
                        <span className="font-normal opacity-80">Masukkan alasan mengapa anggota ini izin atau telat. Alasan akan disimpan dalam catatan absensi.</span>
                    </div>
                </div>
                <textarea 
                    autoFocus 
                    value={tempReason} 
                    onChange={e => setTempReason(e.target.value)} 
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500 transition-all dark:text-white" 
                    placeholder="Contoh: Sakit, Dinas luar kota, Terjebak macet, dll..." 
                    rows={4} 
                />
                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setIsReasonModalOpen(false)} className="px-6 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest">Batal</button>
                    <button 
                        onClick={handleSaveReason} 
                        className="bg-primary-600 text-white px-8 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-primary-600/20 active:scale-95 transition-all flex items-center gap-2 uppercase tracking-widest"
                    >
                        <Save size={16}/> Simpan Alasan
                    </button>
                </div>
            </div>
        </Modal>

        {/* WHATSAPP PREVIEW MODAL */}
        <Modal isOpen={isWAPreviewOpen} onClose={() => setIsWAPreviewOpen(false)} title="Preview Pengumuman WhatsApp" size="lg">
            <div className="space-y-6">
                <div className="bg-[#E5DDD5] dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-inner overflow-hidden">
                    <div className="bg-white dark:bg-[#075E54]/30 p-5 rounded-2xl rounded-tl-none shadow-sm border dark:border-[#128C7E]/40 relative max-w-[95%]">
                        <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-white dark:border-t-slate-800 border-l-[10px] border-l-transparent"></div>
                        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200 leading-relaxed overflow-x-auto selection:bg-green-100">{waPreviewText}</pre>
                        <div className="text-[9px] text-gray-400 text-right mt-2">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ✓✓</div>
                    </div>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                    <button onClick={() => setIsWAPreviewOpen(false)} className="px-6 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest">Batal</button>
                    <button 
                        onClick={() => { navigator.clipboard.writeText(waPreviewText); showToast("Pengumuman disalin!", "success"); setIsWAPreviewOpen(false); }} 
                        className="bg-[#25D366] hover:bg-[#128C7E] text-white px-8 py-2.5 rounded-xl font-black uppercase text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Copy size={16}/> Salin Format Teks
                    </button>
                </div>
            </div>
        </Modal>

        {/* EVENT CONFIG MODAL */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Informasi Acara' : 'Konfigurasi Acara Baru'} size="3xl">
          <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-5">
                      <h4 className="text-xs font-black text-primary-600 uppercase tracking-widest flex items-center gap-2"><FileText size={16}/> Informasi Dasar</h4>
                      <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Judul Acara</label>
                          <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-2xl border-none bg-gray-50 dark:bg-gray-800 dark:text-white px-5 py-4 text-base font-black outline-none focus:ring-2 focus:ring-primary-500 transition shadow-inner" placeholder="MISAL: MUSYAWARAH PPG 2026" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Tanggal</label>
                              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-2xl border-none bg-gray-50 dark:bg-gray-800 dark:text-white px-5 py-3 text-sm font-bold outline-none" />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Waktu Mulai</label>
                              <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-2xl border-none bg-gray-50 dark:bg-gray-800 dark:text-white px-5 py-3 text-sm font-bold outline-none" />
                          </div>
                      </div>
                      
                      {/* Late Tolerance Input */}
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                          <div className="flex justify-between items-center mb-2">
                             <label className="block text-[10px] font-black text-amber-600 uppercase flex items-center gap-2"><Timer size={14}/> Toleransi Telat (Menit)</label>
                             <span className="text-[10px] font-black text-amber-500">{lateTolerance} m</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="120" 
                            step="5"
                            value={lateTolerance} 
                            onChange={e => setLateTolerance(parseInt(e.target.value))} 
                            className="w-full h-1.5 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600" 
                          />
                          <p className="text-[9px] text-amber-500 mt-2 font-bold uppercase italic">*Menentukan batas waktu scanner menandai status "Telat".</p>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Tempat / Lokasi</label>
                          <div className="relative">
                              <MapPin className="absolute left-4 top-4 text-gray-400" size={18}/>
                              <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full pl-12 pr-5 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 dark:text-white text-sm font-bold outline-none shadow-inner" placeholder="GSG Kota Batu" />
                          </div>
                      </div>
                  </div>
                  <div className="space-y-6">
                      <div className="space-y-4">
                          <div className="flex justify-between items-center"><h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><Clock size={16}/> Sesi Acara</h4><button type="button" onClick={addSession} className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors uppercase">Tambah Sesi</button></div>
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{sessions.map((session, index) => (<div key={session.id} className="flex gap-2 items-center animate-in slide-in-from-right-2"><input type="text" value={session.name} onChange={e => updateSession(index, 'name', e.target.value)} placeholder="Nama Sesi" className="flex-1 text-xs p-2 rounded-xl bg-gray-50 dark:bg-gray-800 dark:text-white border-none shadow-inner" /><input type="time" value={session.startTime} onChange={e => updateSession(index, 'startTime', e.target.value)} className="w-24 text-xs p-2 rounded-xl bg-gray-50 dark:bg-gray-800 dark:text-white border-none shadow-inner" /><button type="button" onClick={() => removeSession(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button></div>))}{sessions.length === 0 && <p className="text-[10px] text-gray-400 italic text-center py-2">Belum ada sesi tambahan.</p>}</div>
                      </div>
                      <div className="space-y-4">
                          <h4 className="text-xs font-black text-green-600 uppercase tracking-widest flex items-center gap-2"><Users size={16}/> Daftar Undangan</h4>
                          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl"><button type="button" onClick={() => setInviteType('ALL')} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${inviteType === 'ALL' ? 'bg-white dark:bg-gray-700 text-green-600' : 'text-gray-400'}`}>SELURUH</button><button type="button" onClick={() => setInviteType('SELECT')} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${inviteType === 'SELECT' ? 'bg-white dark:bg-gray-700 text-green-600' : 'text-gray-400'}`}>PILIH</button></div>
                          {inviteType === 'SELECT' && (
                              <div className="space-y-3 animate-in fade-in">
                                  <div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={14}/><input type="text" value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} placeholder="Cari anggota..." className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border-none text-xs shadow-inner outline-none dark:text-white"/></div>
                                  <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar border rounded-2xl p-2 dark:border-gray-800">{members.filter(m => m.full_name.toLowerCase().includes(inviteSearch.toLowerCase())).map(m => (<div key={m.id} onClick={() => toggleInvitee(m.id)} className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${selectedInvitees.includes(m.id) ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}><div className="flex flex-col"><span className="text-[11px] font-bold text-gray-800 dark:text-white uppercase">{m.full_name}</span><span className="text-[9px] text-gray-400 uppercase">{divisions.find(d => d.id === m.division_id)?.name || 'Unit -'}</span></div>{selectedInvitees.includes(m.id) ? <CheckCircle2 className="text-green-600" size={16}/> : <div className="w-4 h-4 border-2 border-gray-200 rounded-full"></div>}</div>))}</div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
              <div className="pt-8 flex justify-end gap-3 border-t dark:border-gray-800"><button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Batal</button><button type="submit" disabled={isSubmitting} className="px-14 py-3 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-600/20 active:scale-95 transition-all">{isSubmitting ? 'MENYIMPAN...' : 'SIMPAN ACARA'}</button></div>
          </form>
        </Modal>
    </>
  );
};