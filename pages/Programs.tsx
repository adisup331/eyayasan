import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Program, Division, Organization, Member, Foundation, ReviewItem } from '../types';
import { 
  Plus, Edit, Trash2, Calendar, Briefcase, Wallet, Filter, AlertTriangle, 
  X, Layers, Table, FileSpreadsheet, Maximize2, Minimize2, Search,
  FileText, CheckCircle2, RefreshCw, AlertCircle, ChevronRight, Download, Printer, Check, Timer, MessageCircle, HelpCircle, XCircle, History, User, Users as UsersIcon, CalendarDays
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface ProgramsProps {
  data: Program[];
  divisions: Division[];
  organizations: Organization[];
  members: Member[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

type ViewMode = 'table' | 'sheet' | 'document' | 'calendar';

const parseMonths = (monthStr: string | null | undefined): string[] => {
  if (!monthStr) return [];
  try {
    const parsed = JSON.parse(monthStr);
    return Array.isArray(parsed) ? parsed : [monthStr];
  } catch (e) {
    return monthStr ? [monthStr] : [];
  }
};

export const Programs: React.FC<ProgramsProps> = ({ data, divisions, organizations, members, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isSheetFullScreen, setIsSheetFullScreen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Program | null>(null);
  
  // Review/Evaluation State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewProgram, setReviewProgram] = useState<Program | null>(null);
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [reviewTargetMonth, setReviewTargetMonth] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewResult, setReviewResult] = useState<'Success'|'Warning'|'Failed'|'Pending'>('Success');

  const [filterDivisionId, setFilterDivisionId] = useState('');
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear()); 
  const [filterMonth, setFilterMonth] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState(''); 
  const [costPerMonth, setCostPerMonth] = useState<number>(0);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [divisionId, setDivisionId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [status, setStatus] = useState<'Planned' | 'In Progress' | 'Completed'>('Planned');
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const filteredData = useMemo(() => {
    return data.filter(p => {
        if (filterYear && (p.year || 2024) !== filterYear) return false;
        if (filterDivisionId && p.division_id !== filterDivisionId) return false;
        if (filterMonth && !parseMonths(p.month).includes(filterMonth)) return false;
        return true;
    }).sort((a, b) => {
        const divA = divisions.find(d => d.id === a.division_id);
        const divB = divisions.find(d => d.id === b.division_id);
        return (divA?.order_index ?? 0) - (divB?.order_index ?? 0);
    });
  }, [data, filterDivisionId, filterYear, filterMonth, divisions]);

  const groupedByDivision = useMemo(() => {
    const groups: Record<string, Program[]> = {};
    filteredData.forEach(p => {
      const divId = p.division_id || 'unassigned';
      if (!groups[divId]) groups[divId] = [];
      groups[divId].push(p);
    });
    return groups;
  }, [filteredData]);

  const calculateProgramTotal = (p: Program) => {
      const freq = parseMonths(p.month).length || 1;
      return p.cost * freq;
  };

  const handleOpenReview = (program: Program) => {
      setReviewProgram(program);
      setReviewDate(new Date().toISOString().split('T')[0]);
      setReviewTitle('');
      setReviewContent('');
      setReviewResult('Success');
      
      const pMonths = parseMonths(program.month);
      setReviewTargetMonth(pMonths[0] || '');
      
      setIsReviewModalOpen(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reviewProgram) return;
      setLoading(true);
      
      const newReview: any = { 
          id: Date.now().toString(), 
          date: reviewDate, 
          target_month: reviewTargetMonth,
          title: reviewTitle, 
          content: reviewContent, 
          result_status: reviewResult, 
          images: [] 
      };
      
      const updatedReviews = [...(reviewProgram.review_data || []), newReview];
      try {
          const { error } = await supabase.from('programs').update({ review_data: updatedReviews }).eq('id', reviewProgram.id);
          if (error) throw error;
          showToast("Evaluasi disimpan");
          onRefresh();
          setIsReviewModalOpen(false);
      } catch (err: any) { showToast(err.message, "error"); } finally { setLoading(false); }
  };

  const handleDeleteReview = async (prog: Program, reviewId: string) => {
      if(!confirm("Hapus evaluasi ini?")) return;
      const updated = (prog.review_data || []).filter(r => r.id !== reviewId);
      try {
          await supabase.from('programs').update({ review_data: updated }).eq('id', prog.id);
          onRefresh();
          setReviewProgram(prev => prev ? {...prev, review_data: updated} : null);
      } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleOpen = (program?: Program) => {
    if (program) {
      setEditingItem(program); setName(program.name); setDescription(program.description || '');
      setCostPerMonth(program.cost); setDivisionId(program.division_id); setOrganizationId(program.organization_id || '');
      setYear(program.year || new Date().getFullYear()); setStatus(program.status);
      setSelectedMonths(parseMonths(program.month));
    } else {
      setEditingItem(null); setName(''); setDescription(''); setCostPerMonth(0);
      setDivisionId(divisions[0]?.id || ''); setOrganizationId(''); 
      setYear(filterYear || new Date().getFullYear());
      setStatus('Planned'); setSelectedMonths([]);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload: any = { 
        name, description, cost: costPerMonth, 
        month: JSON.stringify(selectedMonths), 
        year, division_id: divisionId, 
        organization_id: organizationId || null, 
        status 
    };
    if(!editingItem && activeFoundation) payload.foundation_id = activeFoundation.id;
    try {
      if (editingItem) { await supabase.from('programs').update(payload).eq('id', editingItem.id); } 
      else { await supabase.from('programs').insert([payload]); }
      onRefresh(); setIsModalOpen(false); showToast('Program disimpan');
    } catch (error: any) { showToast(error.message, 'error'); } finally { setLoading(false); }
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await supabase.from('programs').delete().eq('id', deleteConfirm.id);
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
      showToast("Program dihapus");
    } catch (error: any) { showToast(error.message, 'error'); }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className={`flex flex-col space-y-4 ${isSheetFullScreen ? 'fixed inset-0 z-[100] bg-white dark:bg-dark-bg p-6 overflow-hidden' : ''}`}>
      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[110] animate-in fade-in slide-in-from-bottom-4 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}
              <span className="text-sm font-bold">{toast.message}</span>
          </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 no-print">
        <div>
            <h2 className={`${isSheetFullScreen ? 'text-xl' : 'text-2xl'} font-black text-gray-800 dark:text-white flex items-center gap-2`}>
                <Briefcase className="text-primary-600" /> Program Kerja & Anggaran
            </h2>
            {!isSheetFullScreen && <p className="text-xs text-gray-500 font-medium mt-1">Perencanaan kegiatan tahunan, pemantauan realisasi biaya, dan evaluasi terjadwal.</p>}
        </div>
        
        <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex items-center shadow-inner">
                <button onClick={() => setViewMode('table')} className={`p-2 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${viewMode === 'table' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}><Table size={16}/> LIST</button>
                <button onClick={() => setViewMode('sheet')} className={`p-2 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${viewMode === 'sheet' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}><FileSpreadsheet size={16}/> SHEET</button>
                <button onClick={() => setViewMode('document')} className={`p-2 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${viewMode === 'document' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}><FileText size={16}/> DOCS</button>
                <button onClick={() => setViewMode('calendar')} className={`p-2 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}><Calendar size={16}/> CAL</button>
            </div>
            
            {viewMode === 'sheet' && (
                <button 
                  onClick={() => setIsSheetFullScreen(!isSheetFullScreen)}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-primary-600 transition shadow-sm"
                  title={isSheetFullScreen ? "Kecilkan Layar" : "Layar Penuh"}
                >
                  {isSheetFullScreen ? <Minimize2 size={20}/> : <Maximize2 size={20}/>}
                </button>
            )}

            {!isSuperAdmin && (
                <button onClick={() => handleOpen()} className="flex-1 xl:flex-none bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 transition text-sm font-black shadow-lg shadow-primary-600/20 active:scale-95">
                    <Plus size={18} /> {isSheetFullScreen ? '' : 'BUAT PROGRAM'}
                </button>
            )}
        </div>
      </div>

      {/* FILTER BAR - VISIBLE IN BOTH MODES */}
      <div className={`flex flex-col md:flex-row items-center gap-3 bg-white dark:bg-dark-card p-3 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm no-print ${isSheetFullScreen ? 'mb-2' : ''}`}>
          <div className="flex items-center gap-2 w-full md:w-fit">
              <Filter size={16} className="text-gray-400" />
              <select value={filterDivisionId} onChange={e => setFilterDivisionId(e.target.value)} className="flex-1 md:w-40 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">SEMUA BIDANG</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
          </div>
          <div className="flex items-center gap-2 w-full md:w-fit">
              <CalendarDays size={16} className="text-gray-400" />
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="flex-1 md:w-36 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">SEMUA BULAN</option>
                  {allMonths.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
          </div>
          <div className="flex items-center gap-2 w-full md:w-fit">
              <Calendar size={16} className="text-gray-400" />
              <input type="number" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="flex-1 md:w-20 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="md:ml-auto flex items-center gap-4 text-right">
              <div className="hidden lg:block">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Terfilter</p>
                  <p className={`${isSheetFullScreen ? 'text-base' : 'text-lg'} font-black text-primary-600`}>{formatCurrency(filteredData.reduce((acc, p) => acc + calculateProgramTotal(p), 0))}</p>
              </div>
          </div>
      </div>

      {/* VIEW CONTENT */}
      <div className={`bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm overflow-hidden flex flex-col ${isSheetFullScreen ? 'flex-1' : 'min-h-[400px]'}`}>
          {viewMode === 'table' && (
              <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest border-b">
                            <tr>
                                <th className="px-6 py-4">Nama Program & Bidang</th>
                                <th className="px-6 py-4">Periode Pelaksanaan</th>
                                <th className="px-6 py-4 text-right">Biaya / Bulan</th>
                                <th className="px-6 py-4 text-right">Total Anggaran</th>
                                <th className="px-6 py-4 text-center">Evaluasi</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                            {filteredData.map(item => {
                                const revCount = item.review_data?.length || 0;
                                return (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900 dark:text-white mb-1">{item.name}</div>
                                        <div className="text-[9px] font-black text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded w-fit uppercase">{divisions.find(d => d.id === item.division_id)?.name || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{item.year}</div>
                                        <div className="text-[10px] text-gray-500 max-w-[200px] truncate">{parseMonths(item.month).join(', ')}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-600 dark:text-gray-400">{formatCurrency(item.cost)}</td>
                                    <td className="px-6 py-4 text-right font-black text-gray-900 dark:text-white">{formatCurrency(calculateProgramTotal(item))}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => handleOpenReview(item)}
                                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 mx-auto border transition ${
                                                revCount > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                                            }`}
                                        >
                                            <CheckCircle2 size={12}/> {revCount} LAPORAN
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpen(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit Program"><Edit size={18}/></button>
                                            <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id})} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 size={18}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                            {filteredData.length === 0 && (
                                <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-bold italic">Tidak ditemukan program untuk kriteria ini.</td></tr>
                            )}
                        </tbody>
                    </table>
              </div>
          )}

          {viewMode === 'sheet' && (
              <div className="flex-1 overflow-auto bg-white dark:bg-dark-card border-t dark:border-gray-800">
                  <table className="w-full text-left text-[11px] border-collapse min-w-[1400px]">
                      <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 font-black uppercase tracking-widest sticky top-0 z-20">
                          <tr>
                              <th className="p-4 border min-w-[320px] sticky left-0 bg-gray-100 dark:bg-gray-800 z-30 shadow-[1px_0_0_0_#e5e7eb]">MATRIKS PROGRAM KERJA</th>
                              <th className="p-4 border text-right bg-gray-100 dark:bg-gray-800 w-32">BIAYA/BLN</th>
                              {allMonths.map(m => <th key={m} className={`p-2 border text-center whitespace-nowrap bg-gray-100 dark:bg-gray-800 ${filterMonth === m ? 'bg-primary-50 text-primary-600 ring-2 ring-inset ring-primary-500' : ''}`}>{m.substring(0,3)}</th>)}
                              <th className="p-4 border text-right font-black sticky right-0 bg-gray-100 dark:bg-gray-800 shadow-[-1px_0_0_0_#e5e7eb] w-36">TOTAL BIAYA</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-dark-border">
                          {Object.entries(groupedByDivision).map(([divId, progs]) => (
                              <React.Fragment key={divId}>
                                  <tr className="bg-gray-50/50 dark:bg-gray-900/30">
                                      <td colSpan={15} className="p-2 px-4 font-black text-primary-600 uppercase text-[9px] tracking-widest border-y dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-900/30 z-10">
                                          BIDANG: {divisions.find(d => d.id === divId)?.name || 'TANPA BIDANG'}
                                      </td>
                                  </tr>
                                  {progs.map(p => {
                                      const pMonths = parseMonths(p.month);
                                      const revCount = p.review_data?.length || 0;
                                      return (
                                          <tr key={p.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 group transition">
                                              <td className="p-3 border sticky left-0 bg-white dark:bg-dark-card group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 z-10 shadow-[1px_0_0_0_#e5e7eb] font-bold">
                                                  <div className="flex items-center justify-between gap-2">
                                                      <div className="flex-1 truncate cursor-pointer hover:text-primary-600 transition" onClick={() => handleOpen(p)}>
                                                          {p.name}
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                          <button 
                                                              onClick={() => handleOpenReview(p)} 
                                                              className={`p-1 rounded transition relative ${revCount > 0 ? 'text-green-600' : 'text-gray-300 hover:text-green-500'}`}
                                                              title="Buka Evaluasi"
                                                          >
                                                              <CheckCircle2 size={14}/>
                                                              {revCount > 0 && <span className="absolute -top-1 -right-1 text-[7px] bg-green-500 text-white w-3 h-3 rounded-full flex items-center justify-center font-black">{revCount}</span>}
                                                          </button>
                                                          <button onClick={() => handleOpen(p)} className="p-1 text-gray-300 hover:text-blue-500 transition opacity-0 group-hover:opacity-100" title="Edit"><Edit size={14}/></button>
                                                      </div>
                                                  </div>
                                              </td>
                                              <td className="p-3 border text-right font-medium text-gray-500 dark:text-gray-400">{formatCurrency(p.cost)}</td>
                                              {allMonths.map(month => {
                                                  const isScheduled = pMonths.includes(month);
                                                  const hasReviewThisMonth = p.review_data?.some(r => (r as any).target_month === month);
                                                  const isHighlighted = filterMonth === month;
                                                  
                                                  return (
                                                    <td key={month} className={`border text-center transition-colors ${isScheduled ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''} ${isHighlighted && isScheduled ? 'ring-2 ring-inset ring-primary-500' : ''}`}>
                                                        {isScheduled && (
                                                            <div className="relative group/cell mx-auto w-fit">
                                                                <div className={`w-3 h-3 rounded-full shadow-sm animate-in zoom-in ${hasReviewThisMonth ? 'bg-green-600' : 'bg-blue-600'}`}></div>
                                                                {hasReviewThisMonth && <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                            </div>
                                                        )}
                                                    </td>
                                                  );
                                              })}
                                              <td className="p-3 border text-right font-black text-gray-900 dark:text-white sticky right-0 bg-white dark:bg-dark-card group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 z-10 shadow-[-1px_0_0_0_#e5e7eb]">{formatCurrency(calculateProgramTotal(p))}</td>
                                          </tr>
                                      )
                                  })}
                              </React.Fragment>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}

          {viewMode === 'document' && (
              <div className="flex-1 bg-gray-50 dark:bg-dark-bg p-4 md:p-12 flex justify-center overflow-auto">
                  <div className="bg-white shadow-2xl w-full max-w-[21cm] p-[2cm] min-h-[29.7cm] text-black font-serif border border-gray-200">
                      <div className="text-center mb-10 border-b-4 border-double border-black pb-4">
                          <h1 className="text-2xl font-black uppercase tracking-tighter mb-1">{activeFoundation?.name || 'E-YAYASAN'}</h1>
                          <p className="text-sm italic">Matriks Perencanaan Tahunan & Estimasi Penggunaan Dana</p>
                          <p className="text-xs font-bold mt-1">TAHUN ANGGARAN: {filterYear}</p>
                          {filterMonth && <p className="text-[10px] font-black uppercase tracking-widest mt-1 bg-gray-100 py-0.5 px-2 rounded inline-block">Filter Bulan: {filterMonth}</p>}
                      </div>

                      {Object.entries(groupedByDivision).map(([divId, progs], idx) => {
                          const division = divisions.find(d => d.id === divId);
                          const headMember = members.find(m => m.id === division?.head_member_id);
                          const divisionMembers = members.filter(m => m.division_id === divId);

                          return (
                          <div key={divId} className="mb-8 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                              <div className="border-b-2 border-black pb-2 mb-4">
                                <h3 className="text-sm font-black uppercase tracking-tight">BIDANG: {division?.name || 'LAIN-LAIN'}</h3>
                                <div className="mt-2 space-y-1">
                                    <div className="flex items-center gap-2 text-xs">
                                        <User size={12} className="text-gray-600"/>
                                        <span className="font-bold">Kepala Bidang:</span>
                                        <span>{headMember?.full_name || 'Belum Ditentukan'}</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-[10px] text-gray-600 italic">
                                        <UsersIcon size={12} className="shrink-0 mt-0.5"/>
                                        <div>
                                            <span className="font-bold not-italic">Staf/Anggota:</span>{' '}
                                            {divisionMembers.length > 0 
                                                ? divisionMembers.map(m => m.full_name).join(', ') 
                                                : 'Tidak ada anggota terdaftar'}
                                        </div>
                                    </div>
                                </div>
                              </div>

                              <table className="w-full border-collapse border border-black text-[11px]">
                                  <thead className="bg-gray-200">
                                      <tr>
                                          <th className="border border-black p-2 text-center w-8">No</th>
                                          <th className="border border-black p-2 text-left">Nama Program / Kegiatan</th>
                                          <th className="border border-black p-2 text-center w-32">Bulan Pelaksanaan</th>
                                          <th className="border border-black p-2 text-center w-16">Freq</th>
                                          <th className="border border-black p-2 text-right w-24">Estimasi Biaya</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {progs.map((p, pIdx) => {
                                          const pMonths = parseMonths(p.month);
                                          return (
                                          <tr key={p.id}>
                                              <td className="border border-black p-2 text-center">{pIdx + 1}</td>
                                              <td className="border border-black p-2">
                                                  <p className="font-bold">{p.name}</p>
                                                  <p className="text-[9px] italic mt-0.5 text-gray-600 line-clamp-1">{p.description || 'Tidak ada deskripsi.'}</p>
                                              </td>
                                              <td className={`border border-black p-2 text-center text-[9px] font-medium leading-tight ${filterMonth && pMonths.includes(filterMonth) ? 'bg-yellow-50' : ''}`}>
                                                  {pMonths.join(', ')}
                                              </td>
                                              <td className="border border-black p-2 text-center font-bold">{pMonths.length}x</td>
                                              <td className="border border-black p-2 text-right font-bold">{formatCurrency(calculateProgramTotal(p))}</td>
                                          </tr>
                                      )})}
                                      <tr className="bg-gray-50 font-bold">
                                          <td colSpan={4} className="border border-black p-2 text-right uppercase">Subtotal Unit Kerja</td>
                                          <td className="border border-black p-2 text-right">{formatCurrency(progs.reduce((sum, p) => sum + calculateProgramTotal(p), 0))}</td>
                                      </tr>
                                  </tbody>
                              </table>
                          </div>
                      )})}

                      <div className="mt-12 pt-8 border-t border-black grid grid-cols-2 gap-8 text-center text-xs">
                          <div>
                              <p className="mb-16">Diajukan Oleh,</p>
                              <p className="font-black underline">.........................................</p>
                              <p>Bendahara / Pemohon</p>
                          </div>
                          <div>
                              <p className="mb-16">Disetujui Oleh,</p>
                              <p className="font-black underline">.........................................</p>
                              <p>Pimpinan Yayasan</p>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {viewMode === 'calendar' && (
              <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in overflow-y-auto">
                  {allMonths.filter(m => !filterMonth || m === filterMonth).map((mName) => {
                      const monthPrograms = filteredData.filter(p => parseMonths(p.month).includes(mName));
                      return (
                          <div key={mName} className={`p-4 rounded-2xl border transition-all h-fit ${monthPrograms.length > 0 ? 'bg-white dark:bg-dark-card border-gray-100 dark:border-dark-border shadow-sm' : 'bg-gray-50/50 dark:bg-gray-900/20 border-dashed border-gray-200 dark:border-gray-800 opacity-60'}`}>
                              <div className="flex justify-between items-center mb-4">
                                  <h4 className={`text-sm font-black uppercase tracking-widest ${filterMonth === mName ? 'text-primary-600' : 'text-gray-400'}`}>{mName}</h4>
                                  {monthPrograms.length > 0 && <span className="text-[10px] font-black bg-primary-600 text-white px-2 py-0.5 rounded-full">{monthPrograms.length}</span>}
                              </div>
                              <div className="space-y-2">
                                  {monthPrograms.map(p => (
                                      <div key={p.id} onClick={() => handleOpen(p)} className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 flex flex-col gap-1 cursor-pointer hover:border-primary-400 transition-colors group">
                                          <p className="text-xs font-bold text-gray-800 dark:text-white line-clamp-1">{p.name}</p>
                                          <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase">
                                              <span className="truncate max-w-[80px]">{divisions.find(d => d.id === p.division_id)?.name || 'Umum'}</span>
                                              <span className="text-primary-600">{formatCurrency(p.cost)}</span>
                                          </div>
                                      </div>
                                  ))}
                                  {monthPrograms.length === 0 && <p className="text-[10px] text-gray-400 italic text-center py-4">Agenda Kosong</p>}
                              </div>
                          </div>
                      )
                  })}
              </div>
          )}
      </div>

      {/* FORM MODAL PROGRAM */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Program Kerja' : 'Tambah Program Baru'} size="lg">
          <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Judul Program Kerja</label>
                      <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition" placeholder="Misal: Maintenance Server Yayasan" />
                  </div>
                  <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Tujuan & Keterangan</label>
                      <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition" placeholder="Detail pelaksanaan program..." />
                  </div>
                  <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Unit / Bidang</label>
                      <select required value={divisionId} onChange={e => setDivisionId(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500 transition">
                          <option value="">-- Pilih Bidang --</option>
                          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Organisasi Internal</label>
                      <select value={organizationId} onChange={e => setOrganizationId(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500 transition">
                          <option value="">Umum (Seluruh Yayasan)</option>
                          {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Tahun Berjalan</label>
                      <input type="number" required value={year} onChange={e => setYear(Number(e.target.value))} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-bold outline-none" />
                  </div>
                  <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Biaya Per Satuan / Bulan</label>
                      <div className="relative">
                          <span className="absolute left-4 top-3.5 text-xs font-bold text-gray-400">Rp</span>
                          <input type="number" required value={costPerMonth} onChange={e => setCostPerMonth(Number(e.target.value))} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-10 pr-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                  </div>
              </div>

              <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-inner">
                  <label className="block text-[10px] font-black text-primary-600 uppercase tracking-widest mb-3 text-center">Tandai Jadwal Pelaksanaan</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {allMonths.map(month => (
                          <div 
                              key={month} 
                              onClick={() => setSelectedMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month])}
                              className={`text-center py-2 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${selectedMonths.includes(month) ? 'bg-primary-600 border-primary-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-400 hover:border-primary-300'}`}
                          >
                              {month.substring(0,3).toUpperCase()}
                          </div>
                      ))}
                  </div>
              </div>

              <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Status Proyek</label>
                  <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                      {['Planned', 'In Progress', 'Completed'].map(s => (
                          <button key={s} type="button" onClick={() => setStatus(s as any)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${status === s ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500'}`}>{s}</button>
                      ))}
                  </div>
              </div>

              <div className="pt-4 flex justify-between gap-3 border-t dark:border-gray-800">
                  {editingItem && (
                      <button type="button" onClick={() => setDeleteConfirm({isOpen: true, id: editingItem.id})} className="text-red-500 hover:bg-red-50 p-3 rounded-xl transition flex items-center gap-2 text-xs font-bold">
                          <Trash2 size={16}/> HAPUS
                      </button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">BATAL</button>
                    <button type="submit" disabled={loading} className="px-10 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-black shadow-xl shadow-primary-600/20 active:scale-95 transition-all">
                        {loading ? <RefreshCw size={18} className="animate-spin"/> : 'SIMPAN PROGRAM'}
                    </button>
                  </div>
              </div>
          </form>
      </Modal>

      {/* EVALUATION/REVIEW MODAL DENGAN TARGET JADWAL */}
      <Modal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} title={`Evaluasi Pelaksanaan: ${reviewProgram?.name}`} size="3xl">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
              <div className="lg:col-span-2 border-r dark:border-gray-800 pr-0 lg:pr-10 space-y-6">
                  <div className="bg-primary-50 dark:bg-primary-950/20 p-4 rounded-2xl border border-primary-100 dark:border-primary-900/30 mb-2">
                    <h4 className="text-sm font-black uppercase text-primary-600 dark:text-primary-400 tracking-widest flex items-center gap-2 mb-1">
                        <Plus size={18}/> Input Laporan
                    </h4>
                    <p className="text-[10px] text-gray-500 font-bold">Lengkapi detail progress untuk bulan pelaksanaan yang dipilih.</p>
                  </div>
                  
                  <form onSubmit={handleSaveReview} className="space-y-5">
                      <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Target Jadwal (Bulan)</label>
                          <select 
                            required 
                            value={reviewTargetMonth} 
                            onChange={e => setReviewTargetMonth(e.target.value)} 
                            className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl px-4 py-3 text-sm font-black outline-none text-blue-800 dark:text-blue-300 focus:ring-2 focus:ring-blue-500 transition"
                          >
                              {parseMonths(reviewProgram?.month).map(m => (
                                  <option key={m} value={m}>{m.toUpperCase()}</option>
                              ))}
                          </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Tanggal Lapor</label>
                              <input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Hasil Akhir</label>
                            <select value={reviewResult} onChange={e => setReviewResult(e.target.value as any)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500">
                                <option value="Success">Normal</option>
                                <option value="Warning">Kendala</option>
                                <option value="Failed">Gagal</option>
                                <option value="Pending">Antri</option>
                            </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Judul Temuan / Laporan</label>
                          <input type="text" required value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500" placeholder="Misal: Progress Pekerjaan 75%" />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Uraian Detail Evaluasi (Pengetikan)</label>
                          <textarea rows={10} required value={reviewContent} onChange={e => setReviewContent(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500 transition custom-scrollbar" placeholder="Ketik secara detail kondisi di lapangan, kendala yang dihadapi, serta solusi yang diambil..." />
                      </div>
                      <button type="submit" disabled={loading} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary-600/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                          <CheckCircle2 size={20}/> SIMPAN EVALUASI
                      </button>
                  </form>
              </div>

              <div className="lg:col-span-3 space-y-6">
                  <div className="flex items-center justify-between border-b dark:border-gray-800 pb-4">
                    <h4 className="text-sm font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                        <History size={18}/> Riwayat Laporan
                    </h4>
                    <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-500 px-3 py-1 rounded-full">{reviewProgram?.review_data?.length || 0} TOTAL</span>
                  </div>
                  
                  <div className="space-y-5 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar">
                      {reviewProgram?.review_data && reviewProgram.review_data.length > 0 ? [...reviewProgram.review_data].reverse().map(rev => (
                          <div key={rev.id} className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-gray-800 relative group/rev shadow-sm hover:shadow-md transition">
                              <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-4">
                                      <div className={`p-3 rounded-2xl text-white shadow-lg ${
                                          rev.result_status === 'Success' ? 'bg-green-500 shadow-green-500/20' :
                                          rev.result_status === 'Warning' ? 'bg-amber-500 shadow-amber-500/20' :
                                          rev.result_status === 'Failed' ? 'bg-red-500 shadow-red-500/20' : 'bg-gray-500 shadow-gray-500/20'
                                      }`}>
                                          {rev.result_status === 'Success' ? <CheckCircle2 size={20}/> : 
                                           rev.result_status === 'Warning' ? <AlertCircle size={20}/> :
                                           rev.result_status === 'Failed' ? <XCircle size={20}/> : <Timer size={20}/>}
                                      </div>
                                      <div>
                                          <div className="flex items-center gap-3">
                                              <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{rev.title}</p>
                                              <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black uppercase shadow-sm">Bulan: {(rev as any).target_month}</span>
                                          </div>
                                          <p className="text-[11px] font-bold text-gray-400 mt-0.5">{new Date(rev.date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
                                      </div>
                                  </div>
                                  {!isSuperAdmin && (
                                    <button onClick={() => handleDeleteReview(reviewProgram, rev.id)} className="p-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover/rev:opacity-100">
                                        <Trash2 size={20}/>
                                    </button>
                                  )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-50 dark:border-gray-800/50 whitespace-pre-wrap font-medium">
                                  {rev.content}
                              </div>
                          </div>
                      )) : (
                          <div className="py-40 text-center text-gray-300 flex flex-col items-center gap-4">
                              <div className="p-8 bg-gray-50 dark:bg-gray-900 rounded-full">
                                <FileText size={64} className="opacity-20"/>
                              </div>
                              <p className="text-sm font-black uppercase tracking-widest">Belum ada evaluasi tersimpan</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </Modal>

      {/* DELETE CONFIRM */}
      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null})} title="Hapus Data Program?">
          <div className="text-center space-y-4">
              <div className="bg-red-50 p-4 rounded-full w-fit mx-auto text-red-500"><AlertTriangle size={48}/></div>
              <p className="font-bold text-gray-700 dark:text-gray-300">Konfirmasi penghapusan permanen. <br/> <span className="text-xs text-gray-500 font-normal">Riwayat evaluasi dan anggaran terkait juga akan hilang.</span></p>
              <div className="flex justify-center gap-3 pt-4 border-t dark:border-gray-800">
                  <button onClick={() => setDeleteConfirm({isOpen: false, id: null})} className="px-6 py-2 font-bold text-gray-400 hover:bg-gray-50 rounded-xl transition">BATAL</button>
                  <button onClick={executeDelete} className="px-8 py-2 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 active:scale-95 transition-all uppercase text-xs">HAPUS SEKARANG</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};