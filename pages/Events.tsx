import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Event, EventAttendance, Member, Foundation, EventSession, Group } from '../types';
import { 
  Plus, Edit, Trash2, CalendarDays, MapPin, 
  Clock, Search, AlertTriangle, MessageCircle, Copy, Check, Minimize2, Maximize2,
  ClipboardCheck, BarChart3, ChevronLeft, Filter, TrendingUp, Activity, Minus, TrendingDown, Ban, CheckCircle2, HelpCircle, XCircle, RotateCcw, Timer, PlayCircle, X, List, StopCircle, Lock, UserPlus, RefreshCw, Boxes
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

const STUDENT_GRADES = ['Caberawit', 'Praremaja', 'Remaja', 'Usia Nikah'];

export const Events: React.FC<EventsProps> = ({ events, members, attendance, groups, onRefresh, activeFoundation, isSuperAdmin }) => {
  // --- TABS STATE ---
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'ATTENDANCE'>('AGENDA');
  
  // --- AGENDA STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Event | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('Pengajian');
  const [status, setStatus] = useState<'Upcoming' | 'Completed' | 'Cancelled'>('Upcoming');
  const [lateTolerance, setLateTolerance] = useState<number>(15);
  // NEW: Session Management
  const [eventSessions, setEventSessions] = useState<EventSession[]>([{id: 'default', name: 'Kehadiran'}]);
  
  // WA Generator State
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waText, setWaText] = useState('');
  const [waCopied, setWaCopied] = useState(false);
  
  // Participant Selection State
  const [inviteType, setInviteType] = useState<'ALL' | 'SELECT' | 'GENERUS' | 'LIMA_UNSUR'>('ALL');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [inviteeSearch, setInviteeSearch] = useState('');
  const [isInviteExpanded, setIsInviteExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  // --- ATTENDANCE STATE ---
  const [attView, setAttView] = useState<'LIST' | 'DETAIL' | 'RECAP'>('LIST');
  const [selectedAttEvent, setSelectedAttEvent] = useState<Event | null>(null);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'Present' | 'Excused' | 'Absent' | 'Unrecorded'>('ALL');
  const [attendanceGroupFilter, setAttendanceGroupFilter] = useState<string>(''); // NEW: Group Filter State
  const [showUninvited, setShowUninvited] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick Manual State
  const [quickSearch, setQuickSearch] = useState('');
  const [isQuickProcessing, setIsQuickProcessing] = useState(false);

  // Recap State
  const [recapSearch, setRecapSearch] = useState('');
  const [recapFilterType, setRecapFilterType] = useState<'ALL' | 'YEAR' | 'MONTH'>('ALL');
  const [recapYear, setRecapYear] = useState(new Date().getFullYear());
  const [recapMonth, setRecapMonth] = useState(new Date().getMonth()); 
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // --- TOAST STATE ---
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  // --- AGENDA LOGIC ---
  const sortedEvents = useMemo(() => {
      return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events]);

  const activeEvents = useMemo(() => {
      // Sort upcoming/ongoing first for attendance
      return [...events].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events]);

  const getAttendanceStats = (eventId: string) => {
    const eventAtt = attendance.filter(a => a.event_id === eventId);
    const present = eventAtt.filter(a => a.status === 'Present').length;
    const excused = eventAtt.filter(a => a.status === 'Excused').length;
    const absent = eventAtt.filter(a => a.status === 'Absent').length;
    return { present, excused, absent, total: eventAtt.length };
  };

  const getDetailedStatus = (record: EventAttendance | undefined, event: Event) => {
      if (!record || !record.status) return null;
      if (record.status !== 'Present') return { label: record.status === 'Excused' ? 'Izin' : 'Alpha', color: record.status === 'Excused' ? 'yellow' : 'red' };
      if (!record.check_in_time) return { label: 'Hadir', color: 'green' };
      
      const diffMinutes = Math.floor((new Date(record.check_in_time).getTime() - new Date(event.date).getTime()) / 60000);
      const tolerance = event.late_tolerance || 15;
      
      if (diffMinutes <= 0) return { label: 'Tepat Waktu', color: 'green' };
      if (diffMinutes <= tolerance) return { label: `Telat Wajar (${diffMinutes}m)`, color: 'yellow' };
      return { label: `Telat (${diffMinutes}m)`, color: 'red' };
  };

  // Helper: Get Sessions safely
  const getEventSessions = (e: Event): EventSession[] => {
      if (e.sessions && Array.isArray(e.sessions) && e.sessions.length > 0) return e.sessions;
      return [{id: 'default', name: 'Kehadiran'}];
  }

  const handleOpenModal = (event?: Event) => {
    setInviteeSearch(''); 
    setIsInviteExpanded(false); 
    setSelectedGrade('');

    if (event) {
      setEditingItem(event);
      setName(event.name);
      
      const dt = new Date(event.date);
      setDate(dt.toISOString().split('T')[0]);
      const hours = dt.getHours().toString().padStart(2, '0');
      const minutes = dt.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
      
      setLocation(event.location || '');
      setDescription(event.description || '');
      setEventType(event.event_type || 'Pengajian');
      setStatus(event.status);
      setLateTolerance(event.late_tolerance || 15);
      // Load sessions or default
      setEventSessions(getEventSessions(event));
      
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
      setEventType('Pengajian');
      setStatus('Upcoming');
      setLateTolerance(15);
      setEventSessions([{id: 'default', name: 'Absen Masuk'}]); // Default for new
      setInviteType('ALL');
      setSelectedInvitees([]);
    }
    setIsModalOpen(true);
  };

  const addSession = () => {
      setEventSessions([...eventSessions, { id: Date.now().toString(), name: 'Sesi Baru' }]);
  }

  const updateSession = (id: string, field: 'name'|'startTime'|'endTime', value: string) => {
      setEventSessions(eventSessions.map(s => s.id === id ? {...s, [field]: value} : s));
  }

  const removeSession = (id: string) => {
      if (eventSessions.length <= 1) {
          showToast("Minimal satu sesi harus ada", "error");
          return;
      }
      setEventSessions(eventSessions.filter(s => s.id !== id));
  }

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
      late_tolerance: lateTolerance,
      event_type: eventType,
      sessions: eventSessions // Save JSON
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

      if (eventId) {
          let targetMemberIds: string[] = [];
          const validMembers = members; 

          if (inviteType === 'ALL') {
              targetMemberIds = validMembers.map(m => m.id);
          } else if (inviteType === 'GENERUS') {
              let filtered = validMembers.filter(m => m.member_type === 'Generus');
              if (selectedGrade) {
                  filtered = filtered.filter(m => m.grade === selectedGrade);
              }
              targetMemberIds = filtered.map(m => m.id);
          } else if (inviteType === 'LIMA_UNSUR') {
              targetMemberIds = validMembers.filter(m => m.member_type === 'Lima Unsur').map(m => m.id);
          } else {
              targetMemberIds = selectedInvitees;
          }

          if (editingItem) {
              if (inviteType !== 'SELECT') {
                  const currentRecords = attendance.filter(a => a.event_id === eventId);
                  const currentMemberIds = currentRecords.map(a => a.member_id);
                  const toAdd = targetMemberIds.filter(mid => !currentMemberIds.includes(mid));
                  if (toAdd.length > 0) {
                      const addPayload = toAdd.map(mid => ({ event_id: eventId, member_id: mid, status: 'Absent' }));
                      await supabase.from('event_attendance').insert(addPayload);
                  }
              } else {
                  // Update selectively
                  const currentRecords = attendance.filter(a => a.event_id === eventId);
                  const currentMemberIds = currentRecords.map(a => a.member_id);
                  const toAdd = targetMemberIds.filter(mid => !currentMemberIds.includes(mid));
                  const toRemove = currentMemberIds.filter(mid => !targetMemberIds.includes(mid));

                  if (toAdd.length > 0) {
                      const addPayload = toAdd.map(mid => ({ event_id: eventId, member_id: mid, status: 'Absent' }));
                      await supabase.from('event_attendance').insert(addPayload);
                  }
                  if (toRemove.length > 0) {
                      await supabase.from('event_attendance').delete().eq('event_id', eventId).in('member_id', toRemove);
                  }
              }
          } else {
              if (targetMemberIds.length > 0) {
                  const attendancePayload = targetMemberIds.map(mid => ({ event_id: eventId, member_id: mid, status: 'Absent' }));
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

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      showToast('Acara berhasil dihapus', 'success');
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) {
      showToast('Gagal menghapus acara: ' + error.message, 'error');
    }
  };

  const handleGenerateWA = (event: Event) => {
      const eventDate = new Date(event.date);
      const dateStr = eventDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = eventDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const invitedMemberIds = attendance.filter(a => a.event_id === event.id).map(a => a.member_id);
      const invitedMembers = members.filter(m => invitedMemberIds.includes(m.id));

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

      let text = `┏🎓📚🕌━━━━━━┓\n    ${event.name.toUpperCase()}\n┗━━━━━━🕌📚🎓┛\n\n`;
      text += `‎*السلام عليكم ورحمة الله وبركاته*\n\n`;
      text += `Dimohon Amal Sholih Kehadirannya dalam ${event.name} pada :\n\n`;
      text += `📅 ${dateStr}\n`;
      text += `⏰ Pukul : ${timeStr} WIB s/d Selesai\n`;
      text += `🕋 Tempat : ${event.location || 'Tempat menyusul'}\n\n`;
      text += `--------------------------------\n`;
      text += `*DAFTAR UNDANGAN:*\n\n`;

      Object.keys(grouped).sort((a, b) => a.localeCompare(b)).forEach(key => {
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
      text += `‎*الحمد لله جزا كم الله khaira*\n`;
      text += `‎ والسلام عليكم ورحمة الله وبركاته\n\n`;
      text += `TTD Pengurus\n${activeFoundation?.name || 'Yayasan'}`;

      setWaText(text);
      setWaModalOpen(true);
      setWaCopied(false);
  };

  const copyWaText = () => {
      navigator.clipboard.writeText(waText);
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 2000);
      showToast('Teks undangan berhasil disalin', 'success');
  };

  // --- ATTENDANCE ACTIONS ---
  const handleStartEvent = async () => {
      if(!selectedAttEvent) return;
      const now = new Date().toISOString();
      try {
          const { error } = await supabase.from('events').update({ actual_start_time: now }).eq('id', selectedAttEvent.id);
          if(error) throw error;
          showToast('Absensi resmi dibuka!', 'success');
          onRefresh();
          setSelectedAttEvent({...selectedAttEvent, actual_start_time: now});
      } catch (error: any) {
          showToast('Gagal memulai: ' + error.message, 'error');
      }
  }

  // QUICK MANUAL INPUT (BY SEARCH RESULT)
  const handleQuickAdd = async (member: Member) => {
      if (!selectedAttEvent || isQuickProcessing) return;
      setIsQuickProcessing(true);
      try {
          await handleManualStatusChange(member.id, 'Present');
          setQuickSearch(''); // Reset search after success
          showToast(`Berhasil absen: ${member.full_name}`, 'success');
      } catch (e) {} finally {
          setIsQuickProcessing(false);
      }
  };

  // MANUAL ATTENDANCE HANDLER
  const handleManualStatusChange = async (memberId: string, newStatus: 'Present' | 'Absent' | 'Excused') => {
      if (!selectedAttEvent) return;
      try {
          const updateData: any = { 
              event_id: selectedAttEvent.id, 
              member_id: memberId, 
              status: newStatus,
          };
          if (newStatus === 'Present') {
              const now = new Date().toISOString();
              updateData.check_in_time = now;
              
              if (selectedAttEvent.sessions && selectedAttEvent.sessions.length > 0) {
                  const defaultSessionId = selectedAttEvent.sessions[0].id || 'default';
                  updateData.logs = { [defaultSessionId]: now };
              }
          }
          const { error } = await supabase.from('event_attendance').upsert(updateData, { onConflict: 'event_id, member_id' });
          if (error) throw error;
          onRefresh(); 
          if (newStatus !== 'Present') showToast(`Status ${newStatus === 'Excused' ? 'Izin' : 'Alpha'} disimpan`, 'success');
      } catch (error: any) {
          showToast('Gagal update: ' + error.message, 'error');
          throw error;
      }
  };

  const handleResetStatus = async (memberId: string) => {
      if (!selectedAttEvent) return;
      try {
          const { error } = await supabase.from('event_attendance').delete().match({ event_id: selectedAttEvent.id, member_id: memberId });
          if (error) throw error;
          onRefresh();
          showToast('Status direset', 'success');
      } catch (error: any) {
          showToast('Gagal reset: ' + error.message, 'error');
      }
  }

  const filteredMembers = useMemo(() => {
      if (!selectedAttEvent) return [];
      return members
        .filter(m => {
            const hasRecord = attendance.some(a => a.event_id === selectedAttEvent?.id && a.member_id === m.id);
            return showUninvited ? true : hasRecord;
        })
        .filter(m => !attendanceGroupFilter || m.group_id === attendanceGroupFilter) // NEW: Filter by Group ID
        .filter(m => m.full_name.toLowerCase().includes(attendanceSearch.toLowerCase()))
        .filter(m => {
            if (attendanceStatusFilter === 'ALL') return true;
            const record = attendance.find(a => a.event_id === selectedAttEvent?.id && a.member_id === m.id);
            const currentStatus = record?.status;
            if (attendanceStatusFilter === 'Unrecorded') return !currentStatus;
            return currentStatus === attendanceStatusFilter;
        });
  }, [members, attendance, selectedAttEvent, attendanceSearch, attendanceStatusFilter, attendanceGroupFilter, showUninvited]);

  const quickCandidates = useMemo(() => {
      if (!quickSearch || quickSearch.length < 2) return [];
      return members
        .filter(m => m.full_name.toLowerCase().includes(quickSearch.toLowerCase()) || m.id.toLowerCase().includes(quickSearch.toLowerCase()))
        .slice(0, 5);
  }, [members, quickSearch]);

  const chartData = selectedAttEvent ? [
      { name: 'Hadir', value: getAttendanceStats(selectedAttEvent.id).present, color: '#22c55e' },
      { name: 'Izin', value: getAttendanceStats(selectedAttEvent.id).excused, color: '#eab308' },
      { name: 'Alpha', value: getAttendanceStats(selectedAttEvent.id).absent, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  const handleRefreshData = () => {
      setIsRefreshing(true);
      onRefresh();
      setTimeout(() => {
          setIsRefreshing(false);
          showToast("Data absensi terbaru dimuat", "success");
      }, 800);
  };

  // Recap Logic
  const allMonths = [ 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  const availableYears = useMemo(() => {
    const years = new Set<number>(events.map(e => new Date(e.date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [events]);

  const memberAttendanceStats = useMemo(() => {
      const relevantEvents = events.filter(e => {
          const d = new Date(e.date);
          const eYear = d.getFullYear();
          const eMonth = d.getMonth();

          if (recapFilterType === 'ALL') return true;
          if (recapFilterType === 'YEAR') return eYear === Number(recapYear);
          if (recapFilterType === 'MONTH') return eYear === Number(recapYear) && eMonth === Number(recapMonth);
          return true;
      });
      const relevantEventIds = relevantEvents.map(e => e.id);
      
      const activeMembers = members; 

      return activeMembers.map(member => {
          const myAttendance = attendance.filter(a => a.member_id === member.id && relevantEventIds.includes(a.event_id));
          const totalInvited = myAttendance.length;
          const present = myAttendance.filter(a => a.status === 'Present').length;
          const excused = myAttendance.filter(a => a.status === 'Excused').length;
          const absent = myAttendance.filter(a => a.status === 'Absent').length;
          const percentage = totalInvited > 0 ? (present / totalInvited) * 100 : 0;

          let assessment: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NONE' = 'NONE';
          if (totalInvited > 0) {
              if (percentage >= 85) assessment = 'EXCELLENT';
              else if (percentage >= 70) assessment = 'GOOD';
              else if (percentage >= 50) assessment = 'FAIR';
              else assessment = 'POOR';
          }

          return { ...member, stats: { totalInvited, present, excused, absent, percentage, assessment, records: myAttendance } };
      }).filter(m => 
          m.full_name.toLowerCase().includes(recapSearch.toLowerCase()) || 
          (m.divisions?.name || '').toLowerCase().includes(recapSearch.toLowerCase())
      ).sort((a, b) => b.stats.percentage - a.stats.percentage);
  }, [members, attendance, events, recapSearch, recapFilterType, recapYear, recapMonth]);

  const recapSummary = useMemo(() => {
      const counts = { EXCELLENT: 0, GOOD: 0, FAIR: 0, POOR: 0, NEVER: 0 };
      memberAttendanceStats.forEach(m => {
          if (m.stats.assessment !== 'NONE') counts[m.stats.assessment]++;
          if (m.stats.totalInvited > 0 && m.stats.present === 0) counts.NEVER++;
      });
      return counts;
  }, [memberAttendanceStats]);

  const getAssessmentBadge = (assessment: string, stats: any) => {
      if (stats.totalInvited > 0 && stats.present === 0) return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-900 text-red-100 dark:bg-red-950 dark:text-red-300"><Ban size={12} /> Nihil</span>;
      switch (assessment) {
          case 'EXCELLENT': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><TrendingUp size={12} /> Sangat Aktif</span>;
          case 'GOOD': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><Activity size={12} /> Aktif</span>;
          case 'FAIR': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"><Minus size={12} /> Cukup</span>;
          case 'POOR': return <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><TrendingDown size={12} /> Jarang</span>;
          default: return <span className="text-xs text-gray-400 italic">No Data</span>;
      }
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      
      {/* Toast Notification */}
      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
              {toast.type === 'success' ? <Check size={18}/> : <AlertTriangle size={18}/>}
              <span className="text-sm font-medium">{toast.message}</span>
          </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <CalendarDays className="text-primary-600 dark:text-primary-400" /> Acara & Absensi
          </h2>
          
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('AGENDA')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'AGENDA' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
              >
                  <CalendarDays size={16}/> Jadwal Agenda
              </button>
              <button 
                onClick={() => setActiveTab('ATTENDANCE')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'ATTENDANCE' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
              >
                  <ClipboardCheck size={16}/> Data Absensi & Rekap
              </button>
          </div>
      </div>

      {/* --- TAB CONTENT: AGENDA --- */}
      {activeTab === 'AGENDA' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
              {!isSuperAdmin && (
                <div className="flex justify-end">
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    >
                        <Plus size={18} /> Buat Acara
                    </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedEvents.map(item => {
                    const stats = getAttendanceStats(item.id);
                    const eventDate = new Date(item.date);
                    
                    return (
                      <div key={item.id} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden hover:shadow-md transition flex flex-col">
                        <div className={`h-2 w-full ${item.status === 'Upcoming' ? 'bg-blue-500' : item.status === 'Completed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div className="p-5 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex gap-1">
                                <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wide ${
                                    item.status === 'Upcoming' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                    item.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                }`}>
                                    {item.status}
                                </span>
                                <span className="px-2 py-1 rounded text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-bold tracking-wide">
                                    {item.event_type || 'Pengajian'}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleGenerateWA(item)} className="text-green-500 hover:text-green-700 dark:text-green-400" title="Undangan WA"><MessageCircle size={18} /></button>
                                {!isSuperAdmin && (
                                    <>
                                        <button onClick={() => handleOpenModal(item)} className="text-gray-400 hover:text-blue-600"><Edit size={16}/></button>
                                        <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id})} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                                    </>
                                )}
                            </div>
                          </div>
                          
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 flex items-center gap-2">
                              {item.name}
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
                             <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>Undangan: {stats.total} Orang</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-200">{stats.present} Hadir</span>
                             </div>
                             <button 
                                onClick={() => { setSelectedAttEvent(item); setAttView('DETAIL'); setActiveTab('ATTENDANCE'); }}
                                className="w-full mt-2 py-1.5 text-xs font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50 rounded flex items-center justify-center gap-1 transition"
                             >
                                 <ClipboardCheck size={12}/> Kelola Absensi
                             </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {events.length === 0 && <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">Belum ada acara.</div>}
              </div>
          </div>
      )}

      {/* --- TAB CONTENT: ATTENDANCE --- */}
      {activeTab === 'ATTENDANCE' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* SUB HEADER */}
              <div className="flex justify-between items-center bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-dark-border shadow-sm">
                  <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      {attView === 'DETAIL' && selectedAttEvent ? `Detail Absensi: ${selectedAttEvent.name}` : attView === 'RECAP' ? 'Rekapitulasi Total' : 'Pilih Acara untuk Absensi'}
                  </h3>
                  <div className="flex gap-2">
                      {attView === 'DETAIL' && (
                           <button 
                              onClick={handleRefreshData} 
                              disabled={isRefreshing}
                              className="px-3 py-1.5 border rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 text-primary-600 dark:text-primary-400 flex items-center gap-2 text-xs font-bold transition disabled:opacity-50"
                           >
                              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''}/> 
                              Sync
                           </button>
                      )}
                      {attView !== 'LIST' && (
                          <button onClick={() => setAttView('LIST')} className="px-3 py-1.5 border rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center gap-1 text-xs font-medium">
                              <ChevronLeft size={14}/> Kembali
                          </button>
                      )}
                      {attView === 'LIST' && (
                          <button onClick={() => setAttView('RECAP')} className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg text-xs font-bold flex items-center gap-2 transition">
                              <BarChart3 size={16}/> Lihat Rekap & Evaluasi
                          </button>
                      )}
                  </div>
              </div>

              {/* LIST VIEW */}
              {attView === 'LIST' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {activeEvents.map(event => {
                          const stats = getAttendanceStats(event.id);
                          const isStarted = !!event.actual_start_time;
                          return (
                              <div key={event.id} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden hover:shadow-md transition cursor-pointer" onClick={() => { setSelectedAttEvent(event); setAttView('DETAIL'); setAttendanceSearch(''); }}>
                                  <div className={`h-1.5 w-full ${event.status === 'Upcoming' ? 'bg-blue-500' : event.status === 'Completed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <div className="p-4">
                                      <div className="flex justify-between mb-1">
                                          <span className="text-[10px] font-bold text-gray-500">{new Date(event.date).toLocaleDateString('id-ID')}</span>
                                          <span className={`text-[10px] px-1.5 rounded ${event.status === 'Completed' ? 'bg-green-100 text-green-700' : isStarted ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                              {event.status === 'Completed' ? 'Selesai' : isStarted ? 'Berlangsung' : 'Belum Mulai'}
                                          </span>
                                      </div>
                                      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 line-clamp-1">{event.name}</h3>
                                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                                          <span>Undangan: {stats.total}</span>
                                          <span className="font-bold text-gray-800 dark:text-white">{stats.present} Hadir</span>
                                      </div>
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              )}

              {/* DETAIL VIEW */}
              {attView === 'DETAIL' && selectedAttEvent && (
                  <div className="space-y-6 animate-in slide-in-from-right-10 duration-300">
                      
                      {/* NEW: QUICK MANUAL INPUT BAR */}
                      <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-indigo-100 dark:border-indigo-900/50 flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                               <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded">
                                   <UserPlus size={18}/>
                               </div>
                               <h4 className="text-sm font-bold text-gray-800 dark:text-white">Input Manual Cepat (Cari & Absen)</h4>
                          </div>
                          
                          <div className="relative">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                               <input 
                                   type="text" 
                                   placeholder="Ketik Nama atau ID Anggota..." 
                                   value={quickSearch}
                                   onChange={(e) => setQuickSearch(e.target.value)}
                                   className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition dark:text-white"
                               />
                               {quickCandidates.length > 0 && (
                                   <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y dark:divide-gray-800 animate-in slide-in-from-top-2 duration-200">
                                       {quickCandidates.map(member => (
                                           <div 
                                                key={member.id} 
                                                onClick={() => handleQuickAdd(member)}
                                                className="flex items-center justify-between p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition"
                                           >
                                               <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-xs">{member.full_name.charAt(0)}</div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold truncate text-gray-800 dark:text-white">{member.full_name}</p>
                                                        <p className="text-[10px] text-gray-500 truncate">{member.divisions?.name || '-'}</p>
                                                    </div>
                                               </div>
                                               <button className="text-[10px] font-black uppercase tracking-tighter bg-indigo-600 text-white px-2 py-1 rounded-lg shadow-sm">Check-in</button>
                                           </div>
                                       ))}
                                   </div>
                               )}
                          </div>
                      </div>

                      {!selectedAttEvent.actual_start_time && (
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-200 dark:border-indigo-800 text-center flex flex-col items-center">
                              <Timer size={48} className="text-indigo-500 mb-2"/>
                              <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200">Acara Belum Dimulai</h3>
                              <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4">Klik tombol di bawah untuk memulai pencatatan waktu kehadiran real-time.</p>
                              <button onClick={handleStartEvent} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition">
                                  <PlayCircle size={20}/> Buka Absensi Sekarang
                              </button>
                          </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-fit">
                              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Statistik Real-time</h3>
                              <div className="h-48 w-full">
                                  {chartData.length > 0 ? (
                                      <ResponsiveContainer width="100%" height="100%">
                                          <RePieChart>
                                              <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                                                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                              </Pie>
                                              <ReTooltip />
                                              <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right"/>
                                          </RePieChart>
                                      </ResponsiveContainer>
                                  ) : <p className="text-center text-sm text-gray-400 mt-10">Belum ada data.</p>}
                              </div>
                          </div>

                          <div className="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex flex-col h-[600px]">
                              <div className="p-4 border-b border-gray-100 dark:border-dark-border flex flex-col sm:flex-row gap-4 flex-wrap">
                                  <div className="flex gap-2">
                                      <select className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium rounded-lg px-2 py-2 outline-none dark:text-white"
                                          value={attendanceStatusFilter} onChange={(e) => setAttendanceStatusFilter(e.target.value as any)}>
                                          <option value="ALL">Semua Status</option>
                                          <option value="Present">Hadir</option>
                                          <option value="Excused">Izin</option>
                                          <option value="Absent">Alpha/Belum</option>
                                      </select>
                                      <select className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 text-xs font-medium rounded-lg px-2 py-2 outline-none dark:text-white"
                                          value={attendanceGroupFilter} onChange={(e) => setAttendanceGroupFilter(e.target.value)}>
                                          <option value="">Semua Kelompok</option>
                                          {groups.map(g => (
                                              <option key={g.id} value={g.id}>{g.name}</option>
                                          ))}
                                      </select>
                                  </div>
                                  
                                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter text-gray-600 dark:text-gray-300 cursor-pointer bg-gray-50 dark:bg-gray-800 px-3 rounded-lg border dark:border-gray-700 select-none">
                                      <input type="checkbox" checked={showUninvited} onChange={() => setShowUninvited(!showUninvited)} className="rounded text-primary-600"/>
                                      Semua Anggota
                                  </label>
                                  
                                  <div className="relative flex-1 min-w-[200px]">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                      <input type="text" placeholder="Cari nama di daftar..." value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)}
                                          className="w-full pl-9 pr-3 py-2 text-sm border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white outline-none"/>
                                  </div>
                              </div>

                              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                                  {filteredMembers.map(m => {
                                      const record = attendance.find(a => a.event_id === selectedAttEvent.id && a.member_id === m.id);
                                      const status = record?.status;
                                      const detailStatus = getDetailedStatus(record, selectedAttEvent);
                                      const groupName = groups.find(g => g.id === m.group_id)?.name;

                                      return (
                                          <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-dark-border">
                                              <div className="flex items-center gap-3">
                                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                                      status === 'Present' ? 'bg-green-100 text-green-600' :
                                                      status === 'Excused' ? 'bg-yellow-100 text-yellow-600' :
                                                      status === 'Absent' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'
                                                  }`}>{m.full_name.charAt(0)}</div>
                                                  <div>
                                                      <p className="font-medium text-gray-900 dark:text-white text-sm">{m.full_name}</p>
                                                      <div className="flex items-center flex-wrap gap-2">
                                                          <p className="text-xs text-gray-500">{m.divisions?.name || '-'}</p>
                                                          {groupName && (
                                                              <span className="flex items-center gap-1 text-[10px] text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 px-1.5 py-0.5 rounded border border-pink-100 dark:border-pink-800">
                                                                  <Boxes size={10} /> {groupName}
                                                              </span>
                                                          )}
                                                          {detailStatus && (
                                                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                                                  detailStatus.color === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                  detailStatus.color === 'yellow' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                  'bg-red-50 text-red-700 border-red-200'
                                                              }`}>{detailStatus.label}</span>
                                                          )}
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                  <button onClick={() => handleManualStatusChange(m.id, 'Present')}
                                                      className={`p-2 rounded-lg transition ${status === 'Present' ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-green-50 hover:text-green-600'}`}>
                                                      <CheckCircle2 size={18} />
                                                  </button>
                                                  <button onClick={() => handleManualStatusChange(m.id, 'Excused')}
                                                      className={`p-2 rounded-lg transition ${status === 'Excused' ? 'bg-yellow-500 text-white' : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-600'}`}>
                                                      <HelpCircle size={18} />
                                                  </button>
                                                  <button onClick={() => handleManualStatusChange(m.id, 'Absent')}
                                                      className={`p-2 rounded-lg transition ${status === 'Absent' ? 'bg-red-500 text-white' : 'text-gray-400 hover:bg-red-50 hover:text-red-600'}`}>
                                                      <XCircle size={18} />
                                                  </button>
                                                  {status && (
                                                      <button onClick={() => handleResetStatus(m.id)} className="ml-2 p-1 text-gray-300 hover:text-red-400">
                                                          <RotateCcw size={14} />
                                                      </button>
                                                  )}
                                              </div>
                                          </div>
                                      )
                                  })}
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* RECAP VIEW */}
              {attView === 'RECAP' && (
                  <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden animate-in fade-in">
                      <div className="p-6 border-b border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-gray-800/50">
                          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                              <div>
                                  <h3 className="font-bold text-gray-800 dark:text-white">Rekapitulasi Kehadiran</h3>
                                  <p className="text-sm text-gray-500">Analisis keaktifan anggota berdasarkan data scan dan manual.</p>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-3">
                                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg px-3 py-2">
                                      <Filter size={16} className="text-gray-400"/>
                                      <select value={recapFilterType} onChange={(e) => setRecapFilterType(e.target.value as any)} className="bg-transparent text-sm outline-none dark:text-white">
                                          <option value="ALL">Semua Waktu</option>
                                          <option value="YEAR">Per Tahun</option>
                                          <option value="MONTH">Per Bulan</option>
                                      </select>
                                  </div>
                                  {(recapFilterType === 'YEAR' || recapFilterType === 'MONTH') && (
                                      <select value={recapYear} onChange={(e) => setRecapYear(Number(e.target.value))} className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 dark:text-white outline-none dark:border-gray-700">
                                          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                      </select>
                                  )}
                                  {recapFilterType === 'MONTH' && (
                                      <select value={recapMonth} onChange={(e) => setRecapMonth(Number(e.target.value))} className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 dark:text-white outline-none dark:border-gray-700">
                                          {allMonths.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                                      </select>
                                  )}
                                  <div className="relative">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                      <input type="text" placeholder="Cari anggota..." value={recapSearch} onChange={(e) => setRecapSearch(e.target.value)}
                                          className="pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 dark:text-white outline-none dark:border-gray-700"/>
                                  </div>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div className="bg-green-50 text-center p-3 rounded-lg border border-green-200"><p className="text-xs text-green-700 font-bold">Sangat Aktif</p><p className="text-xl font-bold text-green-800">{recapSummary.EXCELLENT}</p></div>
                              <div className="bg-blue-50 text-center p-3 rounded-lg border border-blue-200"><p className="text-xs text-blue-700 font-bold">Aktif</p><p className="text-xl font-bold text-blue-800">{recapSummary.GOOD}</p></div>
                              <div className="bg-yellow-50 text-center p-3 rounded-lg border border-yellow-200"><p className="text-xs text-yellow-700 font-bold">Cukup</p><p className="text-xl font-bold text-blue-800">{recapSummary.FAIR}</p></div>
                              <div className="bg-red-50 text-center p-3 rounded-lg border border-red-200"><p className="text-xs text-red-700 font-bold">Jarang</p><p className="text-xl font-bold text-blue-800">{recapSummary.POOR}</p></div>
                              <div className="bg-red-900 text-center p-3 rounded-lg border border-red-800"><p className="text-xs text-red-200 font-bold">Nihil</p><p className="text-xl font-bold text-white">{recapSummary.NEVER}</p></div>
                          </div>
                      </div>

                      <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
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
                              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                  {memberAttendanceStats.map(member => (
                                      <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => { setDetailMember(member as unknown as Member); setIsDetailModalOpen(true); }}>
                                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{member.full_name}</td>
                                          <td className="px-6 py-4 text-gray-500">{(member as any).divisions?.name || '-'}</td>
                                          <td className="px-6 py-4 text-center">{member.stats.totalInvited}</td>
                                          <td className="px-6 py-4 text-center font-bold text-green-600">{member.stats.present}</td>
                                          <td className="px-6 py-4 text-center text-gray-500">{member.stats.excused} / <span className="text-red-500">{member.stats.absent}</span></td>
                                          <td className="px-6 py-4"><span className="text-xs font-bold">{Math.round(member.stats.percentage)}%</span></td>
                                          <td className="px-6 py-4">{getAssessmentBadge(member.stats.assessment, member.stats)}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* --- MODALS --- */}
      
      {/* WA Modal */}
      <Modal isOpen={waModalOpen} onClose={() => setWaModalOpen(false)} title="Undangan WhatsApp" size="2xl">
          <div className="space-y-4">
              <textarea className="w-full h-96 p-4 text-sm font-mono border rounded bg-gray-50 dark:bg-gray-900 dark:text-gray-300 resize-none outline-none focus:ring-2 focus:ring-primary-500" value={waText} onChange={(e) => setWaText(e.target.value)}/>
              <div className="flex justify-end gap-2">
                  <button onClick={() => setWaModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border rounded">Tutup</button>
                  <button onClick={copyWaText} className="px-4 py-2 text-sm bg-green-600 text-white rounded flex items-center gap-2 hover:bg-green-700"><Copy size={16}/> Salin Undangan</button>
              </div>
          </div>
      </Modal>

      {/* Create/Edit Event Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Acara' : 'Buat Acara'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Acara</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-sm focus:ring-primary-500 focus:border-primary-500 outline-none" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-sm focus:ring-primary-500 focus:border-primary-500 outline-none" 
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
                    <input type="date" required value={date} onChange={e => setDate(e.target.value)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-sm focus:ring-primary-500 focus:border-primary-500 outline-none" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam</label>
                    <input type="time" required value={time} onChange={e => setTime(e.target.value)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-sm focus:ring-primary-500 focus:border-primary-500 outline-none" 
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe</label>
                    <select value={eventType} onChange={e => setEventType(e.target.value)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-sm focus:ring-primary-500 focus:border-primary-500 outline-none"
                    >
                        <option value="Pengajian">Pengajian</option><option value="Rapat">Rapat</option><option value="Acara Umum">Acara Umum</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Toleransi (Menit)</label>
                    <input type="number" min="0" value={lateTolerance} onChange={e => setLateTolerance(Number(e.target.value))} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-sm focus:ring-primary-500 focus:border-primary-500 outline-none" 
                    />
                </div>
            </div>
            
            {/* SESSION MANAGEMENT WITH TIME */}
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1"><List size={14}/> Sesi Absensi</label>
                    <button type="button" onClick={addSession} className="text-xs bg-white dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded border border-purple-200 dark:border-purple-700 shadow-sm flex items-center gap-1 hover:bg-purple-100 transition"><Plus size={10}/> Tambah Sesi</button>
                </div>
                <div className="space-y-2">
                    {eventSessions.map((session, idx) => (
                        <div key={session.id} className="flex gap-2 items-center bg-white dark:bg-gray-800 p-2 rounded border border-purple-100 dark:border-purple-800">
                            <span className="text-xs text-gray-500 w-4 text-center">{idx + 1}.</span>
                            <input 
                                type="text" 
                                value={session.name}
                                onChange={(e) => updateSession(session.id, 'name', e.target.value)}
                                className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded p-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-purple-500"
                                placeholder="Nama Sesi (misal: Masuk)"
                            />
                            <div className="flex items-center gap-1">
                                <input type="time" value={session.startTime || ''} onChange={(e) => updateSession(session.id, 'startTime', e.target.value)} className="w-20 text-xs border border-gray-300 dark:border-gray-600 rounded p-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-purple-500" title="Jam Mulai" />
                                <span className="text-xs text-gray-400">-</span>
                                <input type="time" value={session.endTime || ''} onChange={(e) => updateSession(session.id, 'endTime', e.target.value)} className="w-20 text-xs border border-gray-300 dark:border-gray-600 rounded p-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-purple-500" title="Jam Selesai" />
                            </div>
                            {eventSessions.length > 1 && (
                                <button type="button" onClick={() => removeSession(session.id)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 size={14}/></button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} 
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-sm focus:ring-primary-500 focus:border-primary-500 outline-none" 
                />
            </div>
            
            {/* Invite Logic */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Undangan</label>
                    <button type="button" onClick={() => setIsInviteExpanded(!isInviteExpanded)} className="text-primary-600 text-xs font-medium hover:underline">{isInviteExpanded ? 'Tutup' : 'Buka'}</button>
                </div>
                <div className="flex gap-3 text-xs mb-2 flex-wrap">
                    {['ALL', 'GENERUS', 'LIMA_UNSUR', 'SELECT'].map(t => (
                        <label key={t} className="flex items-center gap-1 cursor-pointer text-gray-700 dark:text-gray-300"><input type="radio" checked={inviteType === t} onChange={() => setInviteType(t as any)} /> {t}</label>
                    ))}
                </div>
                {inviteType === 'GENERUS' && (
                    <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} 
                        className="w-full text-xs border border-gray-300 dark:border-gray-600 p-1 rounded mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
                    >
                        <option value="">Semua Kelas</option>{STUDENT_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                )}
                {inviteType === 'SELECT' && isInviteExpanded && (
                    <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 p-2 space-y-1">
                        <input type="text" placeholder="Cari..." value={inviteeSearch} onChange={e => setInviteeSearch(e.target.value)} 
                            className="w-full text-xs border border-gray-300 dark:border-gray-600 p-1 rounded mb-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
                        />
                        {members.filter(m => m.full_name.toLowerCase().includes(inviteeSearch.toLowerCase())).map(m => (
                            <label key={m.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300"><input type="checkbox" checked={selectedInvitees.includes(m.id)} onChange={() => toggleInvitee(m.id)} /> {m.full_name}</label>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm border rounded text-gray-600 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50">{isSubmitting ? '...' : 'Simpan'}</button>
            </div>
        </form>
      </Modal>

      {/* Detail Member History Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`History: ${detailMember?.full_name}`} size="lg">
          <div className="space-y-4">
              <div className="max-h-[50vh] overflow-y-auto border rounded-lg dark:border-gray-700">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                          <tr><th className="px-4 py-2">Tanggal</th><th className="px-4 py-2">Acara</th><th className="px-4 py-2 text-right">Status</th></tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                          {((detailMember as any)?.stats?.records || []).map((rec: any) => {
                              const ev = events.find(e => e.id === rec.event_id);
                              const det = ev ? getDetailedStatus(rec, ev) : null;
                              return (
                                  <tr key={rec.id}>
                                      <td className="px-4 py-2 text-gray-500">{ev ? new Date(ev.date).toLocaleDateString() : '-'}</td>
                                      <td className="px-4 py-2 font-medium">{ev?.name}</td>
                                      <td className="px-4 py-2 text-right">{det ? <span className={`px-2 py-1 rounded text-xs font-bold ${det.color === 'green' ? 'bg-green-100 text-green-700' : det.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{det.label}</span> : '-'}</td>
                                  </tr>
                              )
                          })}
                      </tbody>
                  </table>
              </div>
              <div className="flex justify-end"><button onClick={() => setIsDetailModalOpen(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">Tutup</button></div>
          </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null})} title="Hapus Acara">
        <div className="text-center">
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">Yakin hapus acara ini? Data absensi akan hilang.</p>
            <div className="flex justify-center gap-2">
                <button onClick={() => setDeleteConfirm({isOpen: false, id: null})} className="px-4 py-2 text-sm border rounded dark:text-white dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Batal</button>
                <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">Hapus</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};