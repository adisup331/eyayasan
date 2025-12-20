import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Program, Division, Organization, Member, Foundation, ReviewItem } from '../types';
import { 
  Plus, Edit, Trash2, Calendar, Briefcase, Wallet, Filter, AlertTriangle, 
  X, Layers, CheckSquare, Square, Building2, ChevronRight, Table, 
  FileSpreadsheet, Maximize2, Minimize2, Search, ZoomIn, ZoomOut,
  Image, ExternalLink, Paperclip, FileText, Printer, BookOpen, Clock, Users, Crown, CheckCircle2, LayoutGrid, ChevronLeft, User,
  PlayCircle, StopCircle, Check, ChevronDown, List, Save, Book, Presentation, Download, RefreshCw
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

const parseMonths = (monthStr: string): string[] => {
  try {
    const parsed = JSON.parse(monthStr);
    return Array.isArray(parsed) ? parsed : [monthStr];
  } catch (e) {
    return monthStr ? [monthStr] : [];
  }
};

export const Programs: React.FC<ProgramsProps> = ({ data, divisions, organizations, members, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Program | null>(null);
  
  const [editingCell, setEditingCell] = useState<{id: string, field: 'cost' | 'month', month?: string} | null>(null);
  const [tempCost, setTempCost] = useState<number>(0);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReviewMaximized, setIsReviewMaximized] = useState(false); 
  const [reviewProgram, setReviewProgram] = useState<Program | null>(null);
  
  const [currentReviewList, setCurrentReviewList] = useState<ReviewItem[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null); 
  const [isEditingReview, setIsEditingReview] = useState(false); 
  const [confirmDeleteReview, setConfirmDeleteReview] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});

  const [showRecapMode, setShowRecapMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');

  const [reviewDate, setReviewDate] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewResult, setReviewResult] = useState<'Success'|'Warning'|'Failed'|'Pending'>('Success');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [filterDivisionId, setFilterDivisionId] = useState('');
  const [filterOrgId, setFilterOrgId] = useState('');
  const [filterYear, setFilterYear] = useState<number | ''>(''); 

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  const [name, setName] = useState('');
  const [description, setDescription] = useState(''); 
  const [costPerMonth, setCostPerMonth] = useState<number>(0);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  
  const [timeType, setTimeType] = useState<'SPECIFIC' | 'RECURRING' | 'FLEXIBLE' | 'CUSTOM'>('FLEXIBLE');

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

  useEffect(() => {
      const newDate = new Date(currentCalendarDate);
      let changed = false;
      if (filterYear && typeof filterYear === 'number' && filterYear !== newDate.getFullYear()) {
          newDate.setFullYear(filterYear);
          changed = true;
      }
      if (changed) {
          setCurrentCalendarDate(newDate);
      }
  }, [filterYear]);

  const filteredData = useMemo(() => {
    return data.filter(p => {
        if (filterYear && (p.year || 2024) !== filterYear) return false;
        if (filterDivisionId && p.division_id !== filterDivisionId) return false;
        if (filterOrgId && p.organization_id !== filterOrgId) return false;
        return true;
    }).sort((a, b) => {
        const divA = divisions.find(d => d.id === a.division_id);
        const divB = divisions.find(d => d.id === b.division_id);
        const orderA = divA ? (divA.order_index ?? 999) : 999;
        const orderB = divB ? (divB.order_index ?? 999) : 999;
        
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });
  }, [data, filterDivisionId, filterOrgId, filterYear, divisions]);

  const calendarData = useMemo(() => {
      const year = currentCalendarDate.getFullYear();
      const month = currentCalendarDate.getMonth();
      const monthName = allMonths[month];

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay(); 

      const datePrograms: Record<number, Program[]> = {};
      const flexiblePrograms: Program[] = [];

      filteredData.forEach(p => {
          if ((p.year || 2024) !== year) return;
          if (p.date) {
              const d = new Date(p.date);
              if (d.getMonth() === month && d.getFullYear() === year) {
                  const day = d.getDate();
                  if (!datePrograms[day]) datePrograms[day] = [];
                  datePrograms[day].push(p);
              }
          } 
          else if (p.schedules) {
              flexiblePrograms.push(p); 
          }
          else {
              const pMonths = parseMonths(p.month);
              if (pMonths.includes(monthName)) {
                  flexiblePrograms.push(p);
              }
          }
      });

      return { daysInMonth, firstDay, datePrograms, flexiblePrograms, monthName, year };
  }, [filteredData, currentCalendarDate]);

  const changeMonth = (delta: number) => {
      const newDate = new Date(currentCalendarDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setCurrentCalendarDate(newDate);
  };

  const recapSlides = useMemo(() => {
      const slides: { programName: string; divisionName: string; review: ReviewItem; programId: string; isPlanned: boolean; status: string; }[] = [];
      const sortedDivisions = [...divisions].sort((a, b) => (a.order_index || 999) - (b.order_index || 999));

      sortedDivisions.forEach(div => {
          const divPrograms = filteredData.filter(p => p.division_id === div.id);
          divPrograms.forEach(prog => {
              let reviews: ReviewItem[] = prog.review_data || [];
              if (reviews.length > 0) {
                  reviews.forEach(r => {
                      slides.push({
                          programName: prog.name,
                          divisionName: div.name,
                          review: r,
                          programId: prog.id,
                          isPlanned: false,
                          status: prog.status
                      });
                  });
              } else {
                  slides.push({
                      programName: prog.name,
                      divisionName: div.name,
                      review: {
                          id: `plan-${prog.id}`,
                          date: prog.date || new Date().toISOString(),
                          title: 'Program Belum Terlaksana',
                          content: prog.description || 'Belum ada laporan.',
                          images: [],
                          result_status: 'Pending'
                      },
                      programId: prog.id,
                      isPlanned: true,
                      status: prog.status
                  });
              }
          });
      });
      return slides;
  }, [filteredData, divisions]);

  const groupedData = useMemo(() => {
      const groups: { [key: string]: Program[] } = {};
      filteredData.forEach(p => {
          const divId = p.division_id || 'unknown';
          if (!groups[divId]) groups[divId] = [];
          groups[divId].push(p);
      });
      return groups;
  }, [filteredData]);

  const sortedDivisionIds = useMemo(() => {
      return Object.keys(groupedData).sort((a, b) => {
          if (a === 'unknown') return 1;
          if (b === 'unknown') return -1;
          const divA = divisions.find(d => d.id === a);
          const divB = divisions.find(d => d.id === b);
          const orderA = divA ? (divA.order_index ?? 0) : 0;
          const orderB = divB ? (divB.order_index ?? 0) : 0;
          return orderA - orderB;
      });
  }, [groupedData, divisions]);

  const calculateProgramTotal = (p: Program) => {
      let freq = 0;
      if (p.schedules) {
          try { 
              const s = typeof p.schedules === 'string' ? JSON.parse(p.schedules) : p.schedules;
              if (Array.isArray(s)) freq = s.length;
          } catch(e) {}
      } else {
          const m = parseMonths(p.month);
          freq = m.length;
          if (p.date && freq <= 1) freq = 1;
      }
      if (freq === 0) freq = 1;
      return p.cost * freq;
  };

  const grandTotalCost = useMemo(() => {
      return filteredData.reduce((acc, p) => acc + calculateProgramTotal(p), 0);
  }, [filteredData]);

  const handleSheetCostEdit = (p: Program) => {
      if(isSuperAdmin) return;
      setEditingCell({ id: p.id, field: 'cost' });
      setTempCost(p.cost);
  };

  const saveSheetCost = async () => {
      if (!editingCell) return;
      try {
          await supabase.from('programs').update({ cost: tempCost }).eq('id', editingCell.id);
          onRefresh();
          showToast("Biaya diperbarui", "success");
      } catch (e:any) { showToast(e.message, "error"); }
      setEditingCell(null);
  };

  const toggleSheetMonth = async (p: Program, month: string) => {
      if(isSuperAdmin) return;
      if (p.date || p.schedules) {
          showToast("Edit detail jadwal di tombol Edit (Pensil)", "error");
          return;
      }

      let currentMonths = parseMonths(p.month);
      if (currentMonths.includes(month)) {
          currentMonths = currentMonths.filter(m => m !== month);
      } else {
          currentMonths.push(month);
          currentMonths.sort((a,b) => allMonths.indexOf(a) - allMonths.indexOf(b));
      }

      try {
          await supabase.from('programs').update({ month: JSON.stringify(currentMonths) }).eq('id', p.id);
          onRefresh();
      } catch (e:any) { showToast(e.message, "error"); }
  };

  const handleOpenReview = (program: Program) => {
      setReviewProgram(program);
      setCurrentReviewList(program.review_data || []);
      setIsEditingReview(false);
      setSelectedReviewId(null);
      setIsReviewModalOpen(true);
  };

  const handleCreateReview = () => {
      setSelectedReviewId(null);
      setReviewDate(new Date().toISOString().split('T')[0]);
      setReviewTitle('Laporan Kegiatan');
      setReviewContent('');
      setReviewResult('Success'); 
      setReviewImages([]);
      setIsEditingReview(true);
  };

  const handleEditReview = (item: ReviewItem) => {
      setSelectedReviewId(item.id);
      setReviewDate(item.date ? new Date(item.date).toISOString().split('T')[0] : '');
      setReviewTitle(item.title);
      setReviewContent(item.content);
      setReviewResult(item.result_status || 'Success');
      setIsEditingReview(true);
  };

  const executeDeleteReviewItem = async () => {
      if (!confirmDeleteReview.id) return;
      if (!reviewProgram) return;

      const updatedList = currentReviewList.filter(r => r.id !== confirmDeleteReview.id);
      
      setLoading(true);
      try {
          const { error } = await supabase.from('programs').update({ 
              review_data: updatedList,
          }).eq('id', reviewProgram.id);
          
          if(error) throw error;
          
          setCurrentReviewList(updatedList);
          if (selectedReviewId === confirmDeleteReview.id) {
              setIsEditingReview(false);
              setSelectedReviewId(null);
          }
          onRefresh();
          showToast("Review dihapus.", "success");
      } catch (err: any) {
          showToast(err.message, "error");
      } finally {
          setLoading(false);
          setConfirmDeleteReview({isOpen: false, id: null});
      }
  }

  const handleSaveReview = async () => {
      if (!reviewProgram) return;
      setLoading(true);
      
      const newItem: ReviewItem = {
          id: selectedReviewId || Date.now().toString(),
          date: new Date(reviewDate).toISOString(),
          title: reviewTitle,
          content: reviewContent,
          result_status: reviewResult,
          images: []
      };

      let updatedList = [...currentReviewList];
      if (selectedReviewId) {
          updatedList = updatedList.map(item => item.id === selectedReviewId ? newItem : item);
      } else {
          updatedList.push(newItem);
      }
      updatedList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      try {
          const { error } = await supabase.from('programs').update({ 
              review_data: updatedList,
          }).eq('id', reviewProgram.id);
          if(error) throw error;
          
          showToast("Laporan disimpan!", "success");
          setCurrentReviewList(updatedList);
          setIsEditingReview(false);
          onRefresh();
      } catch (err: any) {
          showToast(err.message, "error");
      } finally {
          setLoading(false);
      }
  };

  const getStatusColor = (s: string) => {
      switch(s) {
          case 'In Progress': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'; 
          case 'Completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'; 
          case 'Planned': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'; 
          default: return 'bg-gray-100 text-gray-600 border-gray-200';
      }
  };

  const getResultBadge = (s?: string) => {
      switch(s) {
          case 'Success': return <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10}/> Berjalan Lancar</span>;
          case 'Warning': return <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded flex items-center gap-1"><AlertTriangle size={10}/> Ada Kendala</span>;
          case 'Failed': return <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded flex items-center gap-1"><X size={10}/> Gagal / Batal</span>;
          default: return <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Menunggu</span>;
      }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  const handleNextSlide = () => { setCurrentSlideIndex(prev => (prev + 1) % recapSlides.length); };
  const handlePrevSlide = () => { setCurrentSlideIndex(prev => (prev - 1 + recapSlides.length) % recapSlides.length); };

  const handleOpen = (program?: Program) => {
    if (program) {
      setEditingItem(program);
      setName(program.name);
      setDescription(program.description || '');
      setCostPerMonth(program.cost);
      setDivisionId(program.division_id);
      setOrganizationId(program.organization_id || '');
      setYear(program.year || new Date().getFullYear());
      setStatus(program.status);
      const pMonths = parseMonths(program.month);
      setSelectedMonths(pMonths);
      if(program.date) setTimeType('SPECIFIC'); else if (pMonths.length > 1) setTimeType('RECURRING'); else setTimeType('FLEXIBLE');
    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
      setCostPerMonth(0);
      setDivisionId(divisions[0]?.id || '');
      setOrganizationId(''); 
      setYear(filterYear ? Number(filterYear) : new Date().getFullYear());
      setStatus('Planned');
      setSelectedMonths([]);
      setTimeType('FLEXIBLE');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload: any = {
      name, description, cost: costPerMonth, month: JSON.stringify(selectedMonths),
      year, division_id: divisionId, organization_id: organizationId || null, status,
    };
    if(!editingItem && activeFoundation) payload.foundation_id = activeFoundation.id;

    try {
      if (editingItem) {
        await supabase.from('programs').update(payload).eq('id', editingItem.id);
      } else {
        await supabase.from('programs').insert([payload]);
      }
      onRefresh();
      setIsModalOpen(false);
      showToast('Program disimpan');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
      if (!deleteConfirm.id) return;
      try {
          await supabase.from('programs').delete().eq('id', deleteConfirm.id);
          onRefresh();
          setDeleteConfirm({isOpen: false, id: null});
          showToast('Program dihapus');
      } catch (error: any) { showToast(error.message, 'error'); }
  }

  const handlePrintDocument = () => {
      window.print();
  }

  return (
    <div ref={containerRef} className={`flex flex-col space-y-4 transition-all duration-300 ${isFullScreen ? 'bg-gray-50 dark:bg-dark-bg p-6 overflow-y-auto' : ''}`}>
      
      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="text-sm font-medium">{toast.message}</span>
          </div>
      )}

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 no-print">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Briefcase className="text-primary-600 dark:text-primary-400" /> Program Kerja & Anggaran
            </h2>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center">
                <button onClick={() => setViewMode('table')} className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-white dark:bg-dark-card shadow text-primary-600' : 'text-gray-500'}`} title="Tabel"><Table size={18}/></button>
                <button onClick={() => setViewMode('sheet')} className={`p-2 rounded-md ${viewMode === 'sheet' ? 'bg-white dark:bg-dark-card shadow text-primary-600' : 'text-gray-500'}`} title="Sheet (Matrix)"><FileSpreadsheet size={18}/></button>
                <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-md ${viewMode === 'calendar' ? 'bg-white dark:bg-dark-card shadow text-primary-600' : 'text-gray-500'}`} title="Kalender"><Calendar size={18}/></button>
                <button onClick={() => setViewMode('document')} className={`p-2 rounded-md ${viewMode === 'document' ? 'bg-white dark:bg-dark-card shadow text-primary-600' : 'text-gray-500'}`} title="Dokumen"><FileText size={18}/></button>
            </div>
            
            <button onClick={() => { if(recapSlides.length > 0) setShowRecapMode(true); else alert("Belum ada laporan."); }} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg" title="Mode Presentasi"><Presentation size={20} /></button>
            {!isSuperAdmin && (
                <button onClick={() => handleOpen()} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm font-medium shadow-sm"><Plus size={18} /> Tambah Program</button>
            )}
        </div>
      </div>

      <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col md:flex-row gap-4 items-center flex-wrap no-print">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium"><Filter size={16} /> Filter:</div>
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value) || '')} className="px-3 py-1.5 text-sm border rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none">
              <option value="">Semua Tahun</option>
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              <option value={new Date().getFullYear()+1}>{new Date().getFullYear()+1}</option>
          </select>
          <select value={filterDivisionId} onChange={(e) => setFilterDivisionId(e.target.value)} className="px-3 py-1.5 text-sm border rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none">
              <option value="">Semua Bidang</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
      </div>

      <div className={`flex-1 overflow-hidden bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-dark-border shadow-sm ${viewMode === 'calendar' ? 'p-0 border-0 shadow-none bg-transparent' : 'relative'}`}>
          
          {viewMode === 'table' && (
              <div className="overflow-x-auto h-full flex flex-col">
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Program & Tim</th>
                                <th className="px-6 py-4">Waktu</th>
                                <th className="px-6 py-4 text-right">Biaya Satuan</th>
                                <th className="px-6 py-4 text-right">Total Anggaran</th>
                                <th className="px-6 py-4">Status & Bukti</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                            {filteredData.map(item => {
                                const divDetails = divisions.find(d => d.id === item.division_id);
                                const divHeadName = members.find(m => m.id === divDetails?.head_member_id)?.full_name || 'Belum ada';
                                const memberCount = members.filter(m => m.division_id === item.division_id).length;

                                return (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition group">
                                    <td className="px-6 py-4 align-top">
                                        <div className="font-medium text-gray-900 dark:text-white text-base cursor-pointer hover:text-primary-600" onClick={() => handleOpenReview(item)}>{item.name}</div>
                                        <div className="text-xs mt-2 flex flex-wrap gap-3">
                                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                                                <Layers size={10}/> {divDetails?.name || '-'}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded" title="Kepala Bidang">
                                                <Crown size={10}/> {divHeadName}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded" title="Total Anggota Bidang">
                                                <Users size={10}/> {memberCount} Staff
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 align-top">
                                        <div className="font-bold">{item.year}</div>
                                        <div className="max-w-[200px]">{item.schedules ? 'Jadwal Detail (Custom)' : parseMonths(item.month).join(', ')}</div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-600 dark:text-gray-400 text-right align-top">{formatCurrency(item.cost)}</td>
                                    <td className="px-6 py-4 font-bold text-gray-800 dark:text-white text-right font-mono align-top bg-gray-50 dark:bg-gray-800/30">{formatCurrency(calculateProgramTotal(item))}</td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(item.status)}`}>{item.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right align-top">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenReview(item)} className="text-gray-400 hover:text-green-600 dark:hover:text-green-400" title="Review"><FileText size={18}/></button>
                                            {!isSuperAdmin && (
                                                <>
                                                    <button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"><Edit size={18}/></button>
                                                    <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id})} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={18}/></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                  </div>
              </div>
          )}

          {viewMode === 'sheet' && (
              <div className="overflow-auto h-full bg-white dark:bg-dark-card">
                  <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 sticky top-0 z-20 shadow-sm">
                          <tr>
                              <th className="p-3 border dark:border-gray-700 min-w-[200px] sticky left-0 bg-gray-100 dark:bg-gray-800 z-30">Program Kerja</th>
                              <th className="p-3 border dark:border-gray-700 min-w-[150px]">Bidang & Penanggung Jawab</th>
                              <th className="p-3 border dark:border-gray-700 w-24 text-right">Biaya/Bln</th>
                              {allMonths.map(m => <th key={m} className="p-2 border dark:border-gray-700 text-center w-10 font-normal">{m.substring(0,3)}</th>)}
                              <th className="p-3 border dark:border-gray-700 w-28 text-right font-bold bg-gray-200 dark:bg-gray-900 sticky right-0 z-30">Total Anggaran</th>
                          </tr>
                      </thead>
                      <tbody>
                          {sortedDivisionIds.map(divId => {
                              const divPrograms = groupedData[divId];
                              if (!divPrograms) return null;
                              
                              const divDetails = divisions.find(d => d.id === divId);
                              const divName = divDetails?.name || 'Lain-lain';
                              const headName = members.find(m => m.id === divDetails?.head_member_id)?.full_name || 'Belum ada';
                              
                              return (
                                  <React.Fragment key={divId}>
                                      {divPrograms.map(p => {
                                          const pMonths = parseMonths(p.month);
                                          const total = calculateProgramTotal(p);
                                          
                                          let customScheduleMap: Record<string, string> = {};
                                          if (p.schedules) {
                                              try {
                                                  const s = typeof p.schedules === 'string' ? JSON.parse(p.schedules) : p.schedules;
                                                  if (Array.isArray(s)) s.forEach((x: any) => customScheduleMap[x.month] = x.date);
                                              } catch {}
                                          }

                                          return (
                                              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                  <td 
                                                    className="p-2 border dark:border-gray-700 sticky left-0 bg-white dark:bg-dark-card z-10 font-medium truncate max-w-[200px] cursor-pointer hover:text-primary-600 hover:underline" 
                                                    title={`Klik untuk lihat detail ${p.name}`}
                                                    onClick={() => handleOpenReview(p)}
                                                  >
                                                      {p.name}
                                                  </td>
                                                  <td className="p-2 border dark:border-gray-700 text-gray-500 max-w-[150px]">
                                                      <div className="font-medium text-gray-700 dark:text-gray-300 truncate">{divName}</div>
                                                      <div className="text-[10px] flex items-center gap-1 truncate text-yellow-600 dark:text-yellow-500" title={`Kepala: ${headName}`}>
                                                          <Crown size={10}/> {headName}
                                                      </div>
                                                  </td>
                                                  
                                                  <td className="p-2 border dark:border-gray-700 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition" onClick={() => handleSheetCostEdit(p)}>
                                                      {editingCell?.id === p.id && editingCell.field === 'cost' ? (
                                                          <input 
                                                            type="number" 
                                                            autoFocus 
                                                            value={tempCost} 
                                                            onChange={(e) => setTempCost(Number(e.target.value))} 
                                                            onBlur={saveSheetCost}
                                                            onKeyDown={(e) => e.key === 'Enter' && saveSheetCost()}
                                                            className="w-full text-right bg-transparent outline-none border-b border-primary-500"
                                                          />
                                                      ) : formatCurrency(p.cost)}
                                                  </td>
                                                  
                                                  {allMonths.map((month, mIdx) => {
                                                      const isActive = pMonths.includes(month) || !!customScheduleMap[month];
                                                      const isDateSpecific = !!customScheduleMap[month] || (p.date && new Date(p.date).getMonth() === allMonths.indexOf(month));
                                                      
                                                      const review = p.review_data?.find(r => {
                                                          const d = new Date(r.date);
                                                          return d.getMonth() === mIdx && d.getFullYear() === (p.year || new Date().getFullYear());
                                                      });

                                                      let cellClass = 'hover:bg-gray-100 dark:hover:bg-gray-800'; 
                                                      let dotClass = '';

                                                      if (review) {
                                                          if (review.result_status === 'Success') {
                                                              cellClass = 'bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800';
                                                              dotClass = 'bg-green-600';
                                                          } else if (review.result_status === 'Failed') {
                                                              cellClass = 'bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800';
                                                              dotClass = 'bg-red-600';
                                                          } else if (review.result_status === 'Warning') {
                                                              cellClass = 'bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-200 dark:hover:bg-yellow-800';
                                                              dotClass = 'bg-yellow-600';
                                                          } else {
                                                               cellClass = 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100';
                                                               dotClass = 'bg-blue-400';
                                                          }
                                                      } else if (isActive) {
                                                          cellClass = 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40';
                                                          dotClass = isDateSpecific ? 'bg-primary-600' : 'bg-blue-300';
                                                      }

                                                      return (
                                                          <td key={month} 
                                                            className={`border dark:border-gray-700 text-center cursor-pointer transition-colors ${cellClass}`}
                                                            onClick={() => toggleSheetMonth(p, month)}
                                                            title={review ? `Review: ${review.title} (${review.result_status})` : ''}
                                                          >
                                                              {(isActive || review) && (
                                                                  <div className={`w-3 h-3 mx-auto rounded-full ${dotClass}`} title={isDateSpecific ? 'Tanggal Spesifik' : 'Bulan Aktif'}></div>
                                                              )}
                                                          </td>
                                                      )
                                                  })}
                                                  <td className="p-2 border dark:border-gray-700 text-right font-bold bg-gray-50 dark:bg-gray-900 sticky right-0 z-10">{formatCurrency(total)}</td>
                                              </tr>
                                          )
                                      })}
                                      <tr className="bg-gray-100 dark:bg-gray-800 font-bold text-xs">
                                          <td className="p-2 border dark:border-gray-700 sticky left-0 bg-gray-100 dark:bg-gray-800 z-10 text-right" colSpan={3}>Total {divName}:</td>
                                          <td colSpan={12} className="border dark:border-gray-700"></td>
                                          <td className="p-2 border dark:border-gray-700 text-right sticky right-0 bg-gray-100 dark:bg-gray-800 z-10">{formatCurrency(divPrograms.reduce((acc, p) => acc + calculateProgramTotal(p), 0))}</td>
                                      </tr>
                                  </React.Fragment>
                              )
                          })}
                          <tr className="bg-gray-800 text-white font-bold text-sm sticky bottom-0 z-40">
                              <td className="p-3 border-t border-gray-600 sticky left-0 bg-gray-800 z-40 text-right" colSpan={3}>GRAND TOTAL TAHUN {filterYear || 'INI'}:</td>
                              <td colSpan={12} className="border-t border-gray-600"></td>
                              <td className="p-3 border-t border-gray-600 text-right sticky right-0 bg-gray-800 z-40">{formatCurrency(grandTotalCost)}</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
          )}

          {viewMode === 'document' && (
              <div className="p-8 bg-gray-100 overflow-y-auto h-full flex justify-center">
                  <style>{`
                      @media print {
                          @page { size: A4; margin: 2cm; }
                          body { background: white; color: black; font-family: 'Times New Roman', serif; }
                          .no-print, nav, aside, button, .header-actions { display: none !important; }
                          .print-container { box-shadow: none !important; padding: 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; min-height: 0 !important; }
                          .print-bg-white { background-color: white !important; }
                          th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
                          tr { page-break-inside: avoid; }
                      }
                  `}</style>
                  
                  <div className="fixed bottom-6 right-6 no-print">
                      <button onClick={handlePrintDocument} className="bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-xl flex items-center gap-2 font-bold animate-in zoom-in">
                          <Download size={20}/> Cetak / Download PDF
                      </button>
                  </div>

                  <div className="bg-white shadow-lg w-full max-w-[21cm] min-h-[29.7cm] p-[2cm] text-black print-container print-bg-white">
                      <div className="text-center mb-8 border-b-2 border-black pb-4">
                          <h1 className="text-xl font-bold uppercase mb-1">{activeFoundation?.name || 'YAYASAN'}</h1>
                          <h2 className="text-lg">PROGRAM KERJA TAHUN {filterYear || new Date().getFullYear()}</h2>
                      </div>
                      
                      {sortedDivisionIds.map(divId => {
                          const divPrograms = groupedData[divId];
                          if (!divPrograms) return null;
                          const divDetails = divisions.find(d => d.id === divId);
                          const divName = divDetails?.name || 'Lain-lain';
                          const divHead = members.find(m => m.id === divDetails?.head_member_id)?.full_name || '-';
                          const divTotal = divPrograms.reduce((a,b) => a + calculateProgramTotal(b), 0);

                          return (
                              <div key={divId} className="mb-6 break-inside-avoid">
                                  <div className="flex justify-between items-end border-b border-black pb-1 mb-2 bg-gray-100 print-bg-white">
                                      <div>
                                          <h3 className="font-bold text-sm uppercase px-1">BIDANG: {divName}</h3>
                                          <p className="text-xs px-1 italic">Koordinator: {divHead}</p>
                                      </div>
                                      <span className="font-bold text-sm px-1">Subtotal: {formatCurrency(divTotal)}</span>
                                  </div>
                                  <table className="w-full text-xs border-collapse border border-black mb-2">
                                      <thead>
                                          <tr className="bg-gray-50 print-bg-white">
                                              <th className="border border-black p-1 w-8 text-center">No</th>
                                              <th className="border border-black p-1 text-left">Nama Program</th>
                                              <th className="border border-black p-1 text-left">Waktu Pelaksanaan</th>
                                              <th className="border border-black p-1 w-24 text-right">Biaya Satuan</th>
                                              <th className="border border-black p-1 w-24 text-right">Total</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {divPrograms.map((p, idx) => {
                                              const monthList = parseMonths(p.month).map(m => m.substring(0,3)).join(', ');
                                              const total = calculateProgramTotal(p);
                                              return (
                                                  <tr key={p.id}>
                                                      <td className="border border-black p-1 text-center">{idx + 1}</td>
                                                      <td className="border border-black p-1">{p.name}</td>
                                                      <td className="border border-black p-1 italic">{p.schedules ? 'Jadwal Khusus' : monthList}</td>
                                                      <td className="border border-black p-1 text-right">{formatCurrency(p.cost)}</td>
                                                      <td className="border border-black p-1 text-right font-semibold">{formatCurrency(total)}</td>
                                                  </tr>
                                              )
                                          })}
                                      </tbody>
                                  </table>
                              </div>
                          )
                      })}
                      <div className="mt-8 pt-4 border-t-2 border-black flex justify-between font-bold text-lg bg-gray-200 print-bg-white p-2">
                          <span>TOTAL ANGGARAN SELURUHNYA</span>
                          <span>{formatCurrency(grandTotalCost)}</span>
                      </div>
                      <div className="mt-16 flex justify-between text-center px-8">
                          <div><p>Mengetahui,</p><p className="font-bold mb-16">Ketua Yayasan</p><p>( ........................ )</p></div>
                          <div><p>Dibuat Oleh,</p><p className="font-bold mb-16">Sekretaris / Bendahara</p><p>( ........................ )</p></div>
                      </div>
                  </div>
              </div>
          )}

          {viewMode === 'calendar' && (
              <div className="h-full flex flex-col bg-gray-100 dark:bg-dark-bg p-4 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between mb-4 bg-white dark:bg-dark-card p-3 rounded-lg shadow-sm">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white capitalize flex items-center gap-2">
                          <Calendar size={20}/> {calendarData.monthName} {calendarData.year}
                      </h3>
                      <div className="flex gap-2">
                          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronLeft size={20}/></button>
                          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronRight size={20}/></button>
                      </div>
                  </div>

                  <div className="flex-1 flex gap-4 overflow-hidden">
                      <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border p-4 flex flex-col overflow-hidden">
                          <div className="grid grid-cols-7 text-center font-semibold text-gray-500 mb-2 text-sm">
                              <div>Min</div><div>Sen</div><div>Sel</div><div>Rab</div><div>Kam</div><div>Jum</div><div>Sab</div>
                          </div>
                          <div className="grid grid-cols-7 flex-1 gap-1 overflow-y-auto">
                              {Array.from({ length: calendarData.firstDay }).map((_, i) => <div key={`empty-${i}`} className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg"></div>)}
                              
                              {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
                                  const day = i + 1;
                                  const dayPrograms = calendarData.datePrograms[day] || [];
                                  const isToday = new Date().getDate() === day && new Date().getMonth() === currentCalendarDate.getMonth() && new Date().getFullYear() === currentCalendarDate.getFullYear();

                                  return (
                                      <div key={day} className={`border border-gray-100 dark:border-gray-700 rounded-lg p-1 flex flex-col gap-1 min-h-[80px] hover:border-primary-300 dark:hover:border-primary-700 transition relative ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}`}>
                                          <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>{day}</span>
                                          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                                              {dayPrograms.map(p => (
                                                  <div key={p.id} onClick={() => handleOpenReview(p)} className="text-[10px] bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80">
                                                      {p.name}
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      <div className="w-64 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border p-4 flex flex-col">
                          <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                              <List size={16}/> Program Fleksibel
                          </h4>
                          <p className="text-xs text-gray-500 mb-3">Program bulan ini tanpa tanggal spesifik.</p>
                          <div className="flex-1 overflow-y-auto space-y-2">
                              {calendarData.flexiblePrograms.length > 0 ? (
                                  calendarData.flexiblePrograms.map(p => (
                                      <div key={p.id} onClick={() => handleOpenReview(p)} className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 transition">
                                          <div className="font-medium text-xs text-gray-800 dark:text-white truncate">{p.name}</div>
                                          <div className="text-[10px] text-gray-500 mt-1">{divisions.find(d => d.id === p.division_id)?.name}</div>
                                      </div>
                                  ))
                              ) : (
                                  <p className="text-center text-xs text-gray-400 py-4 italic">Tidak ada program.</p>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Program' : 'Tambah Program Kerja'}>
          <form onSubmit={handleSubmit} className="space-y-4 text-gray-800 dark:text-gray-200">
              <div>
                  <label className="block text-sm font-medium">Nama Program</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} 
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white" placeholder="Contoh: Pengajian Bulanan" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium">Bidang</label>
                      <select required value={divisionId} onChange={e => setDivisionId(e.target.value)} 
                          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white">
                          <option value="">Pilih Bidang</option>
                          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium">Tahun</label>
                      <input type="number" required value={year} onChange={e => setYear(Number(e.target.value))} 
                          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white" />
                  </div>
              </div>
              <div>
                  <label className="block text-sm font-medium">Biaya Satuan / Per Bulan</label>
                  <input type="number" value={costPerMonth} onChange={e => setCostPerMonth(Number(e.target.value))} 
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white" />
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">Waktu Pelaksanaan</label>
                  <div className="flex gap-2 mb-3">
                      {['FLEXIBLE', 'SPECIFIC', 'RECURRING', 'CUSTOM'].map((mode) => (
                          <button key={mode} type="button" onClick={() => setTimeType(mode as any)}
                              className={`px-3 py-1 text-xs font-bold rounded-full border ${timeType === mode ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                          >{mode === 'FLEXIBLE' ? 'Bulan (Fleksibel)' : mode}</button>
                      ))}
                  </div>
                  {(timeType === 'FLEXIBLE' || timeType === 'RECURRING' || timeType === 'CUSTOM') && (
                      <div className="grid grid-cols-4 gap-2">
                          {allMonths.map(month => (
                              <div key={month} onClick={() => { setSelectedMonths(prev => prev.includes(month) ? prev.filter(m=>m!==month) : [...prev, month]) }}
                                  className={`text-center text-xs py-1.5 px-1 rounded cursor-pointer border transition ${selectedMonths.includes(month) ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-500 text-primary-700 dark:text-primary-300 font-bold' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500'}`}
                              >{month.substring(0,3)}</div>
                          ))}
                      </div>
                  )}
              </div>

              <div>
                  <label className="block text-sm font-medium">Deskripsi</label>
                  <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} 
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                  <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm border rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">Batal</button>
                  <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded font-bold">Simpan</button>
              </div>
          </form>
      </Modal>

      <Modal 
        isOpen={isReviewModalOpen} 
        onClose={() => setIsReviewModalOpen(false)} 
        title={`Review Kegiatan: ${reviewProgram?.name}`} 
        size={isReviewMaximized ? 'full' : '3xl'}
      >
          <div className={`flex flex-col md:flex-row overflow-hidden bg-gray-100 dark:bg-dark-bg p-4 gap-4 transition-all duration-300 ${isReviewMaximized ? 'h-[calc(100vh-80px)]' : 'h-[80vh] rounded-lg'}`}>
              
              <div className="w-full md:w-1/3 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg flex flex-col overflow-hidden shrink-0">
                  <div className="p-3 border-b border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                      <h4 className="font-bold text-sm text-gray-800 dark:text-white">Riwayat Review</h4>
                      <button onClick={handleCreateReview} className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 flex items-center gap-1"><Plus size={12}/> Baru</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {currentReviewList.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">Belum ada review.</p> : (
                          currentReviewList.map(item => (
                              <div key={item.id} onClick={() => handleEditReview(item)} className={`p-2 rounded border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition ${selectedReviewId === item.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-100 dark:border-gray-700'}`}>
                                  <div className="flex justify-between items-start mb-1">
                                      <span className="font-semibold text-xs text-gray-800 dark:text-white truncate flex-1">{item.title}</span>
                                      <span className="text-[10px] text-gray-500 whitespace-nowrap">{new Date(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</span>
                                  </div>
                                  <div className="flex items-center gap-1 mb-1">{getResultBadge(item.result_status)}</div>
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{item.content}</p>
                              </div>
                          ))
                      )}
                  </div>
              </div>

              <div className={`flex-1 overflow-y-auto bg-white dark:bg-gray-900 shadow-xl mx-auto w-full p-8 md:p-12 flex flex-col gap-6 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-dark-border relative rounded-lg transition-all duration-300 ${isReviewMaximized ? 'max-w-5xl' : 'max-w-3xl'}`}>
                  <div className="absolute top-4 right-4 flex gap-2 no-print">
                      <button onClick={() => setIsReviewMaximized(!isReviewMaximized)} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full text-gray-500 transition">
                          {isReviewMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                      </button>
                  </div>

                  <div className="border-b-2 border-black dark:border-gray-600 pb-4 text-center mt-2">
                      <h2 className="text-xl font-bold uppercase text-gray-900 dark:text-white">{activeFoundation?.name || 'YAYASAN'}</h2>
                      <h3 className="text-lg font-semibold mt-1 text-gray-800 dark:text-gray-200">LAPORAN PERTANGGUNGJAWABAN KEGIATAN</h3>
                  </div>

                  {isEditingReview ? (
                      <div className="flex-1 flex flex-col gap-4 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 mb-1 block">Tanggal Pelaksanaan</label>
                                  <input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} className="w-full text-sm border p-2 rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"/>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 mb-1 block">Judul Kegiatan / Laporan</label>
                                  <input type="text" value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} className="w-full text-sm border p-2 rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white" placeholder="Contoh: Kegiatan Januari"/>
                              </div>
                          </div>

                          <div>
                              <label className="text-xs font-bold text-gray-500 mb-1 block">Status Pelaksanaan</label>
                              <select 
                                  value={reviewResult} 
                                  onChange={(e) => setReviewResult(e.target.value as any)}
                                  className="w-full text-sm border p-2 rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                              >
                                  <option value="Success">Berhasil / Terlaksana</option>
                                  <option value="Warning">Terlaksana dengan Kendala</option>
                                  <option value="Failed">Gagal / Batal / Tidak Jalan</option>
                                  <option value="Pending">Ditunda</option>
                              </select>
                          </div>

                          <div className="flex-1 flex flex-col min-h-[200px]">
                              <label className="font-bold border-b border-gray-200 dark:border-gray-700 pb-1 mb-2 block text-gray-800 dark:text-white">I. Evaluasi & Notulensi</label>
                              <textarea 
                                  value={reviewContent}
                                  onChange={(e) => setReviewContent(e.target.value)}
                                  className="flex-1 w-full p-4 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm leading-relaxed resize-none"
                                  placeholder="Tuliskan hasil kegiatan, evaluasi, kendala, dan pencapaian di sini..."
                              />
                          </div>
                          
                          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-auto sticky bottom-0 bg-white dark:bg-gray-900 py-2 z-10">
                              {selectedReviewId && (
                                  <button 
                                      onClick={() => setConfirmDeleteReview({isOpen: true, id: selectedReviewId})} 
                                      className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded text-sm mr-auto border border-red-200 dark:border-red-800"
                                  >
                                      Hapus Review
                                  </button>
                              )}
                              <button onClick={() => setIsEditingReview(false)} className="px-4 py-2 bg-white dark:bg-gray-700 border rounded text-sm text-gray-700 dark:text-gray-200">Batal</button>
                              <button onClick={handleSaveReview} disabled={loading} className="px-6 py-2 bg-primary-600 text-white rounded text-sm font-bold hover:bg-primary-700 flex items-center gap-2">
                                  <Save size={16}/> {loading ? 'Menyimpan...' : 'Simpan Laporan'}
                              </button>
                          </div>
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[300px]">
                          <BookOpen size={48} className="mb-4 opacity-50"/>
                          <p>Pilih review dari riwayat di sebelah kiri atau buat baru.</p>
                      </div>
                  )}
              </div>
          </div>
      </Modal>

      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null})} title="Konfirmasi Hapus Program">
          <div className="text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-6">Yakin ingin menghapus program ini?</p>
              <div className="flex justify-center gap-3">
                  <button onClick={() => setDeleteConfirm({isOpen: false, id: null})} className="px-4 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200">Batal</button>
                  <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Hapus</button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={confirmDeleteReview.isOpen} onClose={() => setConfirmDeleteReview({isOpen: false, id: null})} title="Hapus Review?">
          <div className="text-center">
              <div className="flex justify-center mb-4 text-red-500"><AlertTriangle size={32}/></div>
              <p className="text-gray-600 dark:text-gray-300 mb-6 font-medium">Apakah Anda yakin ingin menghapus laporan review ini? <br/><span className="text-xs text-gray-500">Tindakan ini tidak dapat dibatalkan.</span></p>
              <div className="flex justify-center gap-3">
                  <button onClick={() => setConfirmDeleteReview({isOpen: false, id: null})} className="px-4 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
                  <button onClick={executeDeleteReviewItem} disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                      {loading ? 'Menghapus...' : 'Ya, Hapus'}
                  </button>
              </div>
          </div>
      </Modal>
    </div>
  );
};