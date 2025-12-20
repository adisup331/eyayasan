import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Event, EventAttendance, Member, Foundation, EventSession, Group, ParentEvent, Division } from '../types';
import { 
  Plus, Edit, Trash2, CalendarDays, MapPin, 
  Clock, Search, AlertTriangle, MessageCircle, Copy, Check, Minimize2, Maximize2,
  ClipboardCheck, BarChart3, ChevronLeft, ChevronRight, Filter, TrendingUp, Activity, Minus, TrendingDown, Ban, CheckCircle2, HelpCircle, XCircle, RotateCcw, Timer, PlayCircle, X, List, StopCircle, Lock, UserPlus, RefreshCw, Boxes, Layers, Tag, Share2
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';

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
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'ATTENDANCE' | 'PARENT_EVENTS'>('AGENDA');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
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
  const [eventSessions, setEventSessions] = useState<EventSession[]>([{id: 'default', name: 'Kehadiran'}]);
  
  const [inviteType, setInviteType] = useState<'ALL' | 'SELECT'>('ALL');
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [inviteSearch, setInviteSearch] = useState(''); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [attView, setAttView] = useState<'LIST' | 'DETAIL' | 'PARENT_RECAP'>('LIST');
  const [selectedAttEvent, setSelectedAttEvent] = useState<Event | null>(null);
  const [selectedParentForRecap, setSelectedParentForRecap] = useState<string>('');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'Present' | 'Present Late' | 'Excused' | 'Absent' | 'Excused Late'>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>(''); 

  const [recapSearch, setRecapSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null, mode: 'EVENT' | 'PARENT'}>({ isOpen: false, id: null, mode: 'EVENT' });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
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

  const handleOpenParentModal = (item?: ParentEvent) => {
      if (item) {
          setEditingParent(item); setParentName(item.name); setParentDesc(item.description || '');
      } else {
          setEditingParent(null); setParentName(''); setParentDesc('');
      }
      setIsParentModalOpen(true);
  };

  const handleParentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = { name: parentName, description: parentDesc, foundation_id: activeFoundation?.id };
      try {
          if (editingParent) { await supabase.from('parent_events').update(payload).eq('id', editingParent.id); } 
          else { await supabase.from('parent_events').insert([payload]); }
          fetchParentEvents(); setIsParentModalOpen(false); showToast("Event Utama disimpan");
      } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleAttendanceChange = async (memberId: string, newStatus: 'Present' | 'Absent' | 'Excused' | 'Excused Late' | 'Present Late') => {
    if (!selectedAttEvent) return;
    try {
        let finalStatus = newStatus;
        const now = new Date();
        
        // Logika Toleransi Telat: Jika admin klik Hadir (Present)
        if (newStatus === 'Present') {
            const scheduledTime = new Date(selectedAttEvent.date);
            const tolerance = selectedAttEvent.late_tolerance || 15;
            const limitTime = new Date(scheduledTime.getTime() + (tolerance * 60000));
            
            // Jika jam sekarang melewati (Jam Acara + Toleransi) -> Hadir Telat
            if (now > limitTime) {
                finalStatus = 'Present Late';
            }
        }

       const updateData: any = { 
           event_id: selectedAttEvent.id, 
           member_id: memberId, 
           status: finalStatus,
           check_in_time: (finalStatus === 'Present' || finalStatus === 'Present Late') ? now.toISOString() : null
        };

       const { error } = await supabase.from('event_attendance').upsert(updateData, { onConflict: 'event_id, member_id' });
       if (error) throw error;
       
       if (finalStatus === 'Present Late' && newStatus === 'Present') {
           showToast('Dicatat sebagai Hadir Telat (Melewati batas)', 'error');
       }
       
       onRefresh(); 
    } catch (error: any) { showToast('Gagal update: ' + error.message, 'error'); }
  };

  const handleResetStatus = async (memberId: string) => {
      if (!selectedAttEvent) return;
      try {
          const { error } = await supabase.from('event_attendance').delete().match({ event_id: selectedAttEvent.id, member_id: memberId });
          if (error) throw error;
          onRefresh();
      } catch (error: any) { showToast('Gagal reset: ' + error.message, 'error'); }
  };

  const handleShareRecapWA = () => {
    if (!selectedAttEvent || !currentEventResume) return;
    const dateStr = new Date(selectedAttEvent.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    let text = `*RESUME ABSENSI ACARA*\n*Agenda:* ${selectedAttEvent.name}\n*Waktu:* ${dateStr}\n--------------------------------\n✅ *Hadir (Tepat):* ${currentEventResume.present} orang\n⏰ *Hadir Telat:* ${currentEventResume.presentLate} orang\n🙏 *Izin Telat:* ${currentEventResume.excusedLate} orang\n🙏 *Izin / Sakit:* ${currentEventResume.excused} orang\n❌ *Alpha / Belum:* ${currentEventResume.absent} orang\n--------------------------------\n*Total Peserta:* ${currentEventResume.total} orang\n\n_Dikirim otomatis via E-Yayasan CMS_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleChatMember = (phone?: string, name?: string) => {
      if (!phone) { showToast("Anggota tidak punya nomor WA", "error"); return; }
      const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
      const text = `Assalamu'alaikum wr wb, saudara/i *${name}*. Mengingatkan kehadiran untuk acara *${selectedAttEvent?.name}*. Syukron katsiron.`;
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const parentRecapData = useMemo(() => {
      if (!selectedParentForRecap) return [];
      const relatedEvents = events.filter(e => e.parent_event_id === selectedParentForRecap && e.status !== 'Cancelled');
      const totalSessions = relatedEvents.length;
      if (totalSessions === 0) return [];
      const eventIds = relatedEvents.map(e => e.id);
      return members.map(member => {
          const myAttendance = attendance.filter(a => a.member_id === member.id && eventIds.includes(a.event_id));
          const presentCount = myAttendance.filter(a => a.status === 'Present' || a.status === 'Present Late' || a.status === 'Excused Late').length;
          const presentLateCount = myAttendance.filter(a => a.status === 'Present Late').length;
          const excusedLateCount = myAttendance.filter(a => a.status === 'Excused Late').length;
          const excuseCount = myAttendance.filter(a => a.status === 'Excused').length;
          const absentCount = myAttendance.filter(a => a.status === 'Absent').length;
          const percentage = Math.round((presentCount / totalSessions) * 100);
          return { ...member, attendanceCount: presentCount, presentLateCount, excusedLateCount, excuseCount, absentCount, totalSessions, percentage };
      }).filter(m => m.full_name.toLowerCase().includes(recapSearch.toLowerCase()))
        .sort((a, b) => b.percentage - a.percentage);
  }, [selectedParentForRecap, events, attendance, members, recapSearch]);

  const summaryGrafirData = useMemo(() => {
      if (parentRecapData.length === 0) return [];
      const totalHadir = parentRecapData.reduce((acc, curr) => acc + (curr.attendanceCount - curr.presentLateCount - curr.excusedLateCount), 0);
      const totalHadirTelat = parentRecapData.reduce((acc, curr) => acc + curr.presentLateCount, 0);
      const totalIzinTelat = parentRecapData.reduce((acc, curr) => acc + curr.excusedLateCount, 0);
      const totalIzin = parentRecapData.reduce((acc, curr) => acc + curr.excuseCount, 0);
      const totalAlpha = parentRecapData.reduce((acc, curr) => acc + curr.absentCount, 0);
      return [
          { name: 'Tepat Waktu', value: totalHadir, color: '#10b981' },
          { name: 'Hadir Telat', value: totalHadirTelat, color: '#f59e0b' },
          { name: 'Izin Telat', value: totalIzinTelat, color: '#6366f1' },
          { name: 'Izin / Sakit', value: totalIzin, color: '#94a3b8' },
          { name: 'Tanpa Ket', value: totalAlpha, color: '#ef4444' }
      ].filter(d => d.value > 0);
  }, [parentRecapData]);

  const currentEventResume = useMemo(() => {
    if (!selectedAttEvent) return null;
    const eventAtt = attendance.filter(a => a.event_id === selectedAttEvent.id);
    const present = eventAtt.filter(a => a.status === 'Present').length;
    const presentLate = eventAtt.filter(a => a.status === 'Present Late').length;
    const excusedLate = eventAtt.filter(a => a.status === 'Excused Late').length;
    const excused = eventAtt.filter(a => a.status === 'Excused').length;
    const absent = eventAtt.filter(a => a.status === 'Absent').length;
    const total = members.filter(m => attendance.some(a => a.event_id === selectedAttEvent.id && a.member_id === m.id)).length || eventAtt.length;
    return { present, presentLate, excusedLate, excused, absent, total };
  }, [selectedAttEvent, attendance, members]);

  const getAttendanceStats = (eventId: string) => {
    const eventAtt = attendance.filter(a => a.event_id === eventId);
    const presentTotal = eventAtt.filter(a => a.status === 'Present' || a.status === 'Present Late' || a.status === 'Excused Late').length;
    return { presentTotal, total: eventAtt.length };
  };

  const handleOpenModal = (event?: Event) => {
    if (event) {
      setEditingItem(event); setName(event.name);
      const dt = new Date(event.date); setDate(dt.toISOString().split('T')[0]);
      setTime(`${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`);
      setLocation(event.location || ''); setDescription(event.description || ''); setEventType(event.event_type || 'Pengajian');
      setParentEventId(event.parent_event_id || ''); setStatus(event.status); setLateTolerance(event.late_tolerance || 15);
      setEventSessions(event.sessions && event.sessions.length > 0 ? event.sessions : [{id: 'default', name: 'Kehadiran', startTime: '', endTime: ''}]);
      setSelectedInvitees(attendance.filter(a => a.event_id === event.id).map(a => a.member_id)); setInviteType('SELECT'); setInviteSearch('');
    } else {
      setEditingItem(null); setName(''); setDate(new Date().toISOString().split('T')[0]); setTime('09:00');
      setLocation(''); setDescription(''); setEventType('Pengajian'); setParentEventId(''); setStatus('Upcoming'); setLateTolerance(15);
      setEventSessions([{id: 'default', name: 'Absen Masuk', startTime: '09:00', endTime: '12:00'}]);
      setInviteType('ALL'); setSelectedInvitees([]); setInviteSearch('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    const fullDate = new Date(`${date}T${time}:00`);
    const payload: any = { name, date: fullDate.toISOString(), location, description, status, late_tolerance: lateTolerance, event_type: eventType, parent_event_id: parentEventId || null, sessions: eventSessions };
    if (!editingItem && activeFoundation) payload.foundation_id = activeFoundation.id;
    try {
      let eventId = editingItem?.id;
      if (editingItem) { await supabase.from('events').update(payload).eq('id', editingItem.id); } 
      else { const { data: newEv } = await supabase.from('events').insert([payload]).select().single(); eventId = newEv.id; }
      const targetMemberIds = inviteType === 'ALL' ? members.map(m => m.id) : selectedInvitees;
      if (eventId && targetMemberIds.length > 0) {
          const currentRecords = attendance.filter(a => a.event_id === eventId).map(a => a.member_id);
          const toAdd = targetMemberIds.filter(id => !currentRecords.includes(id)).map(mid => ({ event_id: eventId, member_id: mid, status: 'Absent' }));
          if (toAdd.length > 0) await supabase.from('event_attendance').insert(toAdd);
      }
      onRefresh(); setIsModalOpen(false); showToast("Acara disimpan");
    } catch (error: any) { showToast(error.message, 'error'); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      if (deleteConfirm.mode === 'EVENT') await supabase.from('events').delete().eq('id', deleteConfirm.id);
      else await supabase.from('parent_events').delete().eq('id', deleteConfirm.id);
      onRefresh(); fetchParentEvents(); setDeleteConfirm({ isOpen: false, id: null, mode: 'EVENT' });
    } catch (error: any) { showToast(error.message, 'error'); }
  };

  const filteredAttendanceMembers = useMemo(() => {
    if (!selectedAttEvent) return [];
    return members.filter(m => attendance.some(a => a.event_id === selectedAttEvent?.id && a.member_id === m.id))
      .filter(m => m.full_name.toLowerCase().includes(attendanceSearch.toLowerCase()))
      .filter(m => !selectedGroupFilter || m.group_id === selectedGroupFilter) 
      .filter(m => {
          if (attendanceStatusFilter === 'ALL') return true;
          const record = attendance.find(a => a.event_id === selectedAttEvent?.id && a.member_id === m.id);
          const currentStatus = record?.status;
          return currentStatus === attendanceStatusFilter;
      });
  }, [members, attendance, selectedAttEvent, attendanceSearch, attendanceStatusFilter, selectedGroupFilter]);

  const filteredCandidates = useMemo(() => {
    if (inviteType !== 'SELECT') return [];
    return members.filter(m => m.full_name.toLowerCase().includes(inviteSearch.toLowerCase()));
  }, [members, inviteType, inviteSearch]);

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="text-sm font-medium">{toast.message}</span>
          </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <CalendarDays className="text-primary-600" /> Manajemen Acara
              </h2>
              <button onClick={handleManualRefresh} className="p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border text-gray-400 hover:text-primary-600 transition" title="Refresh">
                  <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
          </div>
          
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button onClick={() => setActiveTab('AGENDA')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'AGENDA' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500'}`}><CalendarDays size={14}/> Agenda</button>
              <button onClick={() => setActiveTab('ATTENDANCE')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'ATTENDANCE' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500'}`}><ClipboardCheck size={14}/> Absensi</button>
              <button onClick={() => setActiveTab('PARENT_EVENTS')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'PARENT_EVENTS' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500'}`}><Layers size={14}/> Event Utama</button>
          </div>
      </div>

      {activeTab === 'AGENDA' && (
          <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => handleOpenModal()} className="bg-primary-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-primary-600/20"><Plus size={18} /> Buat Acara</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map(item => {
                    const stats = getAttendanceStats(item.id);
                    const parent = parentEvents.find(p => p.id === item.parent_event_id);
                    return (
                      <div key={item.id} className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden hover:shadow-md transition flex flex-col group">
                        <div className={`h-1.5 w-full ${item.status === 'Upcoming' ? 'bg-blue-500' : item.status === 'Completed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div className="p-5 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-wrap gap-1">
                                <span className="px-2 py-0.5 rounded text-[9px] bg-purple-100 text-purple-700 font-black uppercase tracking-wider">{item.event_type || 'Umum'}</span>
                                {parent && <span className="px-2 py-0.5 rounded text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-black uppercase tracking-wider flex items-center gap-1"><Tag size={8}/> {parent.name}</span>}
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(item)} className="text-gray-400 hover:text-blue-600"><Edit size={16}/></button>
                                <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id, mode: 'EVENT'})} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </div>
                          </div>
                          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{item.name}</h3>
                          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 mb-4">
                             <div className="flex items-center gap-2"><CalendarDays size={12}/> <span>{new Date(item.date).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'short'})}</span></div>
                             <div className="flex items-center gap-2"><Clock size={12}/> <span>{new Date(item.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit', hour12: false})} WIB</span></div>
                          </div>
                          <div className="mt-auto pt-4 border-t dark:border-gray-800 flex justify-between items-center">
                             <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{stats.presentTotal} / {stats.total} HADIR</div>
                             <button onClick={() => { setSelectedAttEvent(item); setAttView('DETAIL'); setActiveTab('ATTENDANCE'); }} className="text-xs font-black text-primary-600 bg-primary-50 px-3 py-1 rounded-lg">ABSENSI</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
          </div>
      )}

      {activeTab === 'PARENT_EVENTS' && (
          <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => handleOpenParentModal()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-indigo-600/20"><Plus size={18} /> Buat Event Utama</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {parentEvents.map(p => (
                      <div key={p.id} className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col group">
                          <div className="flex justify-between items-start mb-4">
                              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Layers size={24}/></div>
                              <div className="flex gap-2">
                                  <button onClick={() => handleOpenParentModal(p)} className="text-gray-400 hover:text-blue-600"><Edit size={18}/></button>
                                  <button onClick={() => setDeleteConfirm({isOpen: true, id: p.id, mode: 'PARENT'})} className="text-gray-400 hover:text-red-600"><Trash2 size={18}/></button>
                              </div>
                          </div>
                          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1 uppercase tracking-tight">{p.name}</h3>
                          <p className="text-sm text-gray-500 mb-4 flex-1">{p.description || 'Tidak ada deskripsi.'}</p>
                          <div className="pt-4 border-t dark:border-gray-800 flex justify-between items-center">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{events.filter(e => e.parent_event_id === p.id).length} TOTAL SESI</span>
                              <button onClick={() => { setSelectedParentForRecap(p.id); setAttView('PARENT_RECAP'); setActiveTab('ATTENDANCE'); }} className="text-xs font-bold text-gray-500 hover:text-indigo-600 flex items-center gap-1">REKAP FREKUENSI <ChevronRight size={14}/></button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'ATTENDANCE' && (
          <div className="space-y-4">
               <div className="flex justify-between items-center bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setAttView('LIST')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${attView === 'LIST' || attView === 'DETAIL' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>Pilih Acara</button>
                      <button onClick={() => setAttView('PARENT_RECAP')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${attView === 'PARENT_RECAP' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>Rekap Frekuensi</button>
                  </div>
              </div>

              {attView === 'LIST' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {events.map(e => (
                          <div key={e.id} onClick={() => { setSelectedAttEvent(e); setAttView('DETAIL'); }} className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-primary-600 border-opacity-50 cursor-pointer transition hover:border-primary-500 shadow-sm">
                              <p className="text-[10px] font-bold text-gray-400 mb-1">{new Date(e.date).toLocaleDateString()}</p>
                              <h4 className="text-sm font-bold dark:text-white line-clamp-1">{e.name}</h4>
                          </div>
                      ))}
                  </div>
              )}

              {attView === 'PARENT_RECAP' && (
                  <div className="space-y-6 animate-in fade-in">
                      {selectedParentForRecap && summaryGrafirData.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm col-span-1">
                                  <h4 className="text-sm font-black uppercase mb-4">Proporsi Kehadiran</h4>
                                  <div className="h-48">
                                      <ResponsiveContainer width="100%" height="100%">
                                          <RePieChart>
                                              <Pie data={summaryGrafirData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                                                  {summaryGrafirData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                              </Pie>
                                              <ReTooltip />
                                          </RePieChart>
                                      </ResponsiveContainer>
                                  </div>
                              </div>
                              <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border shadow-sm col-span-2 flex flex-col">
                                  <h4 className="text-sm font-black uppercase mb-4">Performa Kedisiplinan</h4>
                                  <div className="flex-1 flex items-center justify-around text-center">
                                      <div><p className="text-[10px] font-bold text-gray-400 uppercase">Tepat Waktu</p><p className="text-3xl font-black text-green-600">{summaryGrafirData.find(d => d.name === 'Tepat Waktu')?.value || 0}</p></div>
                                      <div className="w-px h-10 bg-gray-100 dark:bg-gray-800"></div>
                                      <div><p className="text-[10px] font-bold text-gray-400 uppercase">Hadir Telat</p><p className="text-3xl font-black text-amber-500">{summaryGrafirData.find(d => d.name === 'Hadir Telat')?.value || 0}</p></div>
                                      <div className="w-px h-10 bg-gray-100 dark:bg-gray-800"></div>
                                      <div><p className="text-[10px] font-bold text-gray-400 uppercase">Absen/Alpha</p><p className="text-3xl font-black text-red-500">{summaryGrafirData.find(d => d.name === 'Tanpa Ket')?.value || 0}</p></div>
                                  </div>
                              </div>
                          </div>
                      )}

                      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                          <div className="p-6 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
                              <div><h3 className="text-xl font-black uppercase tracking-tight">Tabel Rekapitulasi</h3></div>
                              <div className="flex gap-3 w-full md:w-auto">
                                  <select value={selectedParentForRecap} onChange={(e) => setSelectedParentForRecap(e.target.value)} className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500"><option value="">-- Pilih Event Utama --</option>{parentEvents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                  <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 text-gray-400" size={16}/><input type="text" placeholder="Cari anggota..." value={recapSearch} onChange={e => setRecapSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl text-sm outline-none"/></div>
                              </div>
                          </div>
                          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b dark:border-gray-800"><tr><th className="px-6 py-4">Anggota</th><th className="px-6 py-4 text-center">Tepat</th><th className="px-6 py-4 text-center">Telat (H/I)</th><th className="px-6 py-4 text-center">Total</th><th className="px-6 py-4">Skor</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-dark-border">{parentRecapData.map(m => (<tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"><td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{m.full_name}<p className="text-[10px] text-gray-500 font-normal uppercase">{divisions.find(d => d.id === m.division_id)?.name || '-'}</p></td><td className="px-6 py-4 text-center font-bold text-green-600">{m.attendanceCount - m.presentLateCount - m.excusedLateCount}</td><td className="px-6 py-4 text-center font-bold text-amber-600">{m.presentLateCount} / {m.excusedLateCount}</td><td className="px-6 py-4 text-center font-black text-primary-600">{m.attendanceCount} / {m.totalSessions}</td><td className="px-6 py-4 w-48"><div className="flex items-center gap-3"><div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-primary-500" style={{ width: `${m.percentage}%` }}></div></div><span className="text-xs font-black">{m.percentage}%</span></div></td></tr>))}</tbody></table></div>
                      </div>
                  </div>
              )}

              {attView === 'DETAIL' && selectedAttEvent && (
                  <div className="space-y-4 animate-in slide-in-from-right-10 duration-300">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                          <div className="bg-white dark:bg-dark-card p-3 rounded-2xl border border-gray-100 dark:border-dark-border text-center"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p><p className="text-xl font-black">{currentEventResume?.total}</p></div>
                          <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-2xl border border-green-100 text-center"><p className="text-[10px] font-black text-green-600 uppercase mb-1">Tepat</p><p className="text-xl font-black text-green-700">{currentEventResume?.present}</p></div>
                          <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-2xl border border-amber-100 text-center"><p className="text-[10px] font-black text-amber-600 uppercase mb-1">H. Telat</p><p className="text-xl font-black text-amber-700">{currentEventResume?.presentLate}</p></div>
                          <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-2xl border border-indigo-100 text-center"><p className="text-[10px] font-black text-indigo-600 uppercase mb-1">I. Telat</p><p className="text-xl font-black text-indigo-700">{currentEventResume?.excusedLate}</p></div>
                          <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-2xl border border-yellow-100 text-center"><p className="text-[10px] font-black text-yellow-600 uppercase mb-1">Izin</p><p className="text-xl font-black text-yellow-700">{currentEventResume?.excused}</p></div>
                          <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100 text-center"><p className="text-[10px] font-black text-red-600 uppercase mb-1">Alpha</p><p className="text-xl font-black text-red-700">{currentEventResume?.absent}</p></div>
                      </div>

                      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                            <div className="flex flex-col"><button onClick={() => setAttView('LIST')} className="text-primary-600 text-xs font-bold flex items-center gap-1 mb-2 hover:underline w-fit"><ChevronLeft size={14}/> Kembali</button><h3 className="text-xl font-black uppercase tracking-tight">{selectedAttEvent.name}</h3><p className="text-xs text-gray-500 flex items-center gap-2 mt-1"><CalendarDays size={14}/> {new Date(selectedAttEvent.date).toLocaleDateString('id-ID', {weekday: 'long', day:'numeric', month:'long'})}</p></div>
                            <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                                <button onClick={handleShareRecapWA} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-md shadow-green-600/20"><Share2 size={14}/> Kirim Rekap WA</button>
                                <select className="bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold rounded-lg px-3 py-2 outline-none dark:text-white" value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)}><option value="">Semua Kelompok</option>{groups.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}</select>
                                <select className="bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold rounded-lg px-3 py-2 outline-none dark:text-white" value={attendanceStatusFilter} onChange={(e) => setAttendanceStatusFilter(e.target.value as any)}><option value="ALL">Semua Status</option><option value="Present">Tepat Waktu</option><option value="Present Late">Hadir Telat</option><option value="Excused Late">Izin Telat</option><option value="Excused">Izin</option><option value="Absent">Alpha</option></select>
                                <div className="relative flex-1 xl:w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="Cari nama..." value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white outline-none"/></div>
                            </div>
                        </div>
                        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b dark:border-gray-800"><tr><th className="px-6 py-4">Anggota</th><th className="px-6 py-4">Kelompok / Bidang</th><th className="px-6 py-4 text-right">Tandai & Hubungi</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-dark-border">{filteredAttendanceMembers.map(m => {
                                        const record = attendance.find(a => a.event_id === selectedAttEvent.id && a.member_id === m.id);
                                        const status = record?.status;
                                        return (
                                            <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"><td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{m.full_name}</td><td className="px-6 py-4 text-xs">{(groups.find(g => g.id === m.group_id))?.name || '-'} / {(divisions.find(d => d.id === m.division_id))?.name || '-'}</td><td className="px-6 py-4 text-right"><div className="flex justify-end items-center gap-1">
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Present')} className={`p-1.5 rounded-lg transition ${status === 'Present' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-green-600'}`} title="Hadir Tepat"><CheckCircle2 size={16} /></button>
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Present Late')} className={`p-1.5 rounded-lg transition ${status === 'Present Late' ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-amber-500'}`} title="Hadir Telat"><Timer size={16} /></button>
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Excused Late')} className={`p-1.5 rounded-lg transition ${status === 'Excused Late' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-indigo-600'}`} title="Izin Telat"><MessageCircle size={16} /></button>
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Excused')} className={`p-1.5 rounded-lg transition ${status === 'Excused' ? 'bg-slate-400 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-slate-600'}`} title="Izin / Sakit"><HelpCircle size={16} /></button>
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Absent')} className={`p-1.5 rounded-lg transition ${status === 'Absent' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-red-600'}`} title="Tanpa Keterangan / Alpha"><XCircle size={16} /></button>
                                                        <button onClick={() => handleChatMember(m.phone, m.full_name)} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition" title="WhatsApp"><MessageCircle size={16} /></button>
                                                        {status && <button onClick={() => handleResetStatus(m.id)} className="ml-1 p-1 text-gray-300 hover:text-red-400" title="Hapus Status"><RotateCcw size={12} /></button>}
                                                    </div></td></tr>
                                        )
                                    })}</tbody></table></div>
                      </div>
                  </div>
              )}
          </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Acara' : 'Buat Acara Baru'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs font-black text-gray-500 uppercase mb-1">Nama Acara</label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-sm focus:ring-1 focus:ring-primary-500 outline-none" placeholder="Misal: Rapat Koordinasi Tahfidz" /></div>
                <div className="col-span-2"><label className="block text-xs font-black text-gray-500 uppercase mb-1">Event Utama (Opsional)</label><select value={parentEventId} onChange={e => setParentEventId(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-900 dark:text-indigo-200 px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-indigo-500 outline-none"><option value="">-- Tidak Berulang --</option>{parentEvents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm outline-none" /></div>
                <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Waktu (24 Jam)</label><input type="time" required lang="id-ID" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm outline-none" /></div>
                
                <div className="col-span-2 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <label className="block text-xs font-black text-blue-700 dark:text-blue-400 uppercase mb-1">Toleransi Telat (Menit)</label>
                    <div className="flex items-center gap-3">
                        <input type="number" required value={lateTolerance} onChange={e => setLateTolerance(Number(e.target.value))} className="w-24 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500" />
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-tight">*Jika melewati {lateTolerance} menit dari jam mulai, status "Hadir" akan otomatis menjadi "Hadir Telat".</p>
                    </div>
                </div>

                <div className="col-span-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-3"><label className="text-xs font-black text-gray-500 uppercase">Sesi & Waktu (24 Jam)</label><button type="button" onClick={() => setEventSessions([...eventSessions, { id: Date.now().toString(), name: `Sesi ${eventSessions.length + 1}`, startTime: time, endTime: '' }])} className="text-[10px] bg-primary-600 text-white px-2 py-1 rounded font-bold">+ TAMBAH SESI</button></div>
                    <div className="space-y-3">{eventSessions.map((s, idx) => (
                        <div key={s.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
                            <input type="text" value={s.name} placeholder="Nama Sesi" onChange={(e) => { const next = [...eventSessions]; next[idx].name = e.target.value; setEventSessions(next); }} className="w-full bg-transparent border-none text-xs font-black outline-none dark:text-white" />
                            <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
                                <div className="flex-1"><label>MULAI (24H)</label><input type="time" lang="id-ID" value={s.startTime || ''} onChange={(e) => { const next = [...eventSessions]; next[idx].startTime = e.target.value; setEventSessions(next); }} className="w-full bg-gray-50 dark:bg-gray-900 rounded p-1 text-xs dark:text-white" /></div>
                                <div className="flex-1"><label>SELESAI (24H)</label><input type="time" lang="id-ID" value={s.endTime || ''} onChange={(e) => { const next = [...eventSessions]; next[idx].endTime = e.target.value; setEventSessions(next); }} className="w-full bg-gray-50 dark:bg-gray-900 rounded p-1 text-xs dark:text-white" /></div>
                            </div>
                        </div>
                    ))}</div>
                </div>

                <div className="col-span-2"><label className="block text-xs font-black text-gray-500 uppercase mb-1">Undangan</label><div className="flex gap-2 mb-3">{['ALL', 'SELECT'].map((type) => (<button key={type} type="button" onClick={() => setInviteType(type as any)} className={`flex-1 py-2 rounded-lg text-[10px] font-black border border-gray-200 transition ${inviteType === type ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>{type === 'ALL' ? 'SEMUA' : 'PILIH'}</button>))}</div>
                    {inviteType === 'SELECT' && (
                         <div className="space-y-3 animate-in fade-in">
                             <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="Cari nama..." value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500" /></div>
                             <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50 dark:bg-gray-900 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {filteredCandidates.map(m => (
                                    <label key={m.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 text-[10px] font-bold cursor-pointer hover:border-primary-300">
                                        <input type="checkbox" checked={selectedInvitees.includes(m.id)} onChange={() => setSelectedInvitees(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])} className="rounded text-primary-600"/>
                                        <span className="truncate">{m.full_name}</span>
                                    </label>
                                 ))}
                             </div>
                         </div>
                    )}
                </div>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t dark:border-gray-800"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sm font-bold text-gray-500">BATAL</button><button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-primary-600 text-white rounded-xl font-black active:scale-95 transition">{isSubmitting ? 'MEMPROSES...' : 'SIMPAN'}</button></div>
        </form>
      </Modal>

      <Modal isOpen={isParentModalOpen} onClose={() => setIsParentModalOpen(false)} title={editingParent ? 'Edit Event Utama' : 'Tambah Event Utama'}>
          <form onSubmit={handleParentSubmit} className="space-y-4">
              <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Nama Rangkaian Acara</label><input type="text" required value={parentName} onChange={e => setParentName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-bold outline-none" placeholder="Misal: Pengajian Ahad Pagi" /></div>
              <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Keterangan</label><textarea value={parentDesc} onChange={e => setParentDesc(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm outline-none" placeholder="Deskripsi..." /></div>
              <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={() => setIsParentModalOpen(false)} className="px-4 py-2 font-bold text-gray-400">BATAL</button><button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-black shadow-lg">SIMPAN</button></div>
          </form>
      </Modal>

      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null, mode: 'EVENT'})} title="Konfirmasi Hapus">
          <div className="text-center space-y-4">
              <div className="bg-red-50 p-4 rounded-full w-fit mx-auto text-red-500"><AlertTriangle size={48}/></div>
              <p className="font-bold">Hapus data ini? <br/> <span className="text-xs text-gray-500 font-normal">Data absensi terkait mungkin ikut terhapus.</span></p>
              <div className="flex justify-center gap-3 pt-4"><button onClick={() => setDeleteConfirm({isOpen: false, id: null, mode: 'EVENT'})} className="px-6 py-2 font-bold text-gray-400">BATAL</button><button onClick={handleDelete} className="px-8 py-2 bg-red-600 text-white rounded-xl font-bold">YA, HAPUS</button></div>
          </div>
      </Modal>
    </div>
  );
};