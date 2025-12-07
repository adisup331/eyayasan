import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Wallet, Users, Layers, Briefcase, CalendarDays, ClipboardCheck, Clock, Filter, Copy, Check } from '../components/ui/Icons';
import { Member, Program, Division, Event, EventAttendance } from '../types';

interface DashboardProps {
  members: Member[];
  programs: Program[];
  divisions: Division[];
  events: Event[];
  attendance: EventAttendance[];
  isDarkMode: boolean;
}

// Helper to parse months
const parseMonths = (monthStr: string): string[] => {
    try {
      const parsed = JSON.parse(monthStr);
      return Array.isArray(parsed) ? parsed : [monthStr];
    } catch (e) {
      return monthStr ? [monthStr] : [];
    }
  };

export const Dashboard: React.FC<DashboardProps> = ({ members, programs, divisions, events, attendance, isDarkMode }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isCopied, setIsCopied] = useState(false);

  // Statistics
  const totalCost = useMemo(() => programs.reduce((acc, curr) => acc + curr.cost, 0), [programs]);
  const activePrograms = programs.filter(p => p.status === 'In Progress').length;
  const upcomingEvents = events.filter(e => e.status === 'Upcoming').length;

  // Available Years for Filter
  const availableYears = useMemo(() => {
    const years = new Set(programs.map(p => p.year || 2024));
    // Ensure current year is always available
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [programs]);

  // Current Month Programs
  const currentMonthPrograms = useMemo(() => {
    const allMonths = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
    const currentMonthIndex = new Date().getMonth();
    const currentMonthName = allMonths[currentMonthIndex];

    return programs.filter(p => {
        const months = parseMonths(p.month);
        const programYear = p.year || 2024;
        
        // Filter by Month AND Year
        return months.includes(currentMonthName) && programYear === selectedYear;
    });
  }, [programs, selectedYear]);

  // Chart Data: Cost per Division
  const costPerDivision = useMemo(() => {
    const data: Record<string, number> = {};
    programs.forEach(p => {
      const divName = divisions.find(d => d.id === p.division_id)?.name || 'Unknown';
      data[divName] = (data[divName] || 0) + p.cost;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [programs, divisions]);

  // Chart Data: Programs per Status
  const statusData = useMemo(() => {
    const counts: Record<string, number> = { Planned: 0, 'In Progress': 0, Completed: 0 };
    programs.forEach(p => {
      if (counts[p.status] !== undefined) counts[p.status]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [programs]);

  // Chart Data: Attendance Rate (Last 5 Completed Events)
  const attendanceTrend = useMemo(() => {
      // 1. Get completed events sorted by date
      const completedEvents = events
        .filter(e => e.status === 'Completed')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-5); // Take last 5

      // 2. Calculate percentage per event
      return completedEvents.map(event => {
          const records = attendance.filter(a => a.event_id === event.id);
          const presentCount = records.filter(a => a.status === 'Present').length;
          // Assume total members is consistent, or use attendance count if larger (should handle active members ideally)
          const totalMembers = members.length || 1; 
          const percentage = Math.round((presentCount / totalMembers) * 100);
          
          return {
              name: event.name.length > 15 ? event.name.substring(0, 15) + '...' : event.name,
              fullDate: new Date(event.date).toLocaleDateString(),
              percentage: percentage,
              present: presentCount
          }
      });
  }, [events, attendance, members]);

  // List: Upcoming 3 Events
  const upcomingList = useMemo(() => {
      return events
        .filter(e => e.status === 'Upcoming')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 3);
  }, [events]);


  const COLORS = ['#94a3b8', '#3b82f6', '#10b981'];

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

  const tooltipStyle = isDarkMode ? {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    color: '#f1f5f9'
  } : undefined;

  // --- Copy to WhatsApp Logic ---
  const handleCopyToWA = () => {
    const currentMonthName = new Date().toLocaleDateString('id-ID', { month: 'long' });
    
    let text = `*Program Proker Bulan ${currentMonthName} dari berbagai bidang dan amalsholih di kerjakan*\n\n`;

    if (currentMonthPrograms.length === 0) {
        text += "_(Belum ada program terdaftar bulan ini)_";
    } else {
        currentMonthPrograms.forEach((p, index) => {
            const divName = divisions.find(d => d.id === p.division_id)?.name || 'Umum';
            text += `${index + 1}. ${p.name} (${divName})\n`;
        });
    }

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard Overview</h2>
      
      {/* Stat Cards Row 1: General */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center space-x-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Anggota</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{members.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Acara Mendatang</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{upcomingEvents}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center space-x-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
            <Briefcase size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Program Aktif</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activePrograms}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center space-x-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Anggaran</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{formatCurrency(totalCost)}</p>
          </div>
        </div>
      </div>

      {/* Program Bulan Ini Section */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Briefcase size={20} className="text-primary-500" /> 
                <span>Program Kerja Bulan Ini ({new Date().toLocaleDateString('id-ID', { month: 'long' })})</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
                 {/* Copy to WA Button */}
                 <button 
                    onClick={handleCopyToWA}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 transition mr-2"
                    title="Salin daftar program untuk WhatsApp"
                 >
                    {isCopied ? <Check size={16} /> : <Copy size={16} />}
                    {isCopied ? 'Tersalin!' : 'Salin Format WA'}
                 </button>

                 <div className="flex items-center gap-2">
                     <label className="text-xs text-gray-500 dark:text-gray-400">Filter Tahun:</label>
                     <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-md px-2 py-1 focus:ring-1 focus:ring-primary-500 outline-none"
                     >
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                     </select>
                 </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold">
                    <tr>
                        <th className="px-4 py-2 rounded-l-lg">Program</th>
                        <th className="px-4 py-2">Tahun</th>
                        <th className="px-4 py-2">Bidang</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 rounded-r-lg text-right">Biaya</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                    {currentMonthPrograms.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-2 font-medium text-gray-800 dark:text-white">{p.name}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{p.year}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{divisions.find(d => d.id === p.division_id)?.name || '-'}</td>
                            <td className="px-4 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                    p.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                    p.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {p.status}
                                </span>
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{formatCurrency(p.cost)}</td>
                        </tr>
                    ))}
                    {currentMonthPrograms.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 italic">
                                Tidak ada program yang dijadwalkan bulan ini pada tahun {selectedYear}.
                            </td>
                        </tr>
                    )}
                </tbody>
             </table>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart: Cost */}
          <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Alokasi Anggaran per Bidang</h3>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costPerDivision}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e5e7eb'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: isDarkMode ? '#94a3b8' : '#666'}} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `Rp${val/1000}k`} tick={{fontSize: 12, fill: isDarkMode ? '#94a3b8' : '#666'}} />
                    <Tooltip 
                    formatter={(value: number) => formatCurrency(value)} 
                    contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            </div>
         </div>

         {/* Side: Upcoming Events List */}
         <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <CalendarDays size={20} className="text-indigo-500" /> Agenda Terdekat
            </h3>
            <div className="flex-1 space-y-4">
                {upcomingList.map(event => (
                    <div key={event.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                             <span className="font-semibold text-gray-800 dark:text-white line-clamp-1">{event.name}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                             <Clock size={12} />
                             {new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                        </div>
                        <div className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 py-1 px-2 rounded w-fit">
                            {event.status}
                        </div>
                    </div>
                ))}
                {upcomingList.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                        <p>Tidak ada agenda mendatang.</p>
                    </div>
                )}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend Area Chart */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
             <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <ClipboardCheck size={20} className="text-green-500" /> Tren Kehadiran (5 Acara Terakhir)
            </h3>
            <div className="h-64">
                {attendanceTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={attendanceTrend}>
                        <defs>
                            <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} />
                        <YAxis unit="%" />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e5e7eb'}/>
                        <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => `${val}% Hadir`} labelFormatter={(label, payload) => payload[0]?.payload.fullDate} />
                        <Area type="monotone" dataKey="percentage" stroke="#10b981" fillOpacity={1} fill="url(#colorPv)" />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                        Belum ada data acara yang selesai.
                    </div>
                )}
            </div>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Status Program Kerja</h3>
          <div className="flex items-center">
            <div className="h-64 w-2/3">
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    >
                    {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="w-1/3 flex flex-col gap-3">
                 {statusData.map((entry, index) => (
                    <div key={entry.name}>
                        <div className="flex items-center text-xs text-gray-500 mb-1">
                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index] }}></span>
                            {entry.name}
                        </div>
                        <div className="text-xl font-bold text-gray-800 dark:text-white">{entry.value}</div>
                    </div>
                ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};