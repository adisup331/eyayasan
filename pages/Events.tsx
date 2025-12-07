import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Event, EventAttendance, Member } from '../types';
import { 
  Plus, Edit, Trash2, CalendarDays, MapPin, 
  ClipboardCheck, CheckCircle2, XCircle, HelpCircle, 
  Clock, Search, ChevronLeft, Maximize2, Minimize2, PieChart, Users, AlertTriangle, Filter, RotateCcw, UserPlus
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';

interface EventsProps {
  events: Event[];
  members: Member[];
  attendance: EventAttendance[];
  onRefresh: () => void;
}

export const Events: React.FC<EventsProps> = ({ events, members, attendance, onRefresh }) => {
  const [view, setView] = useState<'LIST' | 'ATTENDANCE'>('LIST');
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
      setInviteType('ALL'); // Default for editing, logic handled differently if needed
      setSelectedInvitees([]);
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
    
    const payload = {
      name,
      date: fullDate.toISOString(),
      location,
      description,
      status
    };

    try {
      let eventId = editingItem?.id;

      if (editingItem) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { data: newEvent, error } = await supabase.from('events').insert([payload]).select().single();
        if (error) throw error;
        eventId = newEvent.id;

        // --- Handle Initial Attendance Logic ---
        if (eventId) {
            let membersToAdd: string[] = [];
            // Filter members with division only if inviting ALL, 
            // but for simplicity and consistency with UI filtering, let's include valid members.
            const validMembers = members.filter(m => m.division_id);

            if (inviteType === 'ALL') {
                membersToAdd = validMembers.map(m => m.id);
            } else {
                membersToAdd = selectedInvitees;
            }

            if (membersToAdd.length > 0) {
                const attendancePayload = membersToAdd.map(mid => ({
                    event_id: eventId,
                    member_id: mid,
                    status: 'Absent' // Default status: Belum Hadir / Alpha until changed
                }));
                
                // Batch Insert
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
             {view === 'ATTENDANCE' && (
                 <button 
                    onClick={() => setView('LIST')}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:text-primary-600 transition"
                >
                    <ChevronLeft size={24} />
                </button>
             )}
             <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <CalendarDays className="text-primary-600 dark:text-primary-400" /> 
                {view === 'ATTENDANCE' && selectedEvent ? `Absensi: ${selectedEvent.name}` : 'Agenda & Acara'}
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
                        <button onClick={() => handleOpenModal(item)} className="text-gray-400 hover:text-blue-600"><Edit size={16}/></button>
                        <button onClick={() => confirmDelete(item.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
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
                        <ClipboardCheck size={16} /> Kelola Absensi
                     </button>
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
             <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
                Belum ada acara yang dijadwalkan.
             </div>
          )}
        </div>
      )}

      {/* --- RENDER VIEW: ATTENDANCE --- */}
      {view === 'ATTENDANCE' && selectedEvent && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Event Info & Stats Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Info Card */}
                <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{selectedEvent.name}</h3>
                            <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                                <p className="flex items-center gap-2"><CalendarDays size={14}/> {new Date(selectedEvent.date).toLocaleDateString('id-ID', {weekday: 'long', day:'numeric', month:'long', year:'numeric'})}</p>
                                <p className="flex items-center gap-2"><Clock size={14}/> {new Date(selectedEvent.date).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} WIB</p>
                                <p className="flex items-center gap-2"><MapPin size={14}/> {selectedEvent.location || 'Online / Tidak ada lokasi'}</p>
                            </div>
                        </div>
                        <span className={`mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            selectedEvent.status === 'Upcoming' ? 'bg-blue-100 text-blue-700' : 
                            selectedEvent.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {selectedEvent.status}
                        </span>
                    </div>
                    
                    {/* Numeric Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center border border-green-100 dark:border-green-800">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{getAttendanceStats(selectedEvent.id).present}</div>
                            <div className="text-xs font-medium text-green-800 dark:text-green-300 uppercase">Hadir</div>
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center border border-yellow-100 dark:border-yellow-800">
                             <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{getAttendanceStats(selectedEvent.id).excused}</div>
                            <div className="text-xs font-medium text-yellow-800 dark:text-yellow-300 uppercase">Izin / Sakit</div>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center border border-red-100 dark:border-red-800">
                             <div className="text-2xl font-bold text-red-600 dark:text-red-400">{getAttendanceStats(selectedEvent.id).absent}</div>
                            <div className="text-xs font-medium text-red-800 dark:text-red-300 uppercase">Alpha</div>
                        </div>
                    </div>
                </div>

                {/* Chart Card */}
                <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex flex-col justify-center items-center">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2"><PieChart size={16}/> Grafik Kehadiran</h4>
                    <div className="w-full h-48">
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
                                    <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                                </RePieChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">Belum ada data</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-dark-border flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    <div className="relative flex-1 max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Cari anggota..." 
                            value={attendanceSearch}
                            onChange={(e) => setAttendanceSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-gray-500" />
                            <select 
                                value={attendanceStatusFilter}
                                onChange={(e) => setAttendanceStatusFilter(e.target.value as any)}
                                className="py-2 px-3 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="ALL">Semua Status</option>
                                <option value="Present">Hadir</option>
                                <option value="Excused">Izin/Sakit</option>
                                <option value="Absent">Alpha/Absen</option>
                                <option value="Unrecorded">Belum Absen</option>
                            </select>
                        </div>

                        {/* Toggle to Show All / Only Invited */}
                        <button
                            onClick={() => setShowUninvited(!showUninvited)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition ${
                                showUninvited 
                                ? 'bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300' 
                                : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-100'
                            }`}
                        >
                            <UserPlus size={16} />
                            {showUninvited ? 'Sembunyikan yg tidak diundang' : 'Tampilkan semua anggota'}
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Nama Anggota</th>
                                <th className="px-6 py-4 text-center">Hadir</th>
                                <th className="px-6 py-4 text-center">Izin</th>
                                <th className="px-6 py-4 text-center">Alpha / Absen</th>
                                <th className="px-6 py-4 text-right">Status Saat Ini</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                            {filteredMembers.map(member => {
                                const record = attendance.find(a => a.event_id === selectedEvent.id && a.member_id === member.id);
                                const currentStatus = record?.status; // undefined means Belum Absen

                                return (
                                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{member.full_name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{member.divisions?.name || 'Tanpa Bidang'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleAttendanceChange(member.id, 'Present')}
                                                className={`p-2 rounded-full transition ${currentStatus === 'Present' ? 'bg-green-100 text-green-600 ring-2 ring-green-500 shadow-sm' : 'text-gray-300 hover:bg-green-50 hover:text-green-500'}`}
                                            >
                                                <CheckCircle2 size={24} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleAttendanceChange(member.id, 'Excused')}
                                                className={`p-2 rounded-full transition ${currentStatus === 'Excused' ? 'bg-yellow-100 text-yellow-600 ring-2 ring-yellow-500 shadow-sm' : 'text-gray-300 hover:bg-yellow-50 hover:text-yellow-500'}`}
                                            >
                                                <HelpCircle size={24} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleAttendanceChange(member.id, 'Absent')}
                                                className={`p-2 rounded-full transition ${currentStatus === 'Absent' ? 'bg-red-100 text-red-600 ring-2 ring-red-500 shadow-sm' : 'text-gray-300 hover:bg-red-50 hover:text-red-500'}`}
                                            >
                                                <XCircle size={24} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {currentStatus ? (
                                                    <>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                            currentStatus === 'Present' ? 'bg-green-100 text-green-700' :
                                                            currentStatus === 'Excused' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                            {currentStatus === 'Present' ? 'HADIR' : currentStatus === 'Excused' ? 'IZIN' : 'ALPHA'}
                                                        </span>
                                                        <button 
                                                            onClick={() => handleResetStatus(member.id)}
                                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition"
                                                            title="Reset Status (Hapus dari daftar undangan)"
                                                        >
                                                            <RotateCcw size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Belum Diundang</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        Tidak ada anggota yang sesuai filter (atau belum ada yang diundang).
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

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
            {!editingItem && (
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
                     *Hanya anggota yang dipilih yang akan muncul di daftar absensi (Status awal: Alpha/Belum Hadir).
                  </p>
               </div>
            )}

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