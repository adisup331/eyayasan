
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Event, EventAttendance, Member } from '../types';
import { 
  ClipboardCheck, CalendarDays, BarChart3, ChevronLeft, Search, Filter, 
  TrendingUp, Activity, Minus, TrendingDown, Ban, CheckCircle2, 
  HelpCircle, XCircle, RotateCcw, Clock, Timer, PlayCircle, AlertTriangle
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';

interface AttendanceProps {
  events: Event[];
  members: Member[];
  attendance: EventAttendance[];
  onRefresh: () => void;
}

export const Attendance: React.FC<AttendanceProps> = ({ events, members, attendance, onRefresh }) => {
  const [view, setView] = useState<'LIST' | 'DETAIL' | 'RECAP'>('LIST');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Attendance Filter State
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'Present' | 'Excused' | 'Absent' | 'Unrecorded'>('ALL');
  const [showUninvited, setShowUninvited] = useState(false);

  // Recap State
  const [recapSearch, setRecapSearch] = useState('');
  const [recapFilterType, setRecapFilterType] = useState<'ALL' | 'YEAR' | 'MONTH'>('ALL');
  const [recapYear, setRecapYear] = useState(new Date().getFullYear());
  const [recapMonth, setRecapMonth] = useState(new Date().getMonth()); 
  
  // Member Detail Modal (Recap)
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const availableYears = useMemo(() => {
    const years = new Set<number>(events.map(e => new Date(e.date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [events]);

  const activeEvents = useMemo(() => {
      // Sort upcoming/ongoing first
      return [...events].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events]);

  // --- ATTENDANCE ACTIONS ---
  
  const handleStartEvent = async () => {
      if(!selectedEvent) return;
      const now = new Date().toISOString();
      try {
          const { error } = await supabase.from('events').update({ actual_start_time: now }).eq('id', selectedEvent.id);
          if(error) throw error;
          showToast('Absensi resmi dibuka!', 'success');
          onRefresh();
          setSelectedEvent({...selectedEvent, actual_start_time: now});
      } catch (error: any) {
          showToast('Gagal memulai: ' + error.message, 'error');
      }
  }

  const handleAttendanceChange = async (memberId: string, newStatus: 'Present' | 'Absent' | 'Excused') => {
    if (!selectedEvent) return;
    try {
       const updateData: any = { 
            event_id: selectedEvent.id, 
            member_id: memberId, 
            status: newStatus,
        };
        if (newStatus === 'Present') {
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
      if (!selectedEvent) return;
      try {
          const { error } = await supabase.from('event_attendance').delete().match({ event_id: selectedEvent.id, member_id: memberId });
          if (error) throw error;
          onRefresh();
      } catch (error: any) {
          showToast('Gagal reset: ' + error.message, 'error');
      }
  }

  // --- RECAP STATS ---
  const memberAttendanceStats = useMemo(() => {
      const relevantEvents = events.filter(e => {
          const d = new Date(e.date);
          if (recapFilterType === 'ALL') return true;
          if (recapFilterType === 'YEAR') return d.getFullYear() === recapYear;
          if (recapFilterType === 'MONTH') return d.getFullYear() === recapYear && d.getMonth() === Number(recapMonth);
          return true;
      });
      const relevantEventIds = relevantEvents.map(e => e.id);
      const activeMembers = members.filter(m => m.division_id);

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
          m.divisions?.name.toLowerCase().includes(recapSearch.toLowerCase())
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

  // --- RENDER HELPERS ---
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
      if (!record.check_in_time) return { label: 'Hadir (Manual)', color: 'green' };
      const diffMinutes = Math.floor((new Date(record.check_in_time).getTime() - new Date(event.date).getTime()) / 60000);
      const tolerance = event.late_tolerance || 15;
      if (diffMinutes <= 0) return { label: 'Tepat Waktu', color: 'green' };
      if (diffMinutes <= tolerance) return { label: `Telat Wajar (${diffMinutes}m)`, color: 'yellow' };
      return { label: `Telat (${diffMinutes}m)`, color: 'red' };
  };

  const filteredMembers = useMemo(() => {
      if (!selectedEvent) return [];
      return members
        .filter(m => m.division_id) 
        .filter(m => {
            const hasRecord = attendance.some(a => a.event_id === selectedEvent?.id && a.member_id === m.id);
            return showUninvited ? true : hasRecord;
        })
        .filter(m => m.full_name.toLowerCase().includes(attendanceSearch.toLowerCase()))
        .filter(m => {
            if (attendanceStatusFilter === 'ALL') return true;
            const record = attendance.find(a => a.event_id === selectedEvent?.id && a.member_id === m.id);
            const currentStatus = record?.status;
            if (attendanceStatusFilter === 'Unrecorded') return !currentStatus;
            return currentStatus === attendanceStatusFilter;
        });
  }, [members, attendance, selectedEvent, attendanceSearch, attendanceStatusFilter, showUninvited]);

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

  const chartData = selectedEvent ? [
      { name: 'Hadir', value: getAttendanceStats(selectedEvent.id).present, color: '#22c55e' },
      { name: 'Izin', value: getAttendanceStats(selectedEvent.id).excused, color: '#eab308' },
      { name: 'Alpha', value: getAttendanceStats(selectedEvent.id).absent, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
        {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>} <span className="text-sm font-medium">{toast.message}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="text-primary-600 dark:text-primary-400" /> 
                {view === 'DETAIL' && selectedEvent ? `Absensi: ${selectedEvent.name}` : view === 'RECAP' ? 'Rekapitulasi' : 'Data Absensi'}
            </h2>
            <div className="flex gap-2">
                {view !== 'LIST' && (
                    <button onClick={() => setView('LIST')} className="p-2 border rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
                        <ChevronLeft size={20}/>
                    </button>
                )}
                {view === 'LIST' && (
                    <button onClick={() => setView('RECAP')} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition">
                        <BarChart3 size={18}/> Rekap & Evaluasi
                    </button>
                )}
            </div>
        </div>

        {/* --- VIEW: LIST (Select Event) --- */}
        {view === 'LIST' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeEvents.map(event => {
                    const stats = getAttendanceStats(event.id);
                    const isStarted = !!event.actual_start_time;
                    return (
                        <div key={event.id} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden hover:shadow-md transition">
                            <div className={`h-2 w-full ${event.status === 'Upcoming' ? 'bg-blue-500' : event.status === 'Completed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <div className="p-5">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[10px] uppercase font-bold bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-300">{event.event_type}</span>
                                    <span className="text-[10px] font-bold text-gray-500">{new Date(event.date).toLocaleDateString('id-ID')}</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 line-clamp-1">{event.name}</h3>
                                <div className="flex justify-between items-center mb-4 text-xs text-gray-500 dark:text-gray-400">
                                    <span>Undangan: {stats.total}</span>
                                    <span className="font-semibold text-gray-800 dark:text-white">{stats.present} Hadir</span>
                                </div>
                                <button 
                                    onClick={() => { setSelectedEvent(event); setView('DETAIL'); setAttendanceSearch(''); }}
                                    className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition ${isStarted ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
                                >
                                    <ClipboardCheck size={16}/> {isStarted ? 'Kelola Absensi' : 'Buka Absensi'}
                                </button>
                            </div>
                        </div>
                    )
                })}
                {activeEvents.length === 0 && <div className="col-span-full py-12 text-center text-gray-500 border-2 border-dashed rounded-xl">Belum ada agenda acara.</div>}
            </div>
        )}

        {/* --- VIEW: DETAIL (Mark Attendance) --- */}
        {view === 'DETAIL' && selectedEvent && (
            <div className="space-y-6 animate-in slide-in-from-right-10 duration-300">
                {!selectedEvent.actual_start_time && (
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
                        <div className="p-4 border-b border-gray-100 dark:border-dark-border flex flex-col sm:flex-row gap-4">
                            <select className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 text-sm rounded-lg px-3 py-2 outline-none dark:text-white"
                                value={attendanceStatusFilter} onChange={(e) => setAttendanceStatusFilter(e.target.value as any)}>
                                <option value="ALL">Semua Status</option>
                                <option value="Present">Hadir</option>
                                <option value="Excused">Izin</option>
                                <option value="Absent">Alpha/Belum</option>
                            </select>
                            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer bg-gray-50 dark:bg-gray-800 px-3 rounded-lg border dark:border-gray-700 select-none">
                                <input type="checkbox" checked={showUninvited} onChange={() => setShowUninvited(!showUninvited)} className="rounded text-primary-600"/>
                                Tampilkan Semua Anggota
                            </label>
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input type="text" placeholder="Cari nama..." value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white outline-none"/>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {filteredMembers.map(m => {
                                const record = attendance.find(a => a.event_id === selectedEvent.id && a.member_id === m.id);
                                const status = record?.status;
                                const isStarted = !!selectedEvent.actual_start_time;
                                const detailStatus = getDetailedStatus(record, selectedEvent);

                                return (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                                status === 'Present' ? 'bg-green-100 text-green-600' :
                                                status === 'Excused' ? 'bg-yellow-100 text-yellow-600' :
                                                status === 'Absent' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'
                                            }`}>{m.full_name.charAt(0)}</div>
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white text-sm">{m.full_name}</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-gray-500">{m.divisions?.name || '-'}</p>
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
                                            <button onClick={() => handleAttendanceChange(m.id, 'Present')} disabled={!isStarted}
                                                className={`p-2 rounded-lg transition ${status === 'Present' ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-green-50 hover:text-green-600'}`}>
                                                <CheckCircle2 size={18} />
                                            </button>
                                            <button onClick={() => handleAttendanceChange(m.id, 'Excused')} disabled={!isStarted}
                                                className={`p-2 rounded-lg transition ${status === 'Excused' ? 'bg-yellow-500 text-white' : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-600'}`}>
                                                <HelpCircle size={18} />
                                            </button>
                                            <button onClick={() => handleAttendanceChange(m.id, 'Absent')} disabled={!isStarted}
                                                className={`p-2 rounded-lg transition ${status === 'Absent' ? 'bg-red-500 text-white' : 'text-gray-400 hover:bg-red-50 hover:text-red-600'}`}>
                                                <XCircle size={18} />
                                            </button>
                                            {status && (
                                                <button onClick={() => handleResetStatus(m.id)} disabled={!isStarted} className="ml-2 p-1 text-gray-300 hover:text-red-400">
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

        {/* --- VIEW: RECAP --- */}
        {view === 'RECAP' && (
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden animate-in fade-in">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-white">Rekapitulasi Kehadiran</h3>
                            <p className="text-sm text-gray-500">Analisis keaktifan anggota.</p>
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
                        <div className="bg-yellow-50 text-center p-3 rounded-lg border border-yellow-200"><p className="text-xs text-yellow-700 font-bold">Cukup</p><p className="text-xl font-bold text-yellow-800">{recapSummary.FAIR}</p></div>
                        <div className="bg-red-50 text-center p-3 rounded-lg border border-red-200"><p className="text-xs text-red-700 font-bold">Jarang</p><p className="text-xl font-bold text-red-800">{recapSummary.POOR}</p></div>
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
                                    <td className="px-6 py-4 text-gray-500">{member.divisions?.name || '-'}</td>
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

        {/* --- MEMBER DETAIL MODAL --- */}
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
    </div>
  );
};
