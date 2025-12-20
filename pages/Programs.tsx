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

  const [reviewDate, setReviewDate] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewResult, setReviewResult] = useState<'Success'|'Warning'|'Failed'|'Pending'>('Success');
  
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  const [filterDivisionId, setFilterDivisionId] = useState('');
  const [filterYear, setFilterYear] = useState<number | ''>(new Date().getFullYear()); 

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
      if (filterYear && typeof filterYear === 'number' && filterYear !== newDate.getFullYear()) {
          newDate.setFullYear(filterYear);
          setCurrentCalendarDate(newDate);
      }
  }, [filterYear]);

  const filteredData = useMemo(() => {
    return data.filter(p => {
        if (filterYear && (p.year || 2024) !== filterYear) return false;
        if (filterDivisionId && p.division_id !== filterDivisionId) return false;
        return true;
    }).sort((a, b) => {
        const divA = divisions.find(d => d.id === a.division_id);
        const divB = divisions.find(d => d.id === b.division_id);
        const orderA = divA ? (divA.order_index ?? 999) : 999;
        const orderB = divB ? (divB.order_index ?? 999) : 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });
  }, [data, filterDivisionId, filterYear, divisions]);

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
          if (a === 'unknown') return 1; if (b === 'unknown') return -1;
          const divA = divisions.find(d => d.id === a);
          const divB = divisions.find(d => d.id === b);
          return (divA?.order_index ?? 0) - (divB?.order_index ?? 0);
      });
  }, [groupedData, divisions]);

  const calculateProgramTotal = (p: Program) => {
      let freq = parseMonths(p.month).length;
      if (freq === 0) freq = 1;
      return p.cost * freq;
  };

  const handleOpenReview = (program: Program) => {
      setReviewProgram(program);
      setCurrentReviewList(program.review_data || []);
      setIsEditingReview(false);
      setSelectedReviewId(null);
      setIsReviewModalOpen(true);
  };

  const handleSaveReview = async () => {
      if (!reviewProgram) return;
      setLoading(true);
      const newItem: ReviewItem = { id: selectedReviewId || Date.now().toString(), date: new Date(reviewDate).toISOString(), title: reviewTitle, content: reviewContent, result_status: reviewResult, images: [] };
      let updatedList = [...currentReviewList];
      if (selectedReviewId) { updatedList = updatedList.map(item => item.id === selectedReviewId ? newItem : item); } 
      else { updatedList.push(newItem); }
      try {
          await supabase.from('programs').update({ review_data: updatedList }).eq('id', reviewProgram.id);
          setCurrentReviewList(updatedList); setIsEditingReview(false); onRefresh();
      } catch (err: any) { showToast(err.message, "error"); } finally { setLoading(false); }
  };

  const getStatusColor = (s: string) => {
      switch(s) {
          case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'Completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'Planned': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-gray-100 text-gray-600 border-gray-200';
      }
  };

  const handleOpen = (program?: Program) => {
    if (program) {
      setEditingItem(program); setName(program.name); setDescription(program.description || '');
      setCostPerMonth(program.cost); setDivisionId(program.division_id); setOrganizationId(program.organization_id || '');
      setYear(program.year || new Date().getFullYear()); setStatus(program.status);
      setSelectedMonths(parseMonths(program.month));
      setTimeType(program.date ? 'SPECIFIC' : 'FLEXIBLE');
    } else {
      setEditingItem(null); setName(''); setDescription(''); setCostPerMonth(0);
      setDivisionId(divisions[0]?.id || ''); setOrganizationId(''); 
      setYear(filterYear ? Number(filterYear) : new Date().getFullYear());
      setStatus('Planned'); setSelectedMonths([]); setTimeType('FLEXIBLE');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload: any = { name, description, cost: costPerMonth, month: JSON.stringify(selectedMonths), year, division_id: divisionId, organization_id: organizationId || null, status };
    if(!editingItem && activeFoundation) payload.foundation_id = activeFoundation.id;
    try {
      if (editingItem) { await supabase.from('programs').update(payload).eq('id', editingItem.id); } 
      else { await supabase.from('programs').insert([payload]); }
      onRefresh(); setIsModalOpen(false); showToast('Program disimpan');
    } catch (error: any) { showToast(error.message, 'error'); } finally { setLoading(false); }
  };

  return (
    <div ref={containerRef} className="flex flex-col space-y-4">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 no-print">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Briefcase className="text-primary-600" /> Program Kerja & Anggaran
        </h2>
        <div className="flex flex-wrap gap-2 items-center">
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center">
                <button onClick={() => setViewMode('table')} className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}><Table size={18}/></button>
                <button onClick={() => setViewMode('sheet')} className={`p-2 rounded-md ${viewMode === 'sheet' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}><FileSpreadsheet size={18}/></button>
            </div>
            {!isSuperAdmin && <button onClick={() => handleOpen()} className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm font-medium"><Plus size={18} /> Tambah</button>}
        </div>
      </div>

      <div className={`flex-1 overflow-hidden bg-white dark:bg-dark-card rounded-xl border border-gray-100 shadow-sm`}>
          {viewMode === 'table' && (
              <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold border-b">
                            <tr><th className="px-6 py-4">Program</th><th className="px-6 py-4">Waktu</th><th className="px-6 py-4 text-right">Biaya</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Aksi</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{item.name}</div><div className="text-[10px] text-primary-600 font-bold uppercase">{divisions.find(d => d.id === item.division_id)?.name || '-'}</div></td>
                                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300">{item.year} - {parseMonths(item.month).join(', ')}</td>
                                    <td className="px-6 py-4 font-bold text-gray-800 dark:text-white text-right">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(calculateProgramTotal(item))}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(item.status)}`}>{item.status}</span></td>
                                    <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => handleOpenReview(item)} className="text-gray-400 hover:text-green-600"><FileText size={18}/></button><button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600"><Edit size={18}/></button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
              </div>
          )}
          {viewMode === 'sheet' && (
              <div className="overflow-auto bg-white dark:bg-dark-card">
                  <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 sticky top-0 z-20">
                          <tr><th className="p-3 border min-w-[200px] sticky left-0 bg-gray-100">Program Kerja</th><th className="p-3 border text-right">Biaya/Bln</th>{allMonths.map(m => <th key={m} className="p-2 border text-center">{m.substring(0,3)}</th>)}<th className="p-3 border text-right font-bold">Total</th></tr>
                      </thead>
                      <tbody>
                          {sortedDivisionIds.map(divId => (
                              <React.Fragment key={divId}>
                                  {groupedData[divId].map(p => (
                                      <tr key={p.id} className="hover:bg-gray-50">
                                          <td className="p-2 border sticky left-0 bg-white font-medium truncate">{p.name}</td>
                                          <td className="p-2 border text-right">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p.cost)}</td>
                                          {allMonths.map(month => <td key={month} className="border text-center">{parseMonths(p.month).includes(month) && <div className="w-2 h-2 mx-auto rounded-full bg-blue-500"></div>}</td>)}
                                          <td className="p-2 border text-right font-bold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(calculateProgramTotal(p))}</td>
                                      </tr>
                                  ))}
                              </React.Fragment>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Program' : 'Tambah Program Kerja'}>
          <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium">Nama Program</label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-md border bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium">Bidang</label><select required value={divisionId} onChange={e => setDivisionId(e.target.value)} className="w-full rounded-md border bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500"><option value="">Pilih</option>{divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <div><label className="block text-sm font-medium">Tahun</label><input type="number" required value={year} onChange={e => setYear(Number(e.target.value))} className="w-full rounded-md border bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500" /></div>
              </div>
              <div><label className="block text-sm font-medium">Biaya Satuan / Bulan</label><input type="number" value={costPerMonth} onChange={e => setCostPerMonth(Number(e.target.value))} className="w-full rounded-md border bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500" /></div>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                  <label className="block text-sm font-bold mb-2">Pilih Bulan</label>
                  <div className="grid grid-cols-4 gap-2">{allMonths.map(month => (
                      <div key={month} onClick={() => { setSelectedMonths(prev => prev.includes(month) ? prev.filter(m=>m!==month) : [...prev, month]) }} className={`text-center text-[10px] py-1.5 rounded cursor-pointer border transition ${selectedMonths.includes(month) ? 'bg-primary-600 text-white font-bold' : 'bg-white'}`}>{month.substring(0,3)}</div>
                  ))}</div>
              </div>
              <div className="pt-2 flex justify-end gap-2"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm border rounded">Batal</button><button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded font-bold">Simpan</button></div>
          </form>
      </Modal>
    </div>
  );
};
