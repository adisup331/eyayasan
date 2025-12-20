import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Event, EventAttendance, Member, Foundation, EventSession, Group, ParentEvent } from '../types';
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
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

export const Events: React.FC<EventsProps> = ({ events, members, attendance, groups, onRefresh, activeFoundation, isSuperAdmin }) => {
  // --- TABS STATE ---
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'ATTENDANCE' | 'PARENT_EVENTS'>('AGENDA');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // --- PARENT EVENTS STATE ---
  const [parentEvents, setParentEvents] = useState<ParentEvent[]>([]);
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<ParentEvent | null>(null);
  const [parentName, setParentName] = useState('');
  const [parentDesc, setParentDesc] = useState('');

  // --- AGENDA STATE ---
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
  
  // Participant Selection State
  const [inviteType, setInviteType] = useState<'ALL' | 'SELECT' | 'GENERUS' | 'LIMA_UNSUR'>('ALL');
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [inviteSearch, setInviteSearch] = useState(''); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- ATTENDANCE STATE ---
  const [attView, setAttView] = useState<'LIST' | 'DETAIL' | 'RECAP' | 'PARENT_RECAP'>('LIST');
  const [selectedAttEvent, setSelectedAttEvent] = useState<Event | null>(null);
  const [selectedParentForRecap, setSelectedParentForRecap] = useState<string>('');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'Present' | 'Excused' | 'Absent' | 'Unrecorded' | 'Excused Late'>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>(''); 
  const [showUninvited, setShowUninvited] = useState(false);

  // Recap State
  const [recapSearch, setRecapSearch] = useState('');

  // --- DELETE CONFIRM ---
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null, mode: 'EVENT' | 'PARENT'}>({ isOpen: false, id: null, mode: 'EVENT' });

  // --- TOAST ---
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  // --- FETCH PARENT EVENTS ---
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
      await Promise.all([
          onRefresh(),
          fetchParentEvents()
      ]);
      setTimeout(() => {
          setIsRefreshing(false);
          showToast("Data diperbarui");
      }, 500);
  };

  // --- PARENT EVENT CRUD ---
  const handleOpenParentModal = (item?: ParentEvent) => {
      if (item) {
          setEditingParent(item);
          setParentName(item.name);
          setParentDesc(item.description || '');
      } else {
          setEditingParent(null);
          setParentName('');
          setParentDesc('');
      }
      setIsParentModalOpen(true);
  };

  const handleParentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = { name: parentName, description: parentDesc, foundation_id: activeFoundation?.id };
      try {
          if (editingParent) {
              await supabase.from('parent_events').update(payload).eq('id', editingParent.id);
          } else {
              await supabase.from('parent_events').insert([payload]);
          }
          fetchParentEvents();
          setIsParentModalOpen(false);
          showToast("Event Utama disimpan");
      } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleParentDelete = async (id: string) => {
      try {
          await supabase.from('parent_events').delete().eq('id', id);
          fetchParentEvents();
          showToast("Event Utama dihapus");
      } catch (err: any) { showToast(err.message, 'error'); }
  };

  // --- AGENDA LOGIC ---
  const sortedEvents = useMemo(() => {
      return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events]);

  const activeEvents = useMemo(() => {
      return [...events].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events]);

  // --- ABSENSI MANUAL ACTIONS ---
  const handleAttendanceChange = async (memberId: string, newStatus: 'Present' | 'Absent' | 'Excused' | 'Excused Late') => {
    if (!selectedAttEvent) return;
    try {
       const updateData: any = { 
            event_id: selectedAttEvent.id, 
            member_id: memberId, 
            status: newStatus,
        };
        if (newStatus === 'Present' || newStatus === 'Excused Late') {
            updateData.check_in_time = new Date().toISOString();
        }
       const { error } = await supabase.from('event_attendance').upsert(updateData, { onConflict: 'event_id, member_id' });
       if (error) throw error;
       onRefresh(); 
    } catch (error: any) {
        showToast('Gagal update: ' + error.message, 'error');
    }
  };

  const handleResetStatus = async (memberId: string) => {
      if (!selectedAttEvent) return;
      try {
          const { error } = await supabase.from('event_attendance').delete().match({ event_id: selectedAttEvent.id, member_id: memberId });
          if (error) throw error;
          onRefresh();
      } catch (error: any) {
          showToast('Gagal reset: ' + error.message, 'error');
      }
  };

  // --- WHATSAPP INTEGRATION ---
  const handleShareRecapWA = () => {
    if (!selectedAttEvent || !currentEventResume) return;
    
    const eventName = selectedAttEvent.name;
    const dateStr = new Date(selectedAttEvent.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    
    let text = `*RESUME ABSENSI ACARA*\n`;
    text += `*Agenda:* ${eventName}\n`;
    text += `*Waktu:* ${dateStr}\n`;
    text += `--------------------------------\n`;
    text += `✅ *Hadir (Tepat):* ${currentEventResume.present} orang\n`;
    text += `⏰ *Izin Telat:* ${currentEventResume.late} orang\n`;
    text += `🙏 *Izin / Sakit:* ${currentEventResume.excused} orang\n`;
    text += `❌ *Alpha / Belum:* ${currentEventResume.absent} orang\n`;
    text += `--------------------------------\n`;
    text += `*Total Peserta:* ${currentEventResume.total} orang\n\n`;
    text += `_Dikirim otomatis via E-Yayasan CMS_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleChatMember = (phone?: string, name?: string) => {
      if (!phone) { showToast("Anggota tidak punya nomor WA", "error"); return; }
      const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
      const text = `Assalamu'alaikum wr wb, saudara/i *${name}*. Mengingatkan kehadiran untuk acara *${selectedAttEvent?.name}*. Syukron katsiron.`;
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- RECAP FREKUENSI LOGIC & CHART DATA ---
  const parentRecapData = useMemo(() => {
      if (!selectedParentForRecap) return [];
      
      // Ambil semua acara untuk parent ini (termasuk Upcoming untuk melihat rekap progres)
      const relatedEvents = events.filter(e => e.parent_event_id === selectedParentForRecap && e.status !== 'Cancelled');
      const totalSessions = relatedEvents.length;
      if (totalSessions === 0) return [];

      const eventIds = relatedEvents.map(e => e.id);
      
      return members.map(member => {
          const myAttendance = attendance.filter(a => a.member_id === member.id && eventIds.includes(a.event_id));
          const presentCount = myAttendance.filter(a => a.status === 'Present' || a.status === 'Excused Late').length;
          const lateCount = myAttendance.filter(a => a.status === 'Excused Late').length;
          const excuseCount = myAttendance.filter(a => a.status === 'Excused').length;
          const absentCount = myAttendance.filter(a => a.status === 'Absent').length;
          
          const percentage = Math.round((presentCount / totalSessions) * 100);

          return {
              ...member,
              attendanceCount: presentCount,
              lateCount,
              excuseCount,
              absentCount,
              totalSessions,
              percentage
          };
      }).filter(m => m.attendanceCount > 0 || m.full_name.toLowerCase().includes(recapSearch.toLowerCase()))
        .filter(m => m.full_name.toLowerCase().includes(recapSearch.toLowerCase()))
        .sort((a, b) => b.percentage - a.percentage);
  }, [selectedParentForRecap, events, attendance, members, recapSearch]);

  // Data Grafik (Grafir) untuk Rekap Frekuensi
  const summaryGrafirData = useMemo(() => {
      if (parentRecapData.length === 0) return [];
      
      const totalHadir = parentRecapData.reduce((acc, curr) => acc + (curr.attendanceCount - curr.lateCount), 0);
      const totalTelat = parentRecapData.reduce((acc, curr) => acc + curr.lateCount, 0);
      const totalIzin = parentRecapData.reduce((acc, curr) => acc + curr.excuseCount, 0);
      const totalAlpha = parentRecapData.reduce((acc, curr) => acc + curr.absentCount, 0);

      return [
          { name: 'Tepat Waktu', value: totalHadir, color: '#10b981' },
          { name: 'Izin Telat', value: totalTelat, color: '#6366f1' },
          { name: 'Izin / Sakit', value: totalIzin, color: '#f59e0b' },
          { name: 'Tanpa Ket', value: totalAlpha, color: '#ef4444' }
      ].filter(d => d.value > 0);
  }, [parentRecapData]);

  // --- PER-AGENDA RESUME STATS ---
  const currentEventResume = useMemo(() => {
    if (!selectedAttEvent) return null;
    const eventAtt = attendance.filter(a => a.event_id === selectedAttEvent.id);
    const present = eventAtt.filter(a => a.status === 'Present').length;
    const late = eventAtt.filter(a => a.status === 'Excused Late').length;
    const excused = eventAtt.filter(a => a.status === 'Excused').length;
    const absent = eventAtt.filter(a => a.status === 'Absent').length;
    // Hitung total peserta yang seharusnya ada
    const total = members.filter(m => {
        const hasRecord = attendance.some(a => a.event_id === selectedAttEvent.id && a.member_id === m.id);
        return hasRecord;
    }).length || eventAtt.length;

    return { present, late, excused, absent, total };
  }, [selectedAttEvent, attendance, members]);

  // Search candidates for selection
  const filteredCandidates = useMemo(() => {
      if (inviteType !== 'SELECT') return [];
      return members.filter(m => {
          const groupName = groups.find(g => g.id === m.group_id)?.name || '';
          const searchLower = inviteSearch.toLowerCase();
          return m.full_name.toLowerCase().includes(searchLower) || groupName.toLowerCase().includes(searchLower);
      });
  }, [members, groups, inviteType, inviteSearch]);

  const handleOpenModal = (event?: Event) => {
    if (event) {
      setEditingItem(event);
      setName(event.name);
      const dt = new Date(event.date);
      setDate(dt.toISOString().split('T')[0]);
      setTime(`${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`);
      setLocation(event.location || '');
      setDescription(event.description || '');
      setEventType(event.event_type || 'Pengajian');
      setParentEventId(event.parent_event_id || '');
      setStatus(event.status);
      setLateTolerance(event.late_tolerance || 15);
      // Sinkronisasi Sesi
      setEventSessions(event.sessions && event.sessions.length > 0 ? event.sessions : [{id: 'default', name: 'Kehadiran', startTime: '', endTime: ''}]);
      setSelectedInvitees(attendance.filter(a => a.event_id === event.id).map(a => a.member_id));
      setInviteType('SELECT'); 
      setInviteSearch('');
    } else {
      setEditingItem(null);
      setName('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('09:00');
      setLocation('');
      setDescription('');
      setEventType('Pengajian');
      setParentEventId('');
      setStatus('Upcoming');
      setLateTolerance(15);
      setEventSessions([{id: 'default', name: 'Absen Masuk', startTime: '09:00', endTime: '12:00'}]);
      setInviteType('ALL');
      setSelectedInvitees([]);
      setInviteSearch('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fullDate = new Date(`${date}T${time}:00`);
    const payload: any = {
      name,
      date: fullDate.toISOString(),
      location,
      description,
      status,
      late_tolerance: lateTolerance,
      event_type: eventType,
      parent_event_id: parentEventId || null,
      sessions: eventSessions // Memastikan sesi dengan waktu tersimpan
    };

    if (!editingItem && activeFoundation) payload.foundation_id = activeFoundation.id;

    try {
      let eventId = editingItem?.id;
      if (editingItem) {
        await supabase.from('events').update(payload).eq('id', editingItem.id);
      } else {
        const { data: newEv } = await supabase.from('events').insert([payload]).select().single();
        eventId = newEv.id;
      }

      // Handle Peserta Undangan
      const targetMemberIds = inviteType === 'ALL' ? members.map(m => m.id) : selectedInvitees;
      if (eventId && targetMemberIds.length > 0) {
          const currentRecords = attendance.filter(a => a.event_id === eventId).map(a => a.member_id);
          const toAdd = targetMemberIds.filter(id => !currentRecords.includes(id)).map(mid => ({ event_id: eventId, member_id: mid, status: 'Absent' }));
          if (toAdd.length > 0) await supabase.from('event_attendance').insert(toAdd);
      }

      onRefresh();
      setIsModalOpen(false);
      showToast("Acara disimpan");
    } catch (error: any) { showToast(error.message, 'error'); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      if (deleteConfirm.mode === 'EVENT') await supabase.from('events').delete().eq('id', deleteConfirm.id);
      else await supabase.from('parent_events').delete().eq('id', deleteConfirm.id);
      onRefresh();
      fetchParentEvents();
      setDeleteConfirm({ isOpen: false, id: null, mode: 'EVENT' });
    } catch (error: any) { showToast(error.message, 'error'); }
  };

  const getAttendanceStats = (eventId: string) => {
    const eventAtt = attendance.filter(a => a.event_id === eventId);
    const presentTotal = eventAtt.filter(a => a.status === 'Present' || a.status === 'Excused Late').length;
    return { presentTotal, total: eventAtt.length };
  };

  const filteredAttendanceMembers = useMemo(() => {
    if (!selectedAttEvent) return [];
    return members
      .filter(m => {
          const hasRecord = attendance.some(a => a.event_id === selectedAttEvent?.id && a.member_id === m.id);
          return showUninvited ? true : hasRecord;
      })
      .filter(m => m.full_name.toLowerCase().includes(attendanceSearch.toLowerCase()))
      .filter(m => !selectedGroupFilter || m.group_id === selectedGroupFilter) 
      .filter(m => {
          if (attendanceStatusFilter === 'ALL') return true;
          const record = attendance.find(a => a.event_id === selectedAttEvent?.id && a.member_id === m.id);
          const currentStatus = record?.status;
          if (attendanceStatusFilter === 'Unrecorded') return !currentStatus;
          return currentStatus === attendanceStatusFilter;
      });
  }, [members, attendance, selectedAttEvent, attendanceSearch, attendanceStatusFilter, showUninvited, selectedGroupFilter]);

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      
      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="text-sm font-medium">{toast.message}</span>
          </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <CalendarDays className="text-primary-600" /> Manajemen Acara
              </h2>
              <button 
                onClick={handleManualRefresh}
                className={`p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border text-gray-400 hover:text-primary-600 transition ${isRefreshing ? 'opacity-50' : ''}`}
                title="Refresh Data"
                disabled={isRefreshing}
              >
                  <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
          </div>
          
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button onClick={() => setActiveTab('AGENDA')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'AGENDA' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500'}`}><CalendarDays size={14}/> Agenda</button>
              <button onClick={() => setActiveTab('ATTENDANCE')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'ATTENDANCE' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500'}`}><ClipboardCheck size={14}/> Absensi</button>
              <button onClick={() => setActiveTab('PARENT_EVENTS')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'PARENT_EVENTS' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600' : 'text-gray-500'}`}><Layers size={14}/> Event Utama</button>
          </div>
      </div>

      {/* --- TAB: AGENDA --- */}
      {activeTab === 'AGENDA' && (
          <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => handleOpenModal()} className="bg-primary-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-primary-600/20"><Plus size={18} /> Buat Acara</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedEvents.map(item => {
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
                             <div className="flex items-center gap-2"><Clock size={12}/> <span>{new Date(item.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} WIB</span></div>
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

      {/* --- TAB: PARENT EVENTS (EVENT UTAMA) --- */}
      {activeTab === 'PARENT_EVENTS' && (
          <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => handleOpenParentModal()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-indigo-600/20"><Plus size={18} /> Buat Event Utama</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {parentEvents.map(p => {
                      const count = events.filter(e => e.parent_event_id === p.id).length;
                      return (
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
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{count} TOTAL SESI</span>
                                  <button onClick={() => { setSelectedParentForRecap(p.id); setAttView('PARENT_RECAP'); setActiveTab('ATTENDANCE'); }} className="text-xs font-bold text-gray-500 hover:text-indigo-600 flex items-center gap-1">REKAP FREKUENSI <ChevronRight size={14}/></button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* --- TAB: ATTENDANCE (REKAP FREKUENSI & DETAIL) --- */}
      {activeTab === 'ATTENDANCE' && (
          <div className="space-y-4">
               {/* SUB HEADER */}
               <div className="flex justify-between items-center bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setAttView('LIST')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${attView === 'LIST' || attView === 'DETAIL' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>Pilih Acara</button>
                      <button onClick={() => setAttView('PARENT_RECAP')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${attView === 'PARENT_RECAP' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>Rekap Frekuensi</button>
                  </div>
              </div>

              {attView === 'LIST' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {activeEvents.map(e => (
                          <div key={e.id} onClick={() => { setSelectedAttEvent(e); setAttView('DETAIL'); }} className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-dark-border cursor-pointer hover:border-primary-400 transition">
                              <p className="text-[10px] font-bold text-gray-400 mb-1">{new Date(e.date).toLocaleDateString()}</p>
                              <h4 className="text-sm font-bold dark:text-white line-clamp-1">{e.name}</h4>
                          </div>
                      ))}
                      {activeEvents.length === 0 && <div className="col-span-3 py-20 text-center text-gray-400 italic">Belum ada agenda acara untuk yayasan ini.</div>}
                  </div>
              )}

              {attView === 'PARENT_RECAP' && (
                  <div className="space-y-6 animate-in fade-in">
                      {/* Section Grafik (Grafir) */}
                      {selectedParentForRecap && summaryGrafirData.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm col-span-1">
                                  <h4 className="text-sm font-black text-gray-800 dark:text-white uppercase mb-4 tracking-tighter">Proporsi Kehadiran (Grafir)</h4>
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
                                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center">
                                      {summaryGrafirData.map(d => (
                                          <div key={d.name} className="flex items-center gap-1.5">
                                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                                              <span className="text-[10px] font-bold text-gray-500 uppercase">{d.name}</span>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                              <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm col-span-2 flex flex-col">
                                  <h4 className="text-sm font-black text-gray-800 dark:text-white uppercase mb-4 tracking-tighter">Performa Kedisiplinan</h4>
                                  <div className="flex-1 flex items-center justify-around text-center">
                                      <div>
                                          <p className="text-[10px] font-bold text-gray-400 uppercase">Tepat Waktu</p>
                                          <p className="text-3xl font-black text-green-600">{summaryGrafirData.find(d => d.name === 'Tepat Waktu')?.value || 0}</p>
                                      </div>
                                      <div className="w-px h-10 bg-gray-100 dark:bg-gray-800"></div>
                                      <div>
                                          <p className="text-[10px] font-bold text-gray-400 uppercase">Izin Telat</p>
                                          <p className="text-3xl font-black text-indigo-600">{summaryGrafirData.find(d => d.name === 'Izin Telat')?.value || 0}</p>
                                      </div>
                                      <div className="w-px h-10 bg-gray-100 dark:bg-gray-800"></div>
                                      <div>
                                          <p className="text-[10px] font-bold text-gray-400 uppercase">Absen/Alpha</p>
                                          <p className="text-3xl font-black text-red-500">{summaryGrafirData.find(d => d.name === 'Tanpa Ket')?.value || 0}</p>
                                      </div>
                                  </div>
                                  <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                      <p className="text-[10px] text-gray-500 text-center font-medium italic">"Data grafik ini dihitung berdasarkan akumulasi seluruh sesi yang sudah berjalan pada Event Utama ini."</p>
                                  </div>
                              </div>
                          </div>
                      ) : selectedParentForRecap && (
                          <div className="bg-white dark:bg-dark-card p-10 rounded-2xl border border-dashed text-center text-gray-400 italic">Belum ada data absensi untuk Event Utama yang dipilih.</div>
                      )}

                      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                          <div className="p-6 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                  <div>
                                      <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Tabel Rekapitulasi</h3>
                                      <p className="text-xs text-gray-500">Persentase dan detail frekuensi per anggota.</p>
                                  </div>
                                  <div className="flex gap-3 w-full md:w-auto">
                                      <select 
                                        value={selectedParentForRecap} 
                                        onChange={(e) => setSelectedParentForRecap(e.target.value)}
                                        className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-sm font-bold outline-none ring-primary-500 focus:ring-2"
                                      >
                                          <option value="">-- Pilih Event Utama --</option>
                                          {parentEvents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                      </select>
                                      <div className="relative flex-1 md:w-64">
                                          <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                                          <input type="text" placeholder="Cari anggota..." value={recapSearch} onChange={e => setRecapSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl text-sm outline-none"/>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b dark:border-gray-800">
                                      <tr>
                                          <th className="px-6 py-4">Anggota</th>
                                          <th className="px-6 py-4 text-center">Hadir (Tepat)</th>
                                          <th className="px-6 py-4 text-center">Izin Telat</th>
                                          <th className="px-6 py-4 text-center">Total Frekuensi</th>
                                          <th className="px-6 py-4">Skor Kehadiran</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                      {parentRecapData.map(m => (
                                          <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                              <td className="px-6 py-4">
                                                  <p className="font-bold text-gray-900 dark:text-white">{m.full_name}</p>
                                                  <p className="text-[10px] text-gray-500 uppercase">{m.divisions?.name || '-'}</p>
                                              </td>
                                              <td className="px-6 py-4 text-center font-bold text-green-600">{m.attendanceCount - m.lateCount}</td>
                                              <td className="px-6 py-4 text-center font-bold text-indigo-500">{m.lateCount}</td>
                                              <td className="px-6 py-4 text-center font-black text-primary-600">{m.attendanceCount} / {m.totalSessions}</td>
                                              <td className="px-6 py-4 w-64">
                                                  <div className="flex items-center gap-3">
                                                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                          <div className="h-full bg-primary-500" style={{ width: `${m.percentage}%` }}></div>
                                                      </div>
                                                      <span className="text-xs font-black">{m.percentage}%</span>
                                                  </div>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                              {!selectedParentForRecap && <div className="py-20 text-center text-gray-400 italic">Silakan pilih Event Utama terlebih dahulu untuk melihat rekapitulasi data.</div>}
                              {selectedParentForRecap && parentRecapData.length === 0 && <div className="py-20 text-center text-gray-400 italic">Tidak ada data anggota untuk kriteria tersebut.</div>}
                          </div>
                      </div>
                  </div>
              )}

              {/* ABSENSI MANUAL DETAIL VIEW */}
              {attView === 'DETAIL' && selectedAttEvent && (
                  <div className="space-y-4 animate-in slide-in-from-right-10 duration-300">
                      
                      {/* RESUME CARDS */}
                      {currentEventResume && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm text-center">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Peserta</p>
                                <p className="text-xl font-black text-gray-800 dark:text-white">{currentEventResume.total}</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/30 shadow-sm text-center">
                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Hadir (Tepat)</p>
                                <p className="text-xl font-black text-green-700 dark:text-green-400">{currentEventResume.present}</p>
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm text-center">
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Izin Telat</p>
                                <p className="text-xl font-black text-indigo-700 dark:text-indigo-400">{currentEventResume.late}</p>
                            </div>
                            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-900/30 shadow-sm text-center">
                                <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1">Izin / Sakit</p>
                                <p className="text-xl font-black text-yellow-700 dark:text-yellow-400">{currentEventResume.excused}</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm text-center">
                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Alpha / Belum</p>
                                <p className="text-xl font-black text-red-700 dark:text-red-400">{currentEventResume.absent}</p>
                            </div>
                        </div>
                      )}

                      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                                <div className="flex flex-col">
                                    <button onClick={() => setAttView('LIST')} className="text-primary-600 text-xs font-bold flex items-center gap-1 mb-2 hover:underline w-fit"><ChevronLeft size={14}/> Kembali ke Daftar</button>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedAttEvent.name}</h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-2 mt-1"><CalendarDays size={14}/> {new Date(selectedAttEvent.date).toLocaleDateString('id-ID', {weekday: 'long', day:'numeric', month:'long', year:'numeric'})}</p>
                                </div>
                                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                                    {/* WHATSAPP RECAP BUTTON */}
                                    <button 
                                        onClick={handleShareRecapWA}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-md shadow-green-600/20 transition"
                                    >
                                        <Share2 size={14}/> Kirim Rekap WA
                                    </button>

                                    {/* GROUP FILTER */}
                                    <select 
                                        className="bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold rounded-lg px-3 py-2 outline-none dark:text-white"
                                        value={selectedGroupFilter} 
                                        onChange={(e) => setSelectedGroupFilter(e.target.value)}
                                    >
                                        <option value="">Semua Kelompok</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                    
                                    <select 
                                        className="bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold rounded-lg px-3 py-2 outline-none dark:text-white"
                                        value={attendanceStatusFilter} 
                                        onChange={(e) => setAttendanceStatusFilter(e.target.value as any)}
                                    >
                                        <option value="ALL">Semua Status</option>
                                        <option value="Present">Hadir (Tepat)</option>
                                        <option value="Excused Late">Izin Telat</option>
                                        <option value="Excused">Izin/Sakit</option>
                                        <option value="Absent">Alpha/Belum</option>
                                    </select>
                                    <div className="relative flex-1 xl:w-48">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                        <input 
                                            type="text" 
                                            placeholder="Cari nama..." 
                                            value={attendanceSearch} 
                                            onChange={(e) => setAttendanceSearch(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 text-xs border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b dark:border-gray-800">
                                    <tr>
                                        <th className="px-6 py-4">Anggota</th>
                                        <th className="px-6 py-4">Kelompok / Bidang</th>
                                        <th className="px-6 py-4 text-right">Tandai & Hubungi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                    {filteredAttendanceMembers.map(m => {
                                        const record = attendance.find(a => a.event_id === selectedAttEvent.id && a.member_id === m.id);
                                        const status = record?.status;
                                        const group = groups.find(g => g.id === m.group_id);
                                        
                                        return (
                                            <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{m.full_name}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{group?.name || '-'}</span>
                                                        <span className="text-[10px] text-gray-400 uppercase">{m.divisions?.name || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end items-center gap-2">
                                                        <button 
                                                            onClick={() => handleAttendanceChange(m.id, 'Present')}
                                                            className={`p-2 rounded-lg transition ${status === 'Present' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-green-600'}`}
                                                            title="Hadir Tepat Waktu"
                                                        >
                                                            <CheckCircle2 size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleAttendanceChange(m.id, 'Excused Late')}
                                                            className={`p-2 rounded-lg transition ${status === 'Excused Late' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-indigo-600'}`}
                                                            title="Izin Telat"
                                                        >
                                                            <Timer size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleAttendanceChange(m.id, 'Excused')}
                                                            className={`p-2 rounded-lg transition ${status === 'Excused' ? 'bg-yellow-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-yellow-600'}`}
                                                            title="Izin/Sakit"
                                                        >
                                                            <HelpCircle size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleAttendanceChange(m.id, 'Absent')}
                                                            className={`p-2 rounded-lg transition ${status === 'Absent' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-red-600'}`}
                                                            title="Alpha (Tanpa Ket)"
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={() => handleChatMember(m.phone, m.full_name)}
                                                            className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
                                                            title="Hubungi via WA"
                                                        >
                                                            <MessageCircle size={18} />
                                                        </button>

                                                        {status && (
                                                            <button onClick={() => handleResetStatus(m.id)} className="ml-2 p-1 text-gray-300 hover:text-red-400" title="Hapus Status">
                                                                <RotateCcw size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {filteredAttendanceMembers.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">Data tidak ditemukan untuk kriteria filter tersebut.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* --- MODAL FORM ACARA --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Acara' : 'Buat Acara Baru'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">Nama Acara</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Misal: Rapat Koordinasi Tahfidz" />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">Link Ke Event Utama (Opsional)</label>
                    <select value={parentEventId} onChange={e => setParentEventId(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-900 dark:text-indigo-200 px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="">-- Bukan Bagian Event Berulang --</option>
                        {parentEvents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">Tanggal</label>
                    <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">Waktu Mulai Utama</label>
                    <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                
                {/* SESSIONS MANAGEMENT */}
                <div className="col-span-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-dashed dark:border-gray-700">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-xs font-black text-gray-500 uppercase">Sesi Acara & Waktu</label>
                        <button type="button" onClick={() => setEventSessions([...eventSessions, { id: Date.now().toString(), name: `Sesi ${eventSessions.length + 1}`, startTime: time, endTime: '' }])} className="text-[10px] bg-primary-600 text-white px-2 py-1 rounded font-bold">+ TAMBAH SESI</button>
                    </div>
                    <div className="space-y-3">
                        {eventSessions.map((s, idx) => (
                            <div key={s.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 shadow-sm space-y-2">
                                <div className="flex gap-2 items-center">
                                    <input type="text" value={s.name} placeholder="Nama Sesi" onChange={(e) => {
                                        const next = [...eventSessions];
                                        next[idx].name = e.target.value;
                                        setEventSessions(next);
                                    }} className="flex-1 bg-transparent border-none text-xs font-black outline-none dark:text-white placeholder:font-normal" />
                                    {idx > 0 && <button type="button" onClick={() => setEventSessions(eventSessions.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>}
                                </div>
                                <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
                                    <div className="flex-1">
                                        <label className="block mb-0.5">WAKTU MULAI</label>
                                        <input type="time" value={s.startTime || ''} onChange={(e) => {
                                            const next = [...eventSessions];
                                            next[idx].startTime = e.target.value;
                                            setEventSessions(next);
                                        }} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded p-1 text-xs dark:text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block mb-0.5">WAKTU SELESAI</label>
                                        <input type="time" value={s.endTime || ''} onChange={(e) => {
                                            const next = [...eventSessions];
                                            next[idx].endTime = e.target.value;
                                            setEventSessions(next);
                                        }} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded p-1 text-xs dark:text-white" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* INVITEES SELECTION */}
                <div className="col-span-2">
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">Peserta Undangan</label>
                    <div className="flex gap-2 mb-3">
                        {['ALL', 'GENERUS', 'LIMA_UNSUR', 'SELECT'].map((type) => (
                            <button 
                                key={type} 
                                type="button" 
                                onClick={() => setInviteType(type as any)}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition ${inviteType === type ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}
                            >
                                {type === 'ALL' ? 'SEMUA' : type === 'GENERUS' ? 'GENERUS' : type === 'LIMA_UNSUR' ? 'LIMA UNSUR' : 'PILIH'}
                            </button>
                        ))}
                    </div>

                    {inviteType === 'SELECT' && (
                         <div className="space-y-3">
                             <div className="relative">
                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                 <input 
                                    type="text" 
                                    placeholder="Cari nama atau kelompok..." 
                                    value={inviteSearch}
                                    onChange={(e) => setInviteSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                                 />
                             </div>
                             <div className="max-h-40 overflow-y-auto border rounded-xl p-2 bg-gray-50 dark:bg-gray-900 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {filteredCandidates.map(m => {
                                     const groupName = groups.find(g => g.id === m.group_id)?.name || 'Tanpa Kelompok';
                                     return (
                                        <label key={m.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 text-[10px] font-bold cursor-pointer hover:border-primary-300">
                                            <input type="checkbox" checked={selectedInvitees.includes(m.id)} onChange={() => setSelectedInvitees(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])} className="rounded text-primary-600"/>
                                            <div className="flex flex-col min-w-0">
                                                <span className="truncate">{m.full_name}</span>
                                                <span className="text-[8px] text-gray-400 uppercase tracking-tighter">{groupName}</span>
                                            </div>
                                        </label>
                                     )
                                 })}
                                 {filteredCandidates.length === 0 && (
                                     <div className="col-span-2 py-4 text-center text-[10px] text-gray-400 italic">Anggota tidak ditemukan.</div>
                                 )}
                             </div>
                             <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 px-1">
                                 <span>{selectedInvitees.length} TERPILIH</span>
                                 <button type="button" onClick={() => setSelectedInvitees([])} className="text-red-500 hover:underline">HAPUS SEMUA</button>
                             </div>
                         </div>
                    )}
                </div>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sm font-bold text-gray-500">BATAL</button>
                <button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-primary-600 text-white rounded-xl font-black shadow-lg shadow-primary-600/20 active:scale-95 transition">{isSubmitting ? 'MEMPROSES...' : 'SIMPAN AGENDA'}</button>
            </div>
        </form>
      </Modal>

      {/* --- MODAL PARENT EVENT --- */}
      <Modal isOpen={isParentModalOpen} onClose={() => setIsParentModalOpen(false)} title={editingParent ? 'Edit Event Utama' : 'Tambah Event Utama'}>
          <form onSubmit={handleParentSubmit} className="space-y-4">
              <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">Nama Rangkaian Acara</label>
                  <input type="text" required value={parentName} onChange={e => setParentName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-bold outline-none" placeholder="Misal: Pengajian Ahad Pagi" />
              </div>
              <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">Keterangan</label>
                  <textarea value={parentDesc} onChange={e => setParentDesc(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 dark:border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm outline-none" placeholder="Deskripsi mengenai rangkaian acara ini..." />
              </div>
              <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={() => setIsParentModalOpen(false)} className="px-4 py-2 font-bold text-gray-400">BATAL</button><button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-black shadow-lg">SIMPAN</button></div>
          </form>
      </Modal>

      {/* --- DELETE CONFIRMATION --- */}
      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null, mode: 'EVENT'})} title="Konfirmasi Hapus">
          <div className="text-center space-y-4">
              <div className="bg-red-50 p-4 rounded-full w-fit mx-auto text-red-500"><AlertTriangle size={48}/></div>
              <p className="font-bold">Apakah Anda yakin ingin menghapus data ini? <br/> <span className="text-xs text-gray-500 font-normal">Data absensi terkait juga mungkin akan ikut terhapus.</span></p>
              <div className="flex justify-center gap-3 pt-4"><button onClick={() => setDeleteConfirm({isOpen: false, id: null, mode: 'EVENT'})} className="px-6 py-2 font-bold text-gray-400">BATAL</button><button onClick={handleDelete} className="px-8 py-2 bg-red-600 text-white rounded-xl font-bold">YA, HAPUS</button></div>
          </div>
      </Modal>
    </div>
  );
};
