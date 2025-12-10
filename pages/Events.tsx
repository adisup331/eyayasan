
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Event, EventAttendance, Member, Foundation } from '../types';
import { 
  Plus, Edit, Trash2, CalendarDays, MapPin, 
  ClipboardCheck, CheckCircle2, XCircle, HelpCircle, 
  Clock, Search, ChevronLeft, Maximize2, Minimize2, PieChart, Users, AlertTriangle, Filter, RotateCcw, UserPlus,
  BarChart3, Activity, TrendingUp, TrendingDown, Minus, MessageCircle, Copy, Check, Info, X, PlayCircle, Timer, Ban
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';

interface EventsProps {
  events: Event[];
  members: Member[];
  attendance: EventAttendance[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; // Added prop
}

export const Events: React.FC<EventsProps> = ({ events, members, attendance, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [view, setView] = useState<'LIST' | 'ATTENDANCE' | 'RECAP'>('LIST');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Full Screen State
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Event | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Upcoming' | 'Completed' | 'Cancelled'>('Upcoming');
  const [lateTolerance, setLateTolerance] = useState<number>(15); // NEW: Tolerance in Minutes
  
  // WA Generator State
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waText, setWaText] = useState('');
  const [waCopied, setWaCopied] = useState(false);
  
  // Participant Selection State
  const [inviteType, setInviteType] = useState<'ALL' | 'SELECT'>('ALL');
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [inviteeSearch, setInviteeSearch] = useState('');
  const [isInviteExpanded, setIsInviteExpanded] = useState(false); // EXPAND STATE
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  // Attendance Filter State
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'Present' | 'Excused' | 'Absent' | 'Unrecorded'>('ALL');
  const [showUninvited, setShowUninvited] = useState(false); // Toggle to show members not in the list

  // Recap Filter State
  const [recapSearch, setRecapSearch] = useState('');
  // NEW RECAP FILTERS
  const [recapFilterType, setRecapFilterType] = useState<'ALL' | 'YEAR' | 'MONTH'>('ALL');
  const [recapYear, setRecapYear] = useState(new Date().getFullYear());
  const [recapMonth, setRecapMonth] = useState(new Date().getMonth()); // 0-11

  // NEW: Member Detail Modal in Recap
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // NEW: Toast Notification State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Available Years for Filter
  const availableYears = useMemo(() => {
    const years = new Set(events.map(e => new Date(e.date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [events]);

  // --- SYNC STATE ON DATA REFRESH ---
  useEffect(() => {
    if (view === 'ATTENDANCE' && selectedEvent) {
      const updatedEvent = events.find(e => e.id === selectedEvent.id);
      if (updatedEvent) {
        setSelectedEvent(updatedEvent);
      }
    }
  }, [events]);

  // Handle Full Screen Changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // --- RECAP CALCULATION ---
  const memberAttendanceStats = useMemo(() => {
      // 1. Filter Events based on Recap Filter
      const relevantEvents = events.filter(e => {
          const d = new Date(e.date);
          if (recapFilterType === 'ALL') return true;
          if (recapFilterType === 'YEAR') return d.getFullYear() === recapYear;
          if (recapFilterType === 'MONTH') return d.getFullYear() === recapYear && d.getMonth() === Number(recapMonth);
          return true;
      });

      const relevantEventIds = relevantEvents.map(e => e.id);

      // Only include members who have a division (Active members)
      const activeMembers = members.filter(m => m.division_id);

      return activeMembers.map(member => {
          // Find attendance records ONLY for the relevant events
          const myAttendance = attendance.filter(a => a.member_id === member.id && relevantEventIds.includes(a.event_id));
          
          const totalInvited = myAttendance.length;
          const present = myAttendance.filter(a => a.status === 'Present').length;
          const excused = myAttendance.filter(a => a.status === 'Excused').length;
          const absent = myAttendance.filter(a => a.status === 'Absent').length; // Includes explicitly marked absent
          
          // Percentage Calculation
          // Avoid division by zero
          const percentage = totalInvited > 0 ? (present / totalInvited) * 100 : 0;

          // Assessment Logic
          let assessment: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NONE' = 'NONE';
          if (totalInvited > 0) {
              if (percentage >= 85) assessment = 'EXCELLENT';
              else if (percentage >= 70) assessment = 'GOOD';
              else if (percentage >= 50) assessment = 'FAIR';
              else assessment = 'POOR';
          }

          return {
              ...member,
              stats: { totalInvited, present, excused, absent, percentage, assessment, records: myAttendance }
          };
      }).filter(m => 
          m.full_name.toLowerCase().includes(recapSearch.toLowerCase()) || 
          m.divisions?.name.toLowerCase().includes(recapSearch.toLowerCase())
      ).sort((a, b) => b.stats.percentage - a.stats.percentage); // Sort by highest attendance
  }, [members, attendance, events, recapSearch, recapFilterType, recapYear, recapMonth]);

  // --- RECAP SUMMARY STATS ---
  const recapSummary = useMemo(() => {
      const counts = {
          EXCELLENT: 0,
          GOOD: 0,
          FAIR: 0,
          POOR: 0,
          NEVER: 0 // New Category: Never Attended
      };
      memberAttendanceStats.forEach(m => {
          if (m.stats.assessment !== 'NONE') {
              counts[m.stats.assessment]++;
          }
          // Never attended logic: Invited at least once, but 0 presence
          if (m.stats.totalInvited > 0 && m.stats.present === 0) {
              counts.NEVER++;
          }
      });
      return counts;
  }, [memberAttendanceStats]);

  const getAssessmentBadge = (assessment: string, stats: any) => {
      // Special check for Never
      if (stats.totalInvited > 0 && stats.present === 0) {
           return (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-900 text-red-100 dark:bg-red-950 dark:text-red-300">
                  <Ban size={12} /> Nihil Hadir
              </span>
           );
      }

      switch (assessment) {
          case 'EXCELLENT':
              return (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <TrendingUp size={12} /> Sangat Aktif
                  </span>
              );
          case 'GOOD':
              return (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Activity size={12} /> Aktif
                  </span>
              );
          case 'FAIR':
              return (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                      <Minus size={12} /> Cukup
                  </span>
              );
          case 'POOR':
              return (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <TrendingDown size={12} /> Jarang Hadir
                  </span>
              );
          default:
              return <span className="text-xs text-gray-400 italic">Belum ada data</span>;
      }
  };

  // --- MEMBER RECAP DETAIL ---
  const handleMemberRecapClick = (member: Member) => {
      setDetailMember(member);
      setIsDetailModalOpen(true);
  }

  // --- CRUD HANDLERS ---
  const handleOpenModal = (event?: Event) => {
    setInviteeSearch(''); // Reset Search
    setIsInviteExpanded(false); // Reset Expansion

    if (event) {
      setEditingItem(event);
      setName(event.name);
      
      const dt = new Date(event.date);
      setDate(dt.toISOString().split('T')[0]);
      // Handle local time extraction properly
      const hours = dt.getHours().toString().padStart(2, '0');
      const minutes = dt.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
      
      setLocation(event.location || '');
      setDescription(event.description || '');
      setStatus(event.status);
      setLateTolerance(event.late_tolerance || 15);
      
      // Populate Invited Members from Attendance Records
      const existingInvitees = attendance
        .filter(a => a.event_id === event.id)
        .map(a => a.member_id);
      
      setSelectedInvitees(existingInvitees);
      setInviteType('SELECT'); 

    } else {
      setEditingItem(null);
      setName('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('09:00');
      setLocation('');
      setDescription('');
      setStatus('Upcoming');
      setLateTolerance(15);
      setInviteType('ALL');
      setSelectedInvitees([]);
    }
    setIsModalOpen(true);
  };

  const toggleInvitee = (id: string) => {
    setSelectedInvitees(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
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
      late_tolerance: lateTolerance
    };

    if (!editingItem && activeFoundation) {
        payload.foundation_id = activeFoundation.id;
    }

    try {
      let eventId = editingItem?.id;

      if (editingItem) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingItem.id);
        if (error) throw error;
        showToast('Acara berhasil diperbarui', 'success');
      } else {
        const { data: newEvent, error } = await supabase.from('events').insert([payload]).select().single();
        if (error) throw error;
        eventId = newEvent.id;
        showToast('Acara berhasil dibuat', 'success');
      }

      // --- Handle Attendance Sync Logic (Create & Edit) ---
      if (eventId) {
          let targetMemberIds: string[] = [];
          const validMembers = members.filter(m => m.division_id);

          if (inviteType === 'ALL') {
              targetMemberIds = validMembers.map(m => m.id);
          } else {
              targetMemberIds = selectedInvitees;
          }

          if (editingItem) {
              // --- EDIT MODE SYNC ---
              const currentRecords = attendance.filter(a => a.event_id === eventId);
              const currentMemberIds = currentRecords.map(a => a.member_id);
              const toAdd = targetMemberIds.filter(mid => !currentMemberIds.includes(mid));
              const toRemove = currentMemberIds.filter(mid => !targetMemberIds.includes(mid));

              if (toAdd.length > 0) {
                  const addPayload = toAdd.map(mid => ({
                      event_id: eventId,
                      member_id: mid,
                      status: 'Absent'
                  }));
                  await supabase.from('event_attendance').insert(addPayload);
              }

              if (toRemove.length > 0) {
                  await supabase.from('event_attendance')
                      .delete()
                      .eq('event_id', eventId)
                      .in('member_id', toRemove);
              }

          } else {
              // --- CREATE MODE INSERT ---
              if (targetMemberIds.length > 0) {
                  const attendancePayload = targetMemberIds.map(mid => ({
                      event_id: eventId,
                      member_id: mid,
                      status: 'Absent'
                  }));
                  
                  await supabase.from('event_attendance').insert(attendancePayload);
              }
          }
      }

      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      showToast('Gagal menyimpan acara: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (id: string) => {
      setDeleteConfirm({ isOpen: true, id });
  }

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      
      if (selectedEvent?.id === deleteConfirm.id) {
          setView('LIST');
          setSelectedEvent(null);
      }
      
      showToast('Acara berhasil dihapus', 'success');
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) {
      showToast('Gagal menghapus acara: ' + error.message, 'error');
    }
  };

  // --- WA GENERATOR LOGIC ---
  const copyWaText = () => {
    navigator.clipboard.writeText(waText);
    setWaCopied(true);
    setTimeout(() => setWaCopied(false), 2000);
  };

  const handleGenerateWA = (event: Event) => {
      const eventDate = new Date(event.date);
      const dateStr = eventDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = eventDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      // 1. Get Invited Members
      const invitedMemberIds = attendance.filter(a => a.event_id === event.id).map(a => a.member_id);
      const invitedMembers = members.filter(m => invitedMemberIds.includes(m.id));

      // 2. Group by Division (Priority) or Role
      const grouped: Record<string, string[]> = {};
      
      invitedMembers.forEach(m => {
          let key = m.divisions?.name;
          const roleName = m.roles?.name || '';
          if (roleName.toLowerCase().includes('pembina') || roleName.toLowerCase().includes('ketua')) {
              key = roleName;
          } else if (!key) {
              key = roleName || 'Peserta Lainnya';
          }

          if (!grouped[key]) grouped[key] = [];
          let name = m.full_name;
          if (m.gender === 'L') name = `Bp. ${name}`;
          else if (m.gender === 'P') name = `Ibu/Sdri. ${name}`;
          
          grouped[key].push(name);
      });

      // 3. Build Text
      let text = `┏🎓📚🕌━━━━━━┓\n    ${event.name.toUpperCase()}\n┗━━━━━━🕌📚🎓┛\n\n`;
      text += `‎*السلام عليكم ورحمة الله وبركاته*\n\n`;
      text += `Dimohon Amal Sholih Kehadirannya dalam ${event.name} pada :\n\n`;
      text += `📅 ${dateStr}\n`;
      text += `⏰ Pukul : ${timeStr} WIB s/d Selesai\n`;
      text += `🕋 Tempat : ${event.location || 'Tempat menyusul'}\n\n`;
      text += `--------------------------------\n`;
      text += `*DAFTAR UNDANGAN:*\n\n`;

      const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

      sortedKeys.forEach(key => {
          let icon = '👥';
          const kLow = key.toLowerCase();
          if (kLow.includes('pembina')) icon = '👳‍♂';
          else if (kLow.includes('ketua')) icon = '🤵';
          else if (kLow.includes('tahfidz')) icon = '🕌';
          
          text += `${icon} *${key}*\n`;
          grouped[key].forEach(name => text += `${name}\n`);
          text += `\n`;
      });

      text += `Atas kehadiran dan amal sholihnya di syukuri\n\n`;
      text += `‎*الحمد لله جزا كم الله خيرا*\n`;
      text += `‎ والسلام عليكم ورحمة الله وبركاته\n\n`;
      text += `TTD Pengurus\n${activeFoundation?.name || 'Yayasan'}`;

      setWaText(text);
      setWaModalOpen(true);
      setWaCopied(false);
  };

  // --- START EVENT HANDLER ---
  const handleStartEvent = async () => {
      if(!selectedEvent) return;
      
      const now = new Date().toISOString();
      
      try {
          const { error } = await supabase.from('events').update({
              actual_start_time: now
          }).eq('id', selectedEvent.id);

          if(error) throw error;
          showToast('Absensi resmi dibuka!', 'success');
          onRefresh();
          // Update local state immediately for better UX
          setSelectedEvent({...selectedEvent, actual_start_time: now});
      } catch (error: any) {
          showToast('Gagal memulai event: ' + error.message, 'error');
      }
  }

  // --- ATTENDANCE HANDLERS ---
  const openAttendance = (event: Event) => {
    setSelectedEvent(event);
    setView('ATTENDANCE');
    setAttendanceSearch('');
    setAttendanceStatusFilter('ALL');
    setShowUninvited(false); // Reset to hide uninvited
  };

  const handleAttendanceChange = async (memberId: string, newStatus: 'Present' | 'Absent' | 'Excused') => {
    if (!selectedEvent) return;

    try {
       const updateData: any = { 
            event_id: selectedEvent.id, 
            member_id: memberId, 
            status: newStatus,
        };

        // IF Present, record current time
        if (newStatus === 'Present') {
            updateData.check_in_time = new Date().toISOString();
        }

       const { error } = await supabase
        .from('event_attendance')
        .upsert(updateData, { onConflict: 'event_id, member_id' });
        
       if (error) throw error;
       showToast(`Status diperbarui: ${newStatus}`, 'success');
       onRefresh(); 
    } catch (error: any) {
        showToast('Gagal update absensi: ' + error.message, 'error');
    }
  };

  const handleResetStatus = async (memberId: string) => {
      if (!selectedEvent) return;
      try {
          const { error } = await supabase
            .from('event_attendance')
            .delete()
            .match({ event_id: selectedEvent.id, member_id: memberId });
          
          if (error) throw error;
          showToast('Data absensi direset', 'success');
          onRefresh();
      } catch (error: any) {
          showToast('Gagal reset absensi: ' + error.message, 'error');
      }
  }

  const getAttendanceStats = (eventId: string) => {
    const eventAtt = attendance.filter(a => a.event_id === eventId);
    const present = eventAtt.filter(a => a.status === 'Present').length;
    const excused = eventAtt.filter(a => a.status === 'Excused').length;
    const absent = eventAtt.filter(a => a.status === 'Absent').length;
    return { present, excused, absent, total: eventAtt.length };
  };

  // Helper to determine detailed status label
  const getDetailedStatus = (record: EventAttendance | undefined, event: Event) => {
      if (!record || !record.status) return null;
      if (record.status !== 'Present') return { label: record.status === 'Excused' ? 'Izin' : 'Alpha', color: record.status === 'Excused' ? 'yellow' : 'red' };

      // If Present, calculate timing
      if (!record.check_in_time) return { label: 'Hadir (Manual)', color: 'green' };

      const scheduleTime = new Date(event.date).getTime();
      const checkInTime = new Date(record.check_in_time).getTime();
      const diffMinutes = Math.floor((checkInTime - scheduleTime) / 60000);
      const tolerance = event.late_tolerance || 15;

      if (diffMinutes <= 0) return { label: 'Tepat Waktu', color: 'green' };
      if (diffMinutes <= tolerance) return { label: `Telat Wajar (${diffMinutes}m)`, color: 'yellow' };
      return { label: `Telat (${diffMinutes}m)`, color: 'red' };
  };

  // Filter Members Logic
  const filteredMembers = members
    .filter(m => m.division_id) 
    .filter(m => {
        const hasRecord = attendance.some(a => a.event_id === selectedEvent?.id && a.member_id === m.id);
        if (showUninvited) return true;
        return hasRecord;
    })
    .filter(m => m.full_name.toLowerCase().includes(attendanceSearch.toLowerCase()))
    .filter(m => {
        if (attendanceStatusFilter === 'ALL') return true;
        const record = attendance.find(a => a.event_id === selectedEvent?.id && a.member_id === m.id);
        const currentStatus = record?.status;
        if (attendanceStatusFilter === 'Unrecorded') return !currentStatus;
        return currentStatus === attendanceStatusFilter;
    });

  const sortedEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const chartData = selectedEvent ? [
      { name: 'Hadir', value: getAttendanceStats(selectedEvent.id).present, color: '#22c55e' },
      { name: 'Izin', value: getAttendanceStats(selectedEvent.id).excused, color: '#eab308' },
      { name: 'Alpha', value: getAttendanceStats(selectedEvent.id).absent, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  return (
    <div ref={containerRef} className={`transition-all duration-300 ${isFullScreen ? 'bg-gray-50 dark:bg-dark-bg p-8 overflow-y-auto h-screen w-screen' : ''}`}>
      
      {/* Toast Notification */}
      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="text-sm font-medium">{toast.message}</span>
          </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
             {(view === 'ATTENDANCE' || view === 'RECAP') && (
                 <button 
                    onClick={() => setView('LIST')}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:text-primary-600 transition"
                >
                    <ChevronLeft size={24} />
                </button>
             )}
             <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <CalendarDays className="text-primary-600 dark:text-primary-400" /> 
                {view === 'ATTENDANCE' && selectedEvent ? `Absensi: ${selectedEvent.name}` : 
                 view === 'RECAP' ? 'Rekap & Evaluasi Kehadiran' : 'Agenda & Acara'}
            </h2>
          </div>

          <div className="flex gap-2">
             <button
                onClick={toggleFullScreen}
                className="bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:text-primary-600 border border-gray-200 dark:border-gray-600 px-3 py-2 rounded-lg flex items-center gap-2 transition"
                title={isFullScreen ? "Keluar Full Screen" : "Full Screen"}
             >
                {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                <span className="hidden sm:inline">{isFullScreen ? 'Minimize' : 'Full Screen'}</span>
             </button>
             
             {view === 'LIST' && (
                 <button 
                    onClick={() => setView('RECAP')}
                    className="bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:text-primary-600 border border-gray-200 dark:border-gray-600 px-3 py-2 rounded-lg flex items-center gap-2 transition"
                 >
                    <BarChart3 size={18} /> Rekap & Evaluasi
                 </button>
             )}

             {!isSuperAdmin && view === 'LIST' && (
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                >
                    <Plus size={18} /> Buat Acara
                </button>
             )}
          </div>
      </div>

      {/* --- RENDER VIEW: LIST --- */}
      {view === 'LIST' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {sortedEvents.map(item => {
            const stats = getAttendanceStats(item.id);
            const eventDate = new Date(item.date);
            const isStarted = !!item.actual_start_time;

            return (
              <div key={item.id} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden hover:shadow-md transition flex flex-col">
                <div className={`h-2 w-full ${item.status === 'Upcoming' ? 'bg-blue-500' : item.status === 'Completed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wide ${
                        item.status === 'Upcoming' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        item.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                        {item.status}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={() => handleGenerateWA(item)} className="text-green-500 hover:text-green-700 dark:text-green-400" title="Undangan WA"><MessageCircle size={18} /></button>
                        {!isSuperAdmin && (
                            <>
                                <button onClick={() => handleOpenModal(item)} className="text-gray-400 hover:text-blue-600"><Edit size={16}/></button>
                                <button onClick={() => confirmDelete(item.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </>
                        )}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 flex items-center gap-2">
                      {item.name}
                      {isStarted && item.status === 'Upcoming' && <span className="animate-pulse w-2 h-2 rounded-full bg-green-500" title="Sedang Berlangsung"></span>}
                  </h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                     <div className="flex items-center gap-2">
                        <CalendarDays size={14} /> 
                        <span>{eventDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Clock size={14} /> 
                        <span>{eventDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                     </div>
                     {item.location && <div className="flex items-center gap-2"><MapPin size={14} /> <span className="truncate">{item.location}</span></div>}
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                     <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span>Kehadiran:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{stats.present} Hadir</span>
                     </div>
                     <button 
                        onClick={() => openAttendance(item)}
                        className="w-full py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-600 transition"
                     >
                        <ClipboardCheck size={16} /> {isSuperAdmin ? 'Lihat Absensi' : (isStarted ? 'Kelola Absensi' : 'Buka Absensi')}
                     </button>
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">Belum ada acara.</div>}
        </div>
      )}

      {/* --- RENDER VIEW: RECAP --- */}
      {view === 'RECAP' && (
          <div className="animate-in fade-in duration-300">
             <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-white">Rekapitulasi Kehadiran Anggota</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Analisis keaktifan anggota berdasarkan periode.</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                            {/* FILTERS */}
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                                <Filter size={16} className="text-gray-400"/>
                                <select 
                                    value={recapFilterType}
                                    onChange={(e) => setRecapFilterType(e.target.value as any)}
                                    className="bg-transparent text-sm text-gray-700 dark:text-white outline-none font-medium"
                                >
                                    <option value="ALL">Semua Waktu</option>
                                    <option value="YEAR">Per Tahun</option>
                                    <option value="MONTH">Per Bulan</option>
                                </select>
                            </div>

                            {(recapFilterType === 'YEAR' || recapFilterType === 'MONTH') && (
                                <select 
                                    value={recapYear}
                                    onChange={(e) => setRecapYear(Number(e.target.value))}
                                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white outline-none"
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            )}

                            {recapFilterType === 'MONTH' && (
                                <select 
                                    value={recapMonth}
                                    onChange={(e) => setRecapMonth(Number(e.target.value))}
                                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white outline-none"
                                >
                                    {allMonths.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                                </select>
                            )}

                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Cari anggota..." 
                                    value={recapSearch}
                                    onChange={(e) => setRecapSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* NEW: SUMMARY CARDS */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800 text-center">
                            <p className="text-xs text-green-700 dark:text-green-300 font-semibold uppercase">Sangat Aktif</p>
                            <p className="text-2xl font-bold text-green-800 dark:text-green-100">{recapSummary.EXCELLENT}</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                            <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold uppercase">Aktif</p>
                            <p className="text-2xl font-bold text-blue-800 dark:text-blue-100">{recapSummary.GOOD}</p>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 text-center">
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold uppercase">Cukup</p>
                            <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-100">{recapSummary.FAIR}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800 text-center">
                            <p className="text-xs text-red-700 dark:text-red-300 font-semibold uppercase">Jarang Hadir</p>
                            <p className="text-2xl font-bold text-red-800 dark:text-red-100">{recapSummary.POOR}</p>
                        </div>
                        <div className="bg-red-900 text-white p-3 rounded-lg border border-red-800 text-center">
                            <p className="text-xs text-red-200 font-semibold uppercase">Nihil Hadir</p>
                            <p className="text-2xl font-bold text-white">{recapSummary.NEVER}</p>
                        </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Nama Anggota</th>
                                <th className="px-6 py-4">Bidang</th>
                                <th className="px-6 py-4 text-center">Undangan</th>
                                <th className="px-6 py-4 text-center">Hadir</th>
                                <th className="px-6 py-4 text-center">Izin / Alpha</th>
                                <th className="px-6 py-4">Persentase</th>
                                <th className="px-6 py-4">Penilaian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border text-sm">
                            {memberAttendanceStats.map(member => (
                                <tr 
                                    key={member.id} 
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group"
                                    onClick={() => handleMemberRecapClick(member as unknown as Member)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{member.full_name}</div>
                                        <div className="text-xs text-gray-500">{member.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                        {member.divisions?.name || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center font-medium">
                                        {member.stats.totalInvited}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-green-600 font-bold">{member.stats.present}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-500">
                                        {member.stats.excused} / <span className="text-red-500">{member.stats.absent}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${
                                                        member.stats.percentage >= 80 ? 'bg-green-500' : 
                                                        member.stats.percentage >= 50 ? 'bg-blue-500' : 'bg-red-500'
                                                    }`} 
                                                    style={{ width: `${member.stats.percentage}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs font-semibold">{Math.round(member.stats.percentage)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getAssessmentBadge(member.stats.assessment, member.stats)}
                                    </td>
                                </tr>
                            ))}
                             {memberAttendanceStats.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        Tidak ada data untuk filter ini.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
      )}

      {/* --- RENDER VIEW: ATTENDANCE --- */}
      {view === 'ATTENDANCE' && selectedEvent && (
        <div className="space-y-6 animate-in slide-in-from-right-10 duration-300">
            {/* START EVENT OVERLAY / INFO */}
            {!selectedEvent.actual_start_time && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-200 dark:border-indigo-800 text-center flex flex-col items-center">
                    <Timer size={48} className="text-indigo-500 mb-2"/>
                    <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200">Acara Belum Dimulai</h3>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4 max-w-lg">
                        Jadwal: {new Date(selectedEvent.date).toLocaleString('id-ID')}.<br/>
                        Buka absensi untuk memulai pencatatan waktu kehadiran real-time. Sistem akan menghitung keterlambatan berdasarkan waktu klik "Hadir".
                    </p>
                    <button 
                        onClick={handleStartEvent}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-transform hover:scale-105"
                    >
                        <PlayCircle size={20}/> Buka Absensi Sekarang
                    </button>
                </div>
            )}

            {selectedEvent.actual_start_time && (
                <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-dark-border flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                            <Activity size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Status Acara</p>
                            <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                Berlangsung <span className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></span>
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Waktu Buka Absen</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {new Date(selectedEvent.actual_start_time).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                            </p>
                            {/* Calculate Admin Delay */}
                            {(() => {
                                const schedule = new Date(selectedEvent.date).getTime();
                                const actual = new Date(selectedEvent.actual_start_time).getTime();
                                const delay = Math.floor((actual - schedule) / 60000);
                                if (delay > 5) return <span className="text-[10px] text-red-500">(Admin Telat {delay}m)</span>;
                                return null;
                            })()}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg">
                            <Timer size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Toleransi Telat</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {selectedEvent.late_tolerance || 15} Menit
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stats Card */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Statistik Kehadiran</h3>
                    <div className="h-48 w-full flex items-center justify-center">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <ReTooltip />
                                    <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right"/>
                                </RePieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-sm text-gray-400 italic">Belum ada data</p>
                        )}
                    </div>
                </div>

                {/* Main List */}
                <div className="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex flex-col h-[600px]">
                    <div className="p-4 border-b border-gray-100 dark:border-dark-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <div className="flex gap-2">
                            <select 
                                className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm rounded-lg px-3 py-2 outline-none dark:text-white"
                                value={attendanceStatusFilter}
                                onChange={(e) => setAttendanceStatusFilter(e.target.value as any)}
                            >
                                <option value="ALL">Semua Status</option>
                                <option value="Present">Hadir</option>
                                <option value="Excused">Izin</option>
                                <option value="Absent">Alpha/Belum</option>
                                <option value="Unrecorded">Belum Diabsen</option>
                            </select>
                            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer bg-gray-50 dark:bg-gray-800 px-3 rounded-lg border border-gray-200 dark:border-gray-700 select-none">
                                <input 
                                    type="checkbox" 
                                    checked={showUninvited} 
                                    onChange={() => setShowUninvited(!showUninvited)}
                                    className="rounded text-primary-600 focus:ring-primary-500"
                                />
                                Tampilkan Semua Anggota
                            </label>
                         </div>
                         <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input 
                                type="text" 
                                placeholder="Cari nama..." 
                                value={attendanceSearch}
                                onChange={(e) => setAttendanceSearch(e.target.value)}
                                className="w-full sm:w-48 pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-2">
                        {filteredMembers.length > 0 ? (
                            <div className="space-y-2">
                                {filteredMembers.map(m => {
                                    const record = attendance.find(a => a.event_id === selectedEvent.id && a.member_id === m.id);
                                    const status = record?.status;
                                    const isStarted = !!selectedEvent.actual_start_time;
                                    
                                    // Detailed Status Calculation for UI
                                    const detailStatus = getDetailedStatus(record, selectedEvent);

                                    return (
                                        <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    status === 'Present' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                                    status === 'Excused' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    status === 'Absent' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                                    'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                                }`}>
                                                    {m.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white text-sm">{m.full_name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{m.divisions?.name || '-'}</p>
                                                        {detailStatus && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                                                detailStatus.color === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                detailStatus.color === 'yellow' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                detailStatus.color === 'red' ? 'bg-red-50 text-red-700 border-red-200' : ''
                                                            }`}>
                                                                {detailStatus.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => handleAttendanceChange(m.id, 'Present')}
                                                    className={`p-2 rounded-lg transition ${status === 'Present' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20'}`}
                                                    title={!isStarted ? "Buka absensi dulu" : "Hadir (Now)"}
                                                    disabled={!isStarted}
                                                >
                                                    <CheckCircle2 size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleAttendanceChange(m.id, 'Excused')}
                                                    className={`p-2 rounded-lg transition ${status === 'Excused' ? 'bg-yellow-500 text-white shadow-md' : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 dark:hover:bg-yellow-900/20'}`}
                                                    title="Izin"
                                                    disabled={!isStarted}
                                                >
                                                    <HelpCircle size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleAttendanceChange(m.id, 'Absent')}
                                                    className={`p-2 rounded-lg transition ${status === 'Absent' ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20'}`}
                                                    title="Alpha/Belum Hadir"
                                                    disabled={!isStarted}
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                                {status && (
                                                    <button 
                                                        onClick={() => handleResetStatus(m.id)}
                                                        className="ml-2 p-1 text-gray-300 hover:text-red-400 transition"
                                                        title="Hapus dari daftar"
                                                        disabled={!isStarted}
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                                <Users size={32} className="mb-2 opacity-50"/>
                                <p>Tidak ada anggota ditemukan.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {/* ... (Rest of Modal components unchanged) ... */}
      
      {/* --- WA GENERATOR MODAL --- */}
      <Modal 
        isOpen={waModalOpen} 
        onClose={() => setWaModalOpen(false)} 
        title="Buat Undangan WhatsApp"
        size="lg"
      >
          <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800">
                  <p>Salin teks di bawah ini dan tempelkan ke grup WhatsApp.</p>
              </div>
              <textarea 
                  className="w-full h-96 p-4 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 dark:text-gray-300 focus:outline-none resize-none"
                  value={waText}
                  onChange={(e) => setWaText(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                  <button 
                      onClick={() => setWaModalOpen(false)}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800"
                  >
                      Tutup
                  </button>
                  <button 
                      onClick={copyWaText}
                      className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                      {waCopied ? <Check size={16}/> : <Copy size={16}/>}
                      {waCopied ? 'Tersalin' : 'Salin Teks'}
                  </button>
              </div>
          </div>
      </Modal>

      {/* --- RECAP MEMBER DETAIL MODAL --- */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`History Kehadiran: ${detailMember?.full_name || ''}`}
        size="lg"
      >
          <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                  <div>
                      <p className="text-gray-500 dark:text-gray-400">Periode Laporan:</p>
                      <p className="font-bold text-gray-800 dark:text-white">
                          {recapFilterType === 'ALL' ? 'Semua Waktu' : 
                           recapFilterType === 'YEAR' ? `Tahun ${recapYear}` : 
                           `Bulan ${allMonths[recapMonth]} ${recapYear}`}
                      </p>
                  </div>
                  {(detailMember as any)?.stats && (
                      <div className="flex gap-4 mt-2 sm:mt-0">
                          <div className="text-center">
                              <p className="text-xs text-gray-500">Hadir</p>
                              <p className="font-bold text-green-600">{(detailMember as any).stats.present}</p>
                          </div>
                          <div className="text-center">
                              <p className="text-xs text-gray-500">Izin</p>
                              <p className="font-bold text-yellow-600">{(detailMember as any).stats.excused}</p>
                          </div>
                          <div className="text-center">
                              <p className="text-xs text-gray-500">Alpha</p>
                              <p className="font-bold text-red-600">{(detailMember as any).stats.absent}</p>
                          </div>
                      </div>
                  )}
              </div>

              <div className="max-h-[50vh] overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 sticky top-0">
                          <tr>
                              <th className="px-4 py-2">Tanggal</th>
                              <th className="px-4 py-2">Nama Acara</th>
                              <th className="px-4 py-2 text-right">Status</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {((detailMember as any)?.stats?.records || []).map((rec: EventAttendance) => {
                              const ev = events.find(e => e.id === rec.event_id);
                              // Detail calc for history row
                              const det = ev ? getDetailedStatus(rec, ev) : null;

                              return (
                                  <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                          {ev ? new Date(ev.date).toLocaleDateString('id-ID') : '-'}
                                      </td>
                                      <td className="px-4 py-2 font-medium text-gray-800 dark:text-white">
                                          {ev?.name || 'Unknown Event'}
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                          {det ? (
                                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                  det.color === 'green' ? 'bg-green-100 text-green-700' :
                                                  det.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                                  'bg-red-100 text-red-700'
                                              }`}>
                                                  {det.label}
                                              </span>
                                          ) : (
                                              <span className="text-gray-400">-</span>
                                          )}
                                      </td>
                                  </tr>
                              );
                          })}
                          {(!((detailMember as any)?.stats?.records) || ((detailMember as any)?.stats?.records.length === 0)) && (
                              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 italic">Tidak ada data kehadiran pada periode ini.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
              
              <div className="flex justify-end pt-2">
                  <button onClick={() => setIsDetailModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm">
                      Tutup
                  </button>
              </div>
          </div>
      </Modal>

      {/* Modal Form for Creating/Editing Events */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Acara' : 'Buat Acara Baru'}>
        <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Acara</label>
                <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none" 
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal</label>
                    <input 
                        type="date" 
                        required 
                        value={date} 
                        onChange={e => setDate(e.target.value)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Jam</label>
                    <input 
                        type="time" 
                        required 
                        value={time} 
                        onChange={e => setTime(e.target.value)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none" 
                    />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Lokasi</label>
                <input 
                    type="text" 
                    value={location} 
                    onChange={e => setLocation(e.target.value)} 
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none" 
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value as any)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
                    >
                        <option value="Upcoming">Upcoming (Akan Datang)</option>
                        <option value="Completed">Completed (Selesai)</option>
                        <option value="Cancelled">Cancelled (Dibatalkan)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Toleransi Telat (Menit)</label>
                    <input 
                        type="number"
                        min="0"
                        value={lateTolerance} 
                        onChange={e => setLateTolerance(Number(e.target.value))} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none" 
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi</label>
                <textarea 
                    rows={3} 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none" 
                />
            </div>
            
            <div className={`bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 transition-all duration-300 ${isInviteExpanded ? 'fixed inset-4 z-50 bg-white dark:bg-dark-card shadow-2xl overflow-hidden flex flex-col' : ''}`}>
                <div className="flex justify-between items-center mb-2 shrink-0">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pilih Peserta Undangan</label>
                    <button 
                        type="button" 
                        onClick={() => setIsInviteExpanded(!isInviteExpanded)}
                        className="text-gray-500 hover:text-primary-600 p-1"
                        title={isInviteExpanded ? "Kecilkan" : "Perbesar"}
                    >
                        {isInviteExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-3 shrink-0">
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input 
                            type="radio" 
                            checked={inviteType === 'ALL'} 
                            onChange={() => setInviteType('ALL')}
                            className="text-primary-600 focus:ring-primary-500" 
                            />
                            Semua Anggota
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input 
                            type="radio" 
                            checked={inviteType === 'SELECT'} 
                            onChange={() => setInviteType('SELECT')}
                            className="text-primary-600 focus:ring-primary-500" 
                            />
                            Pilih Tertentu
                        </label>
                    </div>
                    {inviteType === 'SELECT' && (
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input 
                                type="text"
                                placeholder="Cari nama anggota..."
                                value={inviteeSearch}
                                onChange={(e) => setInviteeSearch(e.target.value)}
                                className="w-full pl-9 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:border-primary-500"
                            />
                        </div>
                    )}
                </div>
                
                {inviteType === 'SELECT' && (
                    <div className={`overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 p-2 space-y-1 ${isInviteExpanded ? 'flex-1' : 'max-h-40'}`}>
                        {members
                            .filter(m => m.division_id)
                            .filter(m => m.full_name.toLowerCase().includes(inviteeSearch.toLowerCase()))
                            .map(m => (
                            <label key={m.id} className="flex items-center gap-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                                <input 
                                type="checkbox"
                                checked={selectedInvitees.includes(m.id)}
                                onChange={() => toggleInvitee(m.id)}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{m.full_name} <span className="text-xs text-gray-400">({m.divisions?.name})</span></span>
                            </label>
                        ))}
                        {members.filter(m => m.division_id).length === 0 && <p className="text-xs text-gray-400 p-2">Tidak ada anggota yang memiliki bidang.</p>}
                    </div>
                )}
                {!isInviteExpanded && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {editingItem 
                        ? "*Menghapus centang akan MENGHAPUS data absensi anggota tersebut."
                        : "*Hanya anggota yang dipilih yang akan muncul di daftar absensi (Status awal: Alpha)."}
                    </p>
                )}
            </div>

            <div className="pt-4 flex justify-end gap-3">
                <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                    Batal
                </button>
                <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
            </div>
        </form>
      </Modal>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <Modal 
        isOpen={deleteConfirm.isOpen} 
        onClose={() => setDeleteConfirm({isOpen: false, id: null})} 
        title="Konfirmasi Hapus"
      >
        <div className="text-center sm:text-left">
          <div className="flex flex-col items-center gap-4 mb-4">
             <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
               <AlertTriangle size={32} />
             </div>
             <div>
                <p className="text-gray-700 dark:text-gray-300">
                  Apakah Anda yakin ingin menghapus acara ini?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Semua data absensi terkait acara ini akan ikut terhapus permanen.
                </p>
             </div>
          </div>
          <div className="flex justify-center sm:justify-end gap-3 mt-6">
            <button
              onClick={() => setDeleteConfirm({isOpen: false, id: null})}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Batal
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
