import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Event, EventAttendance, Member, Foundation } from '../types';
import { 
  Plus, Edit, Trash2, CalendarDays, MapPin, 
  ClipboardCheck, CheckCircle2, XCircle, HelpCircle, 
  Clock, Search, ChevronLeft, Maximize2, Minimize2, PieChart, Users, AlertTriangle, Filter, RotateCcw, UserPlus,
  BarChart3, Activity, TrendingUp, TrendingDown, Minus, MessageCircle, Copy, Check
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
  
  // WA Generator State
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waText, setWaText] = useState('');
  const [waCopied, setWaCopied] = useState(false);
  
  // Participant Selection State
  const [inviteType, setInviteType] = useState<'ALL' | 'SELECT'>('ALL');
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  // Attendance Filter State
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'Present' | 'Excused' | 'Absent' | 'Unrecorded'>('ALL');
  const [showUninvited, setShowUninvited] = useState(false); // Toggle to show members not in the list

  // Recap Filter State
  const [recapSearch, setRecapSearch] = useState('');

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
      // Only include members who have a division (Active members)
      const activeMembers = members.filter(m => m.division_id);

      return activeMembers.map(member => {
          // Find all attendance records for this member
          const myAttendance = attendance.filter(a => a.member_id === member.id);
          
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
              stats: { totalInvited, present, excused, absent, percentage, assessment }
          };
      }).filter(m => 
          m.full_name.toLowerCase().includes(recapSearch.toLowerCase()) || 
          m.divisions?.name.toLowerCase().includes(recapSearch.toLowerCase())
      ).sort((a, b) => b.stats.percentage - a.stats.percentage); // Sort by highest attendance
  }, [members, attendance, recapSearch]);

  const getAssessmentBadge = (assessment: string) => {
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


  // --- CRUD HANDLERS ---
  const handleOpenModal = (event?: Event) => {
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
      
      // Populate Invited Members from Attendance Records
      const existingInvitees = attendance
        .filter(a => a.event_id === event.id)
        .map(a => a.member_id);
      
      setSelectedInvitees(existingInvitees);
      // Set to SELECT mode so user sees the checklist. 
      // If we assume "ALL" logic was dynamic, this might convert it to static list which is safer for edits.
      setInviteType('SELECT'); 

    } else {
      setEditingItem(null);
      setName('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('09:00');
      setLocation('');
      setDescription('');
      setStatus('Upcoming');
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
      status
    };

    // Attach foundation ID for new events
    if (!editingItem && activeFoundation) {
        payload.foundation_id = activeFoundation.id;
    }

    try {
      let eventId = editingItem?.id;

      if (editingItem) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { data: newEvent, error } = await supabase.from('events').insert([payload]).select().single();
        if (error) throw error;
        eventId = newEvent.id;
      }

      // --- Handle Attendance Sync Logic (Create & Edit) ---
      if (eventId) {
          // 1. Determine Target List
          let targetMemberIds: string[] = [];
          const validMembers = members.filter(m => m.division_id);

          if (inviteType === 'ALL') {
              targetMemberIds = validMembers.map(m => m.id);
          } else {
              targetMemberIds = selectedInvitees;
          }

          if (editingItem) {
              // --- EDIT MODE SYNC ---
              // Get current records from state (assuming attendance prop is up to date, or fetch freshly if critical)
              const currentRecords = attendance.filter(a => a.event_id === eventId);
              const currentMemberIds = currentRecords.map(a => a.member_id);

              // Determine Additions
              const toAdd = targetMemberIds.filter(mid => !currentMemberIds.includes(mid));
              
              // Determine Removals
              const toRemove = currentMemberIds.filter(mid => !targetMemberIds.includes(mid));

              // Bulk Insert New
              if (toAdd.length > 0) {
                  const addPayload = toAdd.map(mid => ({
                      event_id: eventId,
                      member_id: mid,
                      status: 'Absent'
                  }));
                  const { error: addErr } = await supabase.from('event_attendance').insert(addPayload);
                  if (addErr) console.error("Error adding members:", addErr);
              }

              // Bulk Delete Removed
              if (toRemove.length > 0) {
                  const { error: delErr } = await supabase.from('event_attendance')
                      .delete()
                      .eq('event_id', eventId)
                      .in('member_id', toRemove);
                  if (delErr) console.error("Error removing members:", delErr);
              }

          } else {
              // --- CREATE MODE INSERT ---
              if (targetMemberIds.length > 0) {
                  const attendancePayload = targetMemberIds.map(mid => ({
                      event_id: eventId,
                      member_id: mid,
                      status: 'Absent'
                  }));
                  
                  const { error: attError } = await supabase.from('event_attendance').insert(attendancePayload);
                  if (attError) console.error("Error creating initial attendance:", attError);
              }
          }
      }

      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      alert('Error: ' + error.message);
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
      
      // Jika yang dihapus adalah event yang sedang dilihat, kembali ke list
      if (selectedEvent?.id === deleteConfirm.id) {
          setView('LIST');
          setSelectedEvent(null);
      }
      
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) {
      alert('Error: ' + error.message);
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
          
          // Special handling for Key Roles if no division or prioritized
          const roleName = m.roles?.name || '';
          if (roleName.toLowerCase().includes('pembina') || roleName.toLowerCase().includes('ketua')) {
              key = roleName; // Use Role Name for top hierarchy
          } else if (!key) {
              key = roleName || 'Peserta Lainnya';
          }

          if (!grouped[key]) grouped[key] = [];
          
          // Format Name
          let name = m.full_name;
          // Optional: Add Prefix based on Gender if available
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

      // Sort Keys: Put Pembina/Ketua first if possible (basic alphabetic sort or custom logic)
      const sortedKeys = Object.keys(grouped).sort((a, b) => {
          const rank = (k: string) => {
              const kLow = k.toLowerCase();
              if (kLow.includes('pembina')) return 1;
              if (kLow.includes('ketua')) return 2;
              if (kLow.includes('sekretaris')) return 3;
              if (kLow.includes('bendahara')) return 4;
              return 10; // Divisions last
          };
          return rank(a) - rank(b);
      });

      sortedKeys.forEach(key => {
          // Add Emoji based on key text
          let icon = '👥';
          const kLow = key.toLowerCase();
          if (kLow.includes('pembina')) icon = '👳‍♂';
          else if (kLow.includes('ketua')) icon = '🤵';
          else if (kLow.includes('sekretaris')) icon = '👨‍💻';
          else if (kLow.includes('bendahara')) icon = '👨‍💼';
          else if (kLow.includes('kurikulum')) icon = '👨‍🏫';
          else if (kLow.includes('pendidik')) icon = '👨‍🏫';
          else if (kLow.includes('dana')) icon = '👨‍🚒';
          else if (kLow.includes('kemandirian')) icon = '👨‍🏭';
          else if (kLow.includes('keputrian')) icon = '🧕';
          else if (kLow.includes('seni') || kLow.includes('or')) icon = '🏃‍♂';
          else if (kLow.includes('sarana')) icon = '👨‍🔧';
          else if (kLow.includes('tahfidz')) icon = '🕌';
          else if (kLow.includes('kmm')) icon = '👨‍🎓';
          
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
       const { error } = await supabase
        .from('event_attendance')
        .upsert(
            { 
                event_id: selectedEvent.id, 
                member_id: memberId, 
                status: newStatus 
            }, 
            { onConflict: 'event_id, member_id' }
        );
        
       if (error) throw error;
       onRefresh(); 
    } catch (error: any) {
        alert('Gagal update absensi: ' + error.message);
    }
  };

  const handleResetStatus = async (memberId: string) => {
      if (!selectedEvent) return;
      try {
          // This deletes the record, effectively "Un-inviting" them
          const { error } = await supabase
            .from('event_attendance')
            .delete()
            .match({ event_id: selectedEvent.id, member_id: memberId });
          
          if (error) throw error;
          onRefresh();
      } catch (error: any) {
          alert('Gagal reset absensi: ' + error.message);
      }
  }

  const getAttendanceStats = (eventId: string) => {
    const eventAtt = attendance.filter(a => a.event_id === eventId);
    const present = eventAtt.filter(a => a.status === 'Present').length;
    const excused = eventAtt.filter(a => a.status === 'Excused').length;
    const absent = eventAtt.filter(a => a.status === 'Absent').length;
    return { present, excused, absent, total: eventAtt.length };
  };

  // Filter Members Logic
  const filteredMembers = members
    .filter(m => m.division_id) // Requirement: Anggota tanpa bidang tidak ditampilkan
    .filter(m => {
        // Core Logic: Only show members who are in the invitation list (have a record)
        // UNLESS 'showUninvited' is enabled.
        const hasRecord = attendance.some(a => a.event_id === selectedEvent?.id && a.member_id === m.id);
        
        if (showUninvited) {
            return true; // Show everyone (invited + uninvited)
        }
        return hasRecord; // Only show invited
    })
    .filter(m => m.full_name.toLowerCase().includes(attendanceSearch.toLowerCase()))
    .filter(m => {
        if (attendanceStatusFilter === 'ALL') return true;
        const record = attendance.find(a => a.event_id === selectedEvent?.id && a.member_id === m.id);
        const currentStatus = record?.status;

        if (attendanceStatusFilter === 'Unrecorded') return !currentStatus;
        return currentStatus === attendanceStatusFilter;
    });

  // Sort events by date descending
  const sortedEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Chart Data for Attendance
  const chartData = selectedEvent ? [
      { name: 'Hadir', value: getAttendanceStats(selectedEvent.id).present, color: '#22c55e' },
      { name: 'Izin', value: getAttendanceStats(selectedEvent.id).excused, color: '#eab308' },
      { name: 'Alpha', value: getAttendanceStats(selectedEvent.id).absent, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  return (
    <div ref={containerRef} className={`transition-all duration-300 ${isFullScreen ? 'bg-gray-50 dark:bg-dark-bg p-8 overflow-y-auto h-screen w-screen' : ''}`}>
      
      {/* Header with Fullscreen Toggle */}
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
                        {/* WA Generator Button */}
                        <button 
                            onClick={() => handleGenerateWA(item)}
                            className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition"
                            title="Buat Undangan WA"
                        >
                            <MessageCircle size={18} />
                        </button>
                        
                        {!isSuperAdmin && (
                            <>
                                <button onClick={() => handleOpenModal(item)} className="text-gray-400 hover:text-blue-600"><Edit size={16}/></button>
                                <button onClick={() => confirmDelete(item.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </>
                        )}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 line-clamp-1">{item.name}</h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                     <div className="flex items-center gap-2">
                        <CalendarDays size={14} /> 
                        <span>{eventDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Clock size={14} /> 
                        <span>{eventDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                     </div>
                     {item.location && (
                        <div className="flex items-center gap-2">
                            <MapPin size={14} /> 
                            <span className="truncate">{item.location}</span>
                        </div>
                     )}
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
                        <ClipboardCheck size={16} /> {isSuperAdmin ? 'Lihat Absensi' : 'Kelola Absensi'}
                     </button>
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
             <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
                Belum ada acara yang dijadwalkan{activeFoundation ? ` untuk ${activeFoundation.name}` : ''}.
             </div>
          )}
        </div>
      )}

      {/* --- RENDER VIEW: RECAP --- */}
      {view === 'RECAP' && (
          <div className="animate-in fade-in duration-300">
             <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-gray-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-white">Rekapitulasi Kehadiran Anggota</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Analisis keaktifan anggota berdasarkan seluruh acara.</p>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Cari anggota atau bidang..." 
                            value={recapSearch}
                            onChange={(e) => setRecapSearch(e.target.value)}
                            className="w-full md:w-64 pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
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
                                <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 dark:text-white">{member.full_name}</div>
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
                                        {getAssessmentBadge(member.stats.assessment)}
                                    </td>
                                </tr>
                            ))}
                             {memberAttendanceStats.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        Tidak ada data anggota atau belum ada absensi tercatat.
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
                                    const status = record?.status; // undefined if not in list

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
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.divisions?.name || '-'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => handleAttendanceChange(m.id, 'Present')}
                                                    className={`p-2 rounded-lg transition ${status === 'Present' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20'}`}
                                                    title="Hadir"
                                                >
                                                    <CheckCircle2 size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleAttendanceChange(m.id, 'Excused')}
                                                    className={`p-2 rounded-lg transition ${status === 'Excused' ? 'bg-yellow-500 text-white shadow-md' : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 dark:hover:bg-yellow-900/20'}`}
                                                    title="Izin"
                                                >
                                                    <HelpCircle size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleAttendanceChange(m.id, 'Absent')}
                                                    className={`p-2 rounded-lg transition ${status === 'Absent' ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20'}`}
                                                    title="Alpha/Belum Hadir"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                                {/* Reset Button (Only shows if they have a record) */}
                                                {status && (
                                                    <button 
                                                        onClick={() => handleResetStatus(m.id)}
                                                        className="ml-2 p-1 text-gray-300 hover:text-red-400 transition"
                                                        title="Hapus dari daftar"
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

      {/* Modal Form for Creating/Editing Events */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Acara' : 'Buat Acara Baru'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Form Fields ... */}
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
            {/* ... Other fields ... */}
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
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi</label>
                <textarea 
                    rows={3} 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none" 
                />
            </div>
            
            {/* Participant Selection */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pilih Peserta Undangan</label>
                <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input 
                        type="radio" 
                        checked={inviteType === 'ALL'} 
                        onChange={() => setInviteType('ALL')}
                        className="text-primary-600 focus:ring-primary-500" 
                        />
                        Semua Anggota (Yang Memiliki Bidang)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input 
                        type="radio" 
                        checked={inviteType === 'SELECT'} 
                        onChange={() => setInviteType('SELECT')}
                        className="text-primary-600 focus:ring-primary-500" 
                        />
                        Pilih Anggota Tertentu
                    </label>
                </div>
                
                {inviteType === 'SELECT' && (
                    <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 p-2 space-y-1">
                        {members.filter(m => m.division_id).map(m => (
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {editingItem 
                    ? "*Menghapus centang akan MENGHAPUS data absensi anggota tersebut."
                    : "*Hanya anggota yang dipilih yang akan muncul di daftar absensi (Status awal: Alpha)."}
                </p>
            </div>

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