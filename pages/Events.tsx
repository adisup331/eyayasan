import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Event, EventAttendance, Member, Foundation, EventSession, Group, ParentEvent, Division } from '../types';
import { 
  Plus, Edit, Trash2, CalendarDays, MapPin, 
  Clock, Search, AlertTriangle, MessageCircle, Copy, Check, Minimize2, Maximize2,
  ClipboardCheck, BarChart3, ChevronLeft, ChevronRight, Filter, TrendingUp, Activity, Minus, TrendingDown, Ban, CheckCircle2, HelpCircle, XCircle, RotateCcw, Timer, PlayCircle, X, List, StopCircle, Lock, UserPlus, RefreshCw, Boxes, Layers, Tag, Share2, FileText, Download, UserX, Save, Users
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';
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
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null, mode: 'EVENT' | 'PARENT' | 'TAKEOUT'}>({ isOpen: false, id: null, mode: 'EVENT' });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Leave Reason State
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState<{memberId: string, status: any} | null>(null);
  const [tempReason, setTempReason] = useState('');

  // Add Manual Participant State
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

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

  const handleAttendanceChange = async (memberId: string, newStatus: 'Present' | 'Absent' | 'Excused' | 'Excused Late' | 'Present Late', reason?: string) => {
    if (!selectedAttEvent) return;
    
    if ((newStatus === 'Excused' || newStatus === 'Excused Late') && reason === undefined) {
        setPendingAttendance({ memberId, status: newStatus });
        setTempReason('');
        setIsReasonModalOpen(true);
        return;
    }

    try {
        const now = new Date();
        const existingRecord = (attendance || []).find(a => a.event_id === selectedAttEvent.id && a.member_id === memberId);
        const finalStatus = newStatus;

       const updateData: any = { 
           event_id: selectedAttEvent.id, 
           member_id: memberId, 
           status: finalStatus,
           check_in_time: (finalStatus === 'Present' || finalStatus === 'Present Late') 
                ? (existingRecord?.check_in_time || now.toISOString()) 
                : (existingRecord?.check_in_time || null),
           leave_reason: reason || existingRecord?.leave_reason || null
        };

       const { error } = await supabase.from('event_attendance').upsert(updateData, { onConflict: 'event_id, member_id' });
       if (error) throw error;
       
       showToast(`Status berhasil diubah menjadi: ${finalStatus === 'Present' ? 'Hadir Tepat' : finalStatus}`);
       onRefresh(); 
    } catch (error: any) { showToast('Gagal update: ' + error.message, 'error'); }
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
      } catch (error: any) { showToast('Gagal reset: ' + error.message, 'error'); }
  };

  const handleTakeoutMember = async (memberId: string) => {
      if (!selectedAttEvent) return;
      try {
          const { error } = await supabase.from('event_attendance').delete().match({ event_id: selectedAttEvent.id, member_id: memberId });
          if (error) throw error;
          showToast("Anggota dikeluarkan dari daftar");
          onRefresh();
      } catch (error: any) { showToast('Gagal mengeluarkan: ' + error.message, 'error'); }
  };

  const handleAddManualMember = async (memberId: string) => {
      if (!selectedAttEvent) return;
      try {
          const { error } = await supabase.from('event_attendance').insert({
              event_id: selectedAttEvent.id,
              member_id: memberId,
              status: 'Absent'
          });
          if (error) throw error;
          showToast("Anggota berhasil ditambahkan ke daftar");
          onRefresh();
      } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleDownloadPDF = () => {
    if (!selectedAttEvent || !currentEventResume) return;

    const doc = new jsPDF();
    const dateObj = new Date(selectedAttEvent.date);
    const dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const foundationName = activeFoundation?.name || 'E-YAYASAN';

    // Header
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text(foundationName, 105, 15, { align: 'center' });
    doc.setFontSize(12); doc.text('LAPORAN RESUME KEHADIRAN ACARA', 105, 22, { align: 'center' });
    doc.setLineWidth(0.5); doc.line(20, 26, 190, 26);

    // Event Info Section
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('DETAIL ACARA:', 20, 35);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Nama Acara', 20, 42); doc.text(`: ${selectedAttEvent.name}`, 55, 42);
    doc.text('Tanggal', 20, 47); doc.text(`: ${dateStr}`, 55, 47);
    doc.text('Waktu Mulai', 20, 52); doc.text(`: ${timeStr}`, 55, 52);
    doc.text('Toleransi Telat', 20, 57); doc.text(`: ${selectedAttEvent.late_tolerance || 0} Menit`, 55, 57);
    doc.text('Lokasi', 20, 62); doc.text(`: ${selectedAttEvent.location || '-'}`, 55, 62);
    
    if (selectedAttEvent.description) {
        doc.text('Keterangan', 20, 67); 
        const splitDesc = doc.splitTextToSize(selectedAttEvent.description, 130);
        doc.text(':', 55, 67); doc.text(splitDesc, 57, 67);
    }

    // Stats Section
    const statsY = selectedAttEvent.description ? 85 : 75;
    doc.setFont('helvetica', 'bold'); doc.text('RESUME STATISTIK:', 20, statsY);
    doc.setFont('helvetica', 'normal');
    doc.text(`- Hadir Tepat    : ${currentEventResume.present} orang`, 25, statsY + 7);
    doc.text(`- Hadir Telat    : ${currentEventResume.presentLate} orang`, 25, statsY + 12);
    doc.text(`- Izin Telat     : ${currentEventResume.excusedLate} orang`, 25, statsY + 17);
    doc.text(`- Izin / Sakit   : ${currentEventResume.excused} orang`, 25, statsY + 22);
    doc.text(`- Alpha / Blm   : ${currentEventResume.absent} orang`, 25, statsY + 27);
    doc.text(`- Total Peserta  : ${currentEventResume.total} orang`, 25, statsY + 32);

    let y = statsY + 45;
    const statuses = [
        { id: 'Present', label: '1. HADIR TEPAT WAKTU', color: [240, 253, 244] },
        { id: 'Present Late', label: '2. HADIR TELAT', color: [255, 251, 235] },
        { id: 'Excused Late', label: '3. IZIN TELAT (KHUSUS)', color: [238, 242, 255] },
        { id: 'Excused', label: '4. IZIN / SAKIT / IZIN TENGAH ACARA', color: [240, 249, 255] },
        { id: 'Absent', label: '5. TANPA KETERANGAN / ALPHA', color: [254, 242, 242] }
    ];

    statuses.forEach(statusGroup => {
        const membersInStatus = filteredAttendanceMembers.filter(m => {
            const record = (attendance || []).find(a => a.event_id === selectedAttEvent.id && a.member_id === m.id);
            return record?.status === statusGroup.id;
        });
        if (membersInStatus.length === 0) return;
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFillColor(statusGroup.color[0], statusGroup.color[1], statusGroup.color[2]); doc.rect(20, y, 170, 7, 'F'); doc.text(statusGroup.label, 22, y + 5); y += 10;
        doc.setFontSize(8); doc.text('No', 22, y); doc.text('Nama Anggota', 30, y); doc.text('Kelompok', 85, y); doc.text('Jam Masuk', 120, y); doc.text('Alasan / Keterangan', 145, y); doc.line(20, y + 2, 190, y + 2); y += 6;
        membersInStatus.forEach((m, idx) => {
            if (y > 275) { doc.addPage(); y = 20; }
            const record = (attendance || []).find(a => a.event_id === selectedAttEvent.id && a.member_id === m.id);
            const groupName = groups.find(g => g.id === m.group_id)?.name || '-';
            const jam = record?.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : '-';
            const alasan = record?.leave_reason || '-';
            doc.setFont('helvetica', 'normal'); doc.text(`${idx + 1}`, 22, y); doc.text(doc.splitTextToSize(m.full_name, 50), 30, y); doc.text(doc.splitTextToSize(groupName, 30), 85, y); doc.text(jam, 120, y); doc.text(doc.splitTextToSize(alasan, 45), 145, y);
            doc.setDrawColor(230, 230, 230); doc.line(20, y + 3, 190, y + 3); y += 8;
        });
        y += 5;
    });

    y += 20; if (y > 260) { doc.addPage(); y = 30; }
    doc.setFont('helvetica', 'bold'); doc.text('Dicetak Oleh,', 150, y, { align: 'center' }); doc.text('___________________', 150, y + 25, { align: 'center' }); doc.setFont('helvetica', 'normal'); doc.text('Sistem E-Yayasan', 150, y + 30, { align: 'center' });
    doc.save(`Resume_Absensi_${selectedAttEvent.name.replace(/\s+/g, '_')}.pdf`);
    showToast("PDF Berhasil diunduh");
  };

  const handleShareRecapWA = () => {
    if (!selectedAttEvent || !currentEventResume) return;
    const dateStr = new Date(selectedAttEvent.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    let text = `*RESUME ABSENSI ACARA*\n*Agenda:* ${selectedAttEvent.name}\n*Waktu:* ${dateStr}\n--------------------------------\n✅ *Hadir Tepat:* ${currentEventResume.present} org\n⏰ *Hadir Telat:* ${currentEventResume.presentLate} org\n🙏 *Izin Telat:* ${currentEventResume.excusedLate} org\n🏥 *Izin Sakit:* ${currentEventResume.excused} org\n❌ *Alpha:* ${currentEventResume.absent} org\n--------------------------------\n_Dikirim otomatis via E-Yayasan_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleChatMember = (phone?: string, name?: string) => {
      if (!phone) { showToast("Tidak ada nomor WA", "error"); return; }
      const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
      const text = `Assalamu'alaikum wr wb, saudara/i *${name}*. Mengingatkan kehadiran untuk acara *${selectedAttEvent?.name}*. Syukron katsiron.`;
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
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

  const nonParticipantCandidates = useMemo(() => {
      if (!selectedAttEvent) return [];
      const currentParticipants = (attendance || []).filter(a => a.event_id === selectedAttEvent.id).map(a => a.member_id);
      return members.filter(m => !currentParticipants.includes(m.id))
                    .filter(m => m.full_name.toLowerCase().includes(participantSearch.toLowerCase()));
  }, [members, attendance, selectedAttEvent, participantSearch]);

  const handleOpenModal = (event?: Event) => {
    if (event) {
      setEditingItem(event); setName(event.name);
      const dt = new Date(event.date); setDate(dt.toISOString().split('T')[0]);
      setTime(`${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`);
      setLocation(event.location || ''); setDescription(event.description || ''); setEventType(event.event_type || 'Pengajian');
      setParentEventId(event.parent_event_id || ''); setStatus(event.status); setLateTolerance(event.late_tolerance || 15);
      setEventSessions(event.sessions && event.sessions.length > 0 ? event.sessions : [{id: 'default', name: 'Kehadiran', startTime: '', endTime: ''}]);
      const currentInvitees = (attendance || []).filter(a => a.event_id === event.id).map(a => a.member_id);
      setSelectedInvitees(currentInvitees); setInviteType('SELECT'); setInviteSearch('');
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
      else { const { data: newEv } = await supabase.from('events').insert([payload]).select().single(); eventId = newEv?.id; }
      const targetMemberIds = inviteType === 'ALL' ? members.map(m => m.id) : selectedInvitees;
      if (eventId && targetMemberIds.length > 0) {
          const currentRecords = (attendance || []).filter(a => a.event_id === eventId).map(a => a.member_id);
          const toAdd = targetMemberIds.filter(id => !currentRecords.includes(id)).map(mid => ({ event_id: eventId, member_id: mid, status: 'Absent' }));
          if (toAdd.length > 0) await supabase.from('event_attendance').insert(toAdd);
      }
      onRefresh(); setIsModalOpen(false); showToast("Acara disimpan");
    } catch (error: any) { showToast(error.message, 'error'); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      if (deleteConfirm.mode === 'EVENT') {
          const { error } = await supabase.from('events').delete().eq('id', deleteConfirm.id);
          if (error) throw error;
      } else if (deleteConfirm.mode === 'PARENT') {
          const { error } = await supabase.from('parent_events').delete().eq('id', deleteConfirm.id);
          if (error) throw error;
      } else if (deleteConfirm.mode === 'TAKEOUT') {
          await handleTakeoutMember(deleteConfirm.id);
      }
      onRefresh(); setDeleteConfirm({ isOpen: false, id: null, mode: 'EVENT' });
      showToast("Data berhasil dihapus");
    } catch (error: any) { 
        if (error.message.includes('foreign key constraint')) {
            showToast("Gagal hapus: Data masih digunakan.", "error");
        } else {
            showToast(error.message, 'error'); 
        }
    }
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
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
              <div className="flex justify-end"><button onClick={() => handleOpenModal()} className="bg-primary-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-primary-600/20 active:scale-95 transition"><Plus size={18} /> Buat Acara</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map(item => (
                      <div key={item.id} className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden hover:shadow-md transition flex flex-col group relative">
                        <div className={`h-1.5 w-full ${item.status === 'Upcoming' ? 'bg-blue-500' : item.status === 'Completed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div className="p-5 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-3">
                            <span className="px-2 py-0.5 rounded text-[9px] bg-purple-100 text-purple-700 font-black uppercase tracking-wider">{item.event_type || 'Umum'}</span>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenModal(item)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><Edit size={18}/></button>
                                <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id, mode: 'EVENT'})} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Hapus"><Trash2 size={18}/></button>
                            </div>
                          </div>
                          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{item.name}</h3>
                          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 mb-4">
                             <div className="flex items-center gap-2"><CalendarDays size={12}/> <span>{new Date(item.date).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'short'})}</span></div>
                             <div className="flex items-center gap-2"><Clock size={12}/> <span>{new Date(item.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} WIB</span></div>
                             <div className="flex items-center gap-2 text-primary-600 font-medium"><MapPin size={12}/> <span className="line-clamp-1">{item.location || 'Lokasi belum diatur'}</span></div>
                          </div>
                          <div className="mt-auto pt-4 border-t dark:border-gray-800 flex justify-end items-center">
                             <button onClick={() => { setSelectedAttEvent(item); setAttView('DETAIL'); setActiveTab('ATTENDANCE'); }} className="text-xs font-black text-primary-600 bg-primary-50 px-3 py-1 rounded-lg hover:bg-primary-100 transition">ABSENSI</button>
                          </div>
                        </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'ATTENDANCE' && (
          <div className="space-y-4">
               <div className="flex justify-between items-center bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setAttView('LIST')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${attView === 'LIST' || attView === 'DETAIL' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Pilih Acara</button>
                      <button onClick={() => setAttView('PARENT_RECAP')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${attView === 'PARENT_RECAP' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Rekap Frekuensi</button>
                  </div>
              </div>

              {attView === 'DETAIL' && selectedAttEvent && (
                  <div className="space-y-4 animate-in slide-in-from-right-10 duration-300">
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                          <div className="bg-white dark:bg-dark-card p-3 rounded-2xl border border-gray-100 text-center shadow-sm"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p><p className="text-xl font-black">{currentEventResume?.total}</p></div>
                          <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-2xl border border-green-100 text-center shadow-sm"><p className="text-[10px] font-black text-green-600 uppercase mb-1">Tepat</p><p className="text-xl font-black text-green-700">{currentEventResume?.present}</p></div>
                          <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-2xl border border-amber-100 text-center shadow-sm"><p className="text-[10px] font-black text-amber-600 uppercase mb-1">Telat</p><p className="text-xl font-black text-amber-700">{currentEventResume?.presentLate}</p></div>
                          <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-2xl border border-indigo-100 text-center shadow-sm"><p className="text-[10px] font-black text-indigo-600 uppercase mb-1">Izin Telat</p><p className="text-xl font-black text-indigo-700">{currentEventResume?.excusedLate}</p></div>
                          <div className="bg-slate-50 dark:bg-slate-900/10 p-3 rounded-2xl border border-slate-100 text-center shadow-sm"><p className="text-[10px] font-black text-slate-500 uppercase mb-1">Izin Sakit</p><p className="text-xl font-black text-slate-700">{currentEventResume?.excused}</p></div>
                          <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100 text-center shadow-sm"><p className="text-[10px] font-black text-red-600 uppercase mb-1">Alpha</p><p className="text-xl font-black text-red-700">{currentEventResume?.absent}</p></div>
                      </div>

                      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                            <div className="flex flex-col"><button onClick={() => setAttView('LIST')} className="text-primary-600 text-xs font-bold flex items-center gap-1 mb-2 hover:underline w-fit"><ChevronLeft size={14}/> Kembali</button><h3 className="text-xl font-black uppercase tracking-tight">{selectedAttEvent.name}</h3><p className="text-xs text-gray-500 flex items-center gap-2 mt-1"><CalendarDays size={14}/> {new Date(selectedAttEvent.date).toLocaleDateString('id-ID', {weekday: 'long', day:'numeric', month:'long'})}</p></div>
                            <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                                <button onClick={() => setIsAddParticipantModalOpen(true)} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-md shadow-primary-600/20"><UserPlus size={14}/> Tambah Peserta</button>
                                <button onClick={handleDownloadPDF} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-md shadow-indigo-600/20"><Download size={14}/> Cetak Resume PDF</button>
                                <button onClick={handleShareRecapWA} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-md shadow-green-600/20"><Share2 size={14}/> Kirim WA</button>
                                <select className="bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold rounded-lg px-3 py-2 outline-none dark:text-white" value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)}><option value="">Semua Kelompok</option>{groups.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}</select>
                                <select className="bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-bold rounded-lg px-3 py-2 outline-none dark:text-white" value={attendanceStatusFilter} onChange={(e) => setAttendanceStatusFilter(e.target.value as any)}><option value="ALL">Semua Status</option><option value="Present">Hadir Tepat</option><option value="Present Late">Hadir Telat</option><option value="Excused Late">Izin Telat</option><option value="Excused">Izin Sakit</option><option value="Absent">Alpha</option></select>
                                <div className="relative flex-1 xl:w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="Cari nama..." value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white outline-none"/></div>
                            </div>
                        </div>
                        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b dark:border-gray-800"><tr><th className="px-6 py-4">Anggota</th><th className="px-6 py-4 text-center">Jam Masuk</th><th className="px-6 py-4 text-right">Tandai & Aksi</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-dark-border">{filteredAttendanceMembers.map(m => {
                                        const record = (attendance || []).find(a => a.event_id === selectedAttEvent.id && a.member_id === m.id);
                                        const status = record?.status;
                                        const checkTime = record?.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-';
                                        return (
                                            <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-900 dark:text-white">{m.full_name}</div>
                                                    <div className="text-[10px] text-gray-500">{(groups.find(g => g.id === m.group_id))?.name || '-'} / {(divisions.find(d => d.id === m.division_id))?.name || '-'}</div>
                                                    {record?.leave_reason && <div className="mt-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded w-fit italic">Ket: {record.leave_reason}</div>}
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-bold text-gray-600 dark:text-gray-400">{checkTime}</td>
                                                <td className="px-6 py-4 text-right"><div className="flex justify-end items-center gap-1">
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Present')} className={`p-1.5 rounded-lg transition ${status === 'Present' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-green-600'}`} title="Hadir Tepat (Force)">
                                                            <CheckCircle2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Present Late')} className={`p-1.5 rounded-lg transition ${status === 'Present Late' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-amber-500'}`} title="Hadir Telat">
                                                            <Timer size={16} />
                                                        </button>
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Excused')} className={`p-1.5 rounded-lg transition ${status === 'Excused' ? 'bg-slate-400 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-slate-600'}`} title="Izin (Input Alasan)">
                                                            <HelpCircle size={16} />
                                                        </button>
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Excused Late')} className={`p-1.5 rounded-lg transition ${status === 'Excused Late' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-indigo-600'}`} title="Izin Telat (Input Alasan)">
                                                            <Clock size={16} />
                                                        </button>
                                                        <button onClick={() => handleAttendanceChange(m.id, 'Absent')} className={`p-1.5 rounded-lg transition ${status === 'Absent' ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-red-600'}`} title="Alpha">
                                                            <XCircle size={16} />
                                                        </button>
                                                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                                        <button onClick={() => handleChatMember(m.phone, m.full_name)} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"><MessageCircle size={16} /></button>
                                                        <button onClick={() => setDeleteConfirm({isOpen: true, id: m.id, mode: 'TAKEOUT'})} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Takeout"><UserX size={16}/></button>
                                                        {status && status !== 'Absent' && <button onClick={() => handleResetStatus(m.id)} className="ml-1 p-1 text-gray-300 hover:text-red-400" title="Hapus Status"><RotateCcw size={12} /></button>}
                                                    </div></td></tr>
                                        )
                                    })}</tbody></table></div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* MODAL INPUT ALASAN */}
      <Modal isOpen={isReasonModalOpen} onClose={() => setIsReasonModalOpen(false)} title="Input Alasan Izin">
          <form onSubmit={handleSaveReason} className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                  <HelpCircle className="text-amber-600 mt-1" size={20}/>
                  <div className="text-xs text-amber-800 dark:text-amber-200">Masukkan alasan izin (absen/pulang awal). Keterangan ini akan muncul di Resume PDF.</div>
              </div>
              <textarea required autoFocus value={tempReason} onChange={e => setTempReason(e.target.value)} rows={4} className="w-full rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm outline-none transition" placeholder="Contoh: Izin pulang awal karena keperluan mendesak..." />
              <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsReasonModalOpen(false)} className="px-6 py-2 text-sm font-bold text-gray-400">BATAL</button>
                  <button type="submit" className="px-8 py-2 bg-primary-600 text-white rounded-xl font-black shadow-lg shadow-primary-600/20 active:scale-95 transition"><Save size={18}/> SIMPAN ALASAN</button>
              </div>
          </form>
      </Modal>

      {/* MODAL TAMBAH PESERTA MANUAL */}
      <Modal isOpen={isAddParticipantModalOpen} onClose={() => setIsAddParticipantModalOpen(false)} title="Tambah Peserta Absensi">
          <div className="space-y-4">
              <div className="relative">
                  <Search size={18} className="absolute left-3 top-3 text-gray-400"/>
                  <input type="text" placeholder="Cari nama anggota..." value={participantSearch} onChange={e => setParticipantSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-primary-500 transition" />
              </div>
              <div className="max-h-80 overflow-y-auto divide-y border rounded-xl dark:border-gray-700">
                  {nonParticipantCandidates.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <div>
                              <p className="font-bold text-sm text-gray-900 dark:text-white">{m.full_name}</p>
                              <p className="text-[10px] text-gray-500 uppercase">{groups.find(g => g.id === m.group_id)?.name || '-'}</p>
                          </div>
                          <button onClick={() => handleAddManualMember(m.id)} className="p-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-600 hover:text-white transition"><Plus size={18}/></button>
                      </div>
                  ))}
                  {nonParticipantCandidates.length === 0 && <div className="py-10 text-center text-gray-400 italic text-sm">Tidak ada anggota tersedia.</div>}
              </div>
              <div className="flex justify-end pt-2">
                  <button onClick={() => setIsAddParticipantModalOpen(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">Tutup</button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Acara' : 'Buat Acara Baru'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs font-black text-gray-500 uppercase mb-1">Nama Acara</label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-sm outline-none" placeholder="Misal: Rapat Koordinasi Tahfidz" /></div>
                <div className="col-span-2"><label className="block text-xs font-black text-gray-500 uppercase mb-1">Event Utama (Opsional)</label><select value={parentEventId} onChange={e => setParentEventId(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm outline-none"><option value="">-- Tidak Berulang --</option>{parentEvents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="col-span-2"><label className="block text-xs font-black text-gray-500 uppercase mb-1">Lokasi Acara</label><div className="relative"><MapPin size={16} className="absolute left-4 top-3.5 text-gray-400"/><input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full pl-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-sm outline-none" placeholder="Misal: Aula Yayasan Lantai 2" /></div></div>
                <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm outline-none" /></div>
                <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Waktu</label><input type="time" required value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm outline-none" /></div>
                <div className="col-span-2"><label className="block text-xs font-black text-gray-500 uppercase mb-1">Toleransi Telat (Menit)</label><input type="number" required value={lateTolerance} onChange={e => setLateTolerance(Number(e.target.value))} className="w-full rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm outline-none" /></div>
                <div className="col-span-2"><label className="block text-xs font-black text-gray-500 uppercase mb-1">Undangan</label><div className="flex gap-2 mb-3">{['ALL', 'SELECT'].map((type) => (<button key={type} type="button" onClick={() => setInviteType(type as any)} className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition ${inviteType === type ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>{type === 'ALL' ? 'SEMUA' : 'PILIH'}</button>))}</div>
                    {inviteType === 'SELECT' && (
                         <div className="space-y-3"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="Cari nama..." value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-900 outline-none" /></div>
                             <div className="max-h-40 overflow-y-auto border rounded-xl p-2 bg-gray-50 dark:bg-gray-900 grid grid-cols-1 sm:grid-cols-2 gap-2">{members.filter(m => m.full_name.toLowerCase().includes(inviteSearch.toLowerCase())).map(m => (
                                    <label key={m.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border text-[10px] font-bold cursor-pointer hover:border-primary-300">
                                        <input type="checkbox" checked={selectedInvitees.includes(m.id)} onChange={() => setSelectedInvitees(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])} className="rounded text-primary-600"/>
                                        <span className="truncate">{m.full_name}</span>
                                    </label>
                                 ))}</div></div>
                    )}
                </div>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sm font-bold text-gray-500">BATAL</button><button type="submit" disabled={isSubmitting} className="px-10 py-2.5 bg-primary-600 text-white rounded-xl font-black active:scale-95 transition">{isSubmitting ? 'MEMPROSES...' : 'SIMPAN'}</button></div>
        </form>
      </Modal>

      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null, mode: 'EVENT'})} title="Konfirmasi">
          <div className="text-center space-y-4">
              <div className="bg-red-50 p-4 rounded-full w-fit mx-auto text-red-500"><AlertTriangle size={48}/></div>
              <p className="font-bold">{deleteConfirm.mode === 'TAKEOUT' ? 'Keluarkan dari absensi?' : 'Hapus data?'} <br/> <span className="text-xs text-gray-500 font-normal">Tindakan ini tidak bisa dibatalkan.</span></p>
              <div className="flex justify-center gap-3 pt-4"><button onClick={() => setDeleteConfirm({isOpen: false, id: null, mode: 'EVENT'})} className="px-6 py-2 font-bold text-gray-400">BATAL</button><button onClick={handleDelete} className="px-8 py-2 bg-red-600 text-white rounded-xl font-bold active:scale-95 transition">YA, LANJUTKAN</button></div>
          </div>
      </Modal>
    </div>
  );
};