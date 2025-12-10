
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Program, Division, Organization, Member, Foundation } from '../types';
import { 
  Plus, Edit, Trash2, Calendar, Briefcase, Wallet, Filter, AlertTriangle, 
  X, Layers, CheckSquare, Square, Building2, ChevronRight, Table, 
  FileSpreadsheet, Maximize2, Minimize2, Search, ZoomIn, ZoomOut,
  Image, ExternalLink, Paperclip, FileText, Printer, BookOpen, Clock, Users, Crown, CheckCircle2
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface ProgramsProps {
  data: Program[];
  divisions: Division[];
  organizations: Organization[];
  members: Member[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; // Added prop
}

type ViewMode = 'table' | 'sheet' | 'document';

// Helper: Parse Month (Moved outside component for stability)
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
  
  // Full Screen State
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Sheet Zoom State
  const [zoomLevel, setZoomLevel] = useState(1);

  // Description / Evidence Modal
  // Renamed general modal to handle description and proof
  const [infoModal, setInfoModal] = useState<{isOpen: boolean, data: Program | null, mode: 'DESC' | 'PROOF'}>({ isOpen: false, data: null, mode: 'DESC' });

  // Filter State
  const [filterDivisionId, setFilterDivisionId] = useState('');
  const [filterOrgId, setFilterOrgId] = useState('');
  const [filterYear, setFilterYear] = useState<number | ''>('');
  const [filterMonths, setFilterMonths] = useState<string[]>([]); // Multi select

  // Delete Confirmation State
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
  
  // New Attachment States
  const [proofUrl, setProofUrl] = useState('');
  const [docUrl, setDocUrl] = useState('');

  const [loading, setLoading] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

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
        alert(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const adjustZoom = (delta: number) => {
      setZoomLevel(prev => {
          const newZoom = prev + delta;
          return Math.min(Math.max(newZoom, 0.5), 1.5); // Limit between 0.5 and 1.5
      });
  };

  // Get unique years for filter
  const availableYears = useMemo(() => {
    const years = new Set(data.map(p => p.year || 2024));
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [data]);

  // --- FILTERING & STATISTICS LOGIC ---
  
  const filteredData = useMemo(() => {
    let result = data.filter(item => {
      const itemMonths = parseMonths(item.month);
      
      const matchDivision = filterDivisionId ? item.division_id === filterDivisionId : true;
      const matchOrg = filterOrgId ? item.organization_id === filterOrgId : true;
      const matchYear = filterYear ? (item.year || 2024) === Number(filterYear) : true;
      
      // Filter Month logic
      const matchMonth = filterMonths.length > 0 
        ? itemMonths.some(m => filterMonths.includes(m))
        : true;

      return matchDivision && matchOrg && matchYear && matchMonth;
    });

    // Sort result primarily by Division Order Index, then by Program Name
    result.sort((a, b) => {
        const divA = divisions.find(d => d.id === a.division_id);
        const divB = divisions.find(d => d.id === b.division_id);

        const orderA = divA?.order_index ?? 9999;
        const orderB = divB?.order_index ?? 9999;

        // Primary Sort: Division Order
        if (orderA !== orderB) {
            return orderA - orderB;
        }

        // Secondary Sort: Division Name (if order same)
        const nameA = divA?.name || '';
        const nameB = divB?.name || '';
        if (nameA !== nameB) {
            return nameA.localeCompare(nameB);
        }

        // Tertiary Sort: Program Name
        return a.name.localeCompare(b.name);
    });

    return result;
  }, [data, filterDivisionId, filterOrgId, filterYear, filterMonths, divisions]);

  const stats = useMemo(() => {
    const isMonthlyFilter = filterMonths.length > 0;

    const calculatedCost = filteredData.reduce((acc, curr) => {
        if (!isMonthlyFilter) {
            // Jika tidak ada filter bulan, gunakan Total Biaya (Anggaran Tahunan/Keseluruhan)
            return acc + curr.cost;
        } else {
            // Jika ada filter bulan, hitung estimasi biaya HANYA untuk bulan yang dipilih
            const m = parseMonths(curr.month);
            const duration = m.length > 0 ? m.length : 1;
            const monthlyEstimate = curr.cost / duration;
            
            // Hitung berapa bulan yang beririsan dengan filter
            const matchCount = m.filter(month => filterMonths.includes(month)).length;
            
            return acc + (monthlyEstimate * matchCount);
        }
    }, 0);

    const totalPrograms = filteredData.length;
    const uniqueDivisionIds = new Set(filteredData.map(p => p.division_id));
    const divisionNames = Array.from(uniqueDivisionIds)
      .map(id => divisions.find(d => d.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    return { totalCost: calculatedCost, totalPrograms, divisionNames, isMonthlyFilter };
  }, [filteredData, divisions, filterMonths]);

  // --- HANDLERS ---

  const handleOpen = (program?: Program) => {
    if (program) {
      setEditingItem(program);
      setName(program.name);
      setDescription(program.description || '');
      
      const months = parseMonths(program.month);
      setSelectedMonths(months);
      
      const count = months.length || 1;
      setCostPerMonth(program.cost / count);
      
      setDivisionId(program.division_id);
      setOrganizationId(program.organization_id || '');
      setYear(program.year || new Date().getFullYear());
      setStatus(program.status);
      setProofUrl(program.proof_url || '');
      setDocUrl(program.doc_url || '');
    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
      setCostPerMonth(0);
      setSelectedMonths([allMonths[new Date().getMonth()]]);
      setDivisionId(divisions[0]?.id || '');
      setOrganizationId(organizations[0]?.id || '');
      setYear(new Date().getFullYear());
      setStatus('Planned');
      setProofUrl('');
      setDocUrl('');
    }
    setIsModalOpen(true);
  };

  const toggleMonthSelection = (month: string, isFilter: boolean = false) => {
    const setState = isFilter ? setFilterMonths : setSelectedMonths;
    const currentState = isFilter ? filterMonths : selectedMonths;

    if (currentState.includes(month)) {
        setState(currentState.filter(m => m !== month));
    } else {
        const newSelection = [...currentState, month];
        // Sort chronologically
        setState(newSelection.sort((a, b) => allMonths.indexOf(a) - allMonths.indexOf(b)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (selectedMonths.length === 0) {
      showToast("Pilih setidaknya satu bulan.", "error");
      setLoading(false);
      return;
    }

    const totalCost = costPerMonth * selectedMonths.length;
    const monthString = JSON.stringify(selectedMonths);

    const payload: any = {
      name,
      description,
      cost: totalCost,
      month: monthString,
      division_id: divisionId,
      organization_id: organizationId || null,
      year: year,
      status,
      proof_url: proofUrl || null,
      doc_url: docUrl || null
    };

    if (!editingItem && activeFoundation) {
        payload.foundation_id = activeFoundation.id;
    }

    try {
      if (editingItem) {
        const { error } = await supabase.from('programs').update(payload).eq('id', editingItem.id);
        if (error) throw error;
        showToast('Program berhasil diperbarui!', 'success');
      } else {
        const { error } = await supabase.from('programs').insert([payload]);
        if (error) throw error;
        showToast('Program baru berhasil ditambahkan!', 'success');
      }
      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('programs').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      showToast('Program berhasil dihapus!', 'success');
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) {
      showToast('Gagal menghapus: ' + error.message, 'error');
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300';
      case 'In Progress': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const resetFilters = () => {
    setFilterDivisionId('');
    setFilterOrgId('');
    setFilterYear('');
    setFilterMonths([]);
  };

  // --- VIEW RENDERING ---
  const renderDocumentView = () => {
      // Grouping uses the filteredData which is already sorted by Order Index
      const groupedData = new Map<string, Program[]>();
      filteredData.forEach(item => {
          const divId = item.division_id || 'unknown';
          const existing = groupedData.get(divId) || [];
          existing.push(item);
          groupedData.set(divId, existing);
      });

      return (
          <div className="bg-gray-100 dark:bg-dark-bg p-4 md:p-8 flex justify-center overflow-auto flex-1">
              <div className="bg-white dark:bg-dark-card shadow-lg w-full max-w-4xl p-8 md:p-12 min-h-[297mm] rounded-sm text-gray-800 dark:text-gray-200">
                  <div className="border-b-2 border-gray-800 dark:border-gray-200 pb-4 mb-8 text-center">
                      <h1 className="text-2xl font-bold uppercase tracking-wide">Laporan Program Kerja</h1>
                      <h2 className="text-lg font-medium mt-1">{activeFoundation?.name || 'Yayasan'}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Periode: {filterYear || new Date().getFullYear()} 
                          {filterMonths.length > 0 ? ` (${filterMonths.join(', ')})` : ' (Satu Tahun)'}
                      </p>
                  </div>
                  {Array.from(groupedData.entries()).map(([divId, programs]) => {
                      const division = divisions.find(d => d.id === divId);
                      const divName = division?.name || 'Bidang Umum';
                      const headId = division?.head_member_id;

                      // Get Members for this Division for the report
                      const divMembers = members.filter(m => m.division_id === divId);
                      const divTotalCost = programs.reduce((acc, curr) => acc + curr.cost, 0);

                      return (
                          <div key={divId} className="mb-10 break-inside-avoid">
                              <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                                <h3 className="text-xl font-bold text-primary-700 dark:text-primary-400 flex items-center gap-2">
                                    <Layers size={20}/> {divName}
                                </h3>
                                <div className="text-sm font-extrabold text-black dark:text-white">
                                    Total: {formatCurrency(divTotalCost)}
                                </div>
                              </div>

                              {/* Member List in Report */}
                              <div className="mb-4 bg-gray-50 dark:bg-gray-800/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-1">
                                      <Users size={12}/> Personil Bidang:
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                      {divMembers.length > 0 ? (
                                          divMembers.sort((a,b) => {
                                              // Sort Head First
                                              if (a.id === headId) return -1;
                                              if (b.id === headId) return 1;
                                              return 0;
                                          }).map(m => {
                                              const isHead = m.id === headId;
                                              const isInactive = m.status === 'Inactive';
                                              return (
                                              <span 
                                                key={m.id} 
                                                className={`text-xs px-2 py-1 border rounded flex items-center gap-1 ${
                                                    isHead 
                                                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 font-bold' 
                                                    : isInactive 
                                                        ? 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 line-through' 
                                                        : 'bg-white border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'
                                                }`}
                                              >
                                                  {isHead && <Crown size={10} className="text-yellow-600 dark:text-yellow-400"/>}
                                                  {m.full_name}
                                                  {isInactive && <span className="text-[9px] no-underline ml-1">(Non-Aktif)</span>}
                                              </span>
                                          )})
                                      ) : (
                                          <span className="text-xs italic text-gray-400">Belum ada anggota.</span>
                                      )}
                                  </div>
                              </div>

                              <div className="space-y-6">
                                  {programs.map((prog, idx) => {
                                      const months = parseMonths(prog.month).join(', ');
                                      const hasAttachments = prog.proof_url || prog.doc_url;
                                      return (
                                          <div key={prog.id} className="relative pl-4 border-l-4 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors group">
                                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{idx + 1}. {prog.name}</h4>
                                                  <span className={`text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider w-fit ${
                                                      prog.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                                                      prog.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                                  }`}>{prog.status}</span>
                                              </div>
                                              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 whitespace-pre-line leading-relaxed">{prog.description || 'Tidak ada deskripsi detail.'}</p>
                                              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                                                  <div className="flex items-center gap-1"><Calendar size={12}/> {prog.year} ({months})</div>
                                                  <div className="flex items-center gap-1"><Wallet size={12}/> {formatCurrency(prog.cost)}</div>
                                                  <div className="flex items-center gap-1"><Building2 size={12}/> {organizations.find(o => o.id === prog.organization_id)?.name || 'Umum'}</div>
                                              </div>
                                              {hasAttachments && (
                                                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-wrap gap-3 items-center">
                                                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1"><Paperclip size={12}/> Lampiran:</span>
                                                      {prog.proof_url && (<button onClick={() => setInfoModal({isOpen: true, data: prog, mode: 'PROOF'})} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"><Image size={12}/> Foto Bukti</button>)}
                                                      {prog.doc_url && (<a href={prog.doc_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"><FileText size={12}/> Dokumen Catatan</a>)}
                                                  </div>
                                              )}
                                              
                                              {/* EDIT & DELETE ACTIONS FOR DOCUMENT VIEW */}
                                              {!isSuperAdmin && (
                                                  <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-dark-card p-1 rounded shadow-sm border border-gray-100 dark:border-gray-700">
                                                      <button 
                                                        onClick={() => handleOpen(prog)} 
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                        title="Edit Program"
                                                      >
                                                          <Edit size={14}/>
                                                      </button>
                                                      <button 
                                                        onClick={() => confirmDelete(prog.id)} 
                                                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        title="Hapus Program"
                                                      >
                                                          <Trash2 size={14}/>
                                                      </button>
                                                  </div>
                                              )}
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      );
                  })}
                  {filteredData.length === 0 && (<div className="text-center py-20 text-gray-400"><BookOpen size={48} className="mx-auto mb-4 opacity-20"/><p>Tidak ada program kerja yang ditemukan.</p></div>)}
              </div>
          </div>
      );
  }

  const renderSheetView = () => {
    // Logic for grouping is maintained, but iteration order follows filteredData sort
    const groupedData = new Map<string, Program[]>();
    filteredData.forEach(item => {
        const existing = groupedData.get(item.division_id) || [];
        existing.push(item);
        groupedData.set(item.division_id, existing);
    });
    return (
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden flex-1 flex flex-col relative">
            <div className="absolute top-2 right-2 z-20 flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm">
                <button onClick={() => adjustZoom(-0.1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-l-lg"><ZoomOut size={16} /></button>
                <div className="px-2 py-2 text-xs font-mono border-x border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 min-w-[50px] text-center">{Math.round(zoomLevel * 100)}%</div>
                <button onClick={() => adjustZoom(0.1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-r-lg"><ZoomIn size={16} /></button>
            </div>
            <div className="overflow-auto flex-1 p-2">
                <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left', width: `${zoomLevel < 1 ? 100 / zoomLevel : 100}%` }}>
                    <table className="w-full text-left border-collapse border border-gray-300 dark:border-gray-700 min-w-[1200px]">
                        <thead className="bg-emerald-600 text-white text-xs uppercase font-bold text-center sticky top-0 z-10">
                            <tr>
                                <th className="border border-emerald-700 px-2 py-3 w-10 bg-emerald-600">No</th>
                                <th className="border border-emerald-700 px-2 py-3 w-32 bg-emerald-600">Bidang</th>
                                <th className="border border-emerald-700 px-2 py-3 w-40 bg-emerald-600">Personil</th>
                                <th className="border border-emerald-700 px-2 py-3 w-10 bg-emerald-600">No</th>
                                <th className="border border-emerald-700 px-2 py-3 min-w-[200px] bg-emerald-600">Kegiatan</th>
                                <th className="border border-emerald-700 px-2 py-3 w-10 bg-emerald-600">Bukti</th>
                                <th className="border border-emerald-700 px-2 py-3 min-w-[150px] bg-emerald-600">Keterangan</th>
                                <th className="border border-emerald-700 px-2 py-3 w-28 bg-emerald-600">Biaya</th>
                                {Array.from({length: 12}, (_, i) => i + 1).map(m => (<th key={m} className="border border-emerald-700 px-1 py-3 w-8 bg-emerald-600">{m}</th>))}
                                <th className="border border-emerald-700 px-2 py-3 w-16 bg-emerald-600">Jml</th>
                                <th className="border border-emerald-700 px-2 py-3 w-32 bg-emerald-600">Total Biaya</th>
                                <th className="border border-emerald-700 px-2 py-3 w-20 bg-emerald-600">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs text-gray-800 dark:text-gray-200">
                            {Array.from(groupedData.entries()).map(([divId, groupItems], groupIndex) => {
                                const division = divisions.find(d => d.id === divId);
                                const divName = division?.name || 'Unknown';
                                const divMembers = members.filter(m => m.division_id === divId)
                                    .filter(m => m.status !== 'Inactive') // Hide inactive members in sheet for space? Or show them crossed out? Let's show active only for compactness in sheet.
                                    .map(m => {
                                        const isHead = m.id === division?.head_member_id;
                                        return isHead ? `${m.full_name} (Kepala)` : m.full_name;
                                    })
                                    .join(', ');
                                return groupItems.map((item, index) => {
                                    const itemMonths = parseMonths(item.month);
                                    const count = itemMonths.length;
                                    const unitCost = count > 0 ? item.cost / count : 0;
                                    const isFirst = index === 0;
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 align-top">
                                            {isFirst && (<><td rowSpan={groupItems.length} className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center align-top font-bold bg-gray-50 dark:bg-gray-800">{groupIndex + 1}</td><td rowSpan={groupItems.length} className="border border-gray-300 dark:border-gray-700 px-2 py-2 align-top font-bold bg-gray-50 dark:bg-gray-800 rotate-180 [writing-mode:vertical-rl] text-center uppercase tracking-widest h-auto">{divName}</td><td rowSpan={groupItems.length} className="border border-gray-300 dark:border-gray-700 px-2 py-2 align-top bg-gray-50 dark:bg-gray-800 whitespace-normal break-words">{divMembers || '-'}</td></>)}
                                            <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center">{index + 1}</td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 font-medium whitespace-normal break-words min-w-[200px]">{item.name}</td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center">{(item.proof_url || item.doc_url) && (<button onClick={() => setInfoModal({isOpen: true, data: item, mode: 'PROOF'})} className="text-blue-500 hover:text-blue-700"><Paperclip size={14} /></button>)}</td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 whitespace-normal break-words min-w-[150px]">{item.description}</td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right whitespace-nowrap">{new Intl.NumberFormat('id-ID').format(unitCost)}</td>
                                            {allMonths.map(m => (<td key={m} className="border border-gray-300 dark:border-gray-700 px-1 py-1 text-center bg-gray-50/50 dark:bg-gray-900/30">{itemMonths.includes(m) ? 'X' : ''}</td>))}
                                            <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-center font-bold">{count}</td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-2 py-2 text-right font-bold whitespace-nowrap">{new Intl.NumberFormat('id-ID').format(item.cost)}</td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-1 py-2 text-center">{!isSuperAdmin && (<div className="flex justify-center gap-1"><button onClick={() => handleOpen(item)} title="Edit"><Edit size={14} className="text-blue-500" /></button><button onClick={() => confirmDelete(item.id)} title="Hapus"><Trash2 size={14} className="text-red-500" /></button></div>)}</td>
                                        </tr>
                                    );
                                });
                            })}
                            {filteredData.length > 0 && (
                                <tr className="bg-emerald-50 dark:bg-emerald-900/20 font-bold sticky bottom-0 z-10">
                                    <td colSpan={18} className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-right text-emerald-800 dark:text-emerald-300 uppercase">Total Anggaran</td>
                                    <td colSpan={2} className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-right text-emerald-800 dark:text-emerald-300 text-sm">{formatCurrency(filteredData.reduce((sum, item) => sum + item.cost, 0))}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  }

  const renderTableView = () => (
    <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 w-1/5">Nama Program</th>
                <th className="px-6 py-4 w-1/5">Deskripsi</th>
                <th className="px-6 py-4">Organisasi</th>
                <th className="px-6 py-4">Jadwal & Tahun</th>
                <th className="px-6 py-4">Biaya</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {filteredData.map((item) => {
                const months = parseMonths(item.month);
                const monthsCount = months.length;
                const unitCost = item.cost / (monthsCount || 1);
                return (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-6 py-4 align-top">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">{item.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{divisions.find(d => d.id === item.division_id)?.name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 align-top">
                     {item.description ? (
                        <div className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex items-start gap-1 group mb-1" onClick={() => setInfoModal({isOpen: true, data: item, mode: 'DESC'})}>
                            <span className="line-clamp-2">{item.description}</span><ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                     ) : (<span className="text-xs text-gray-400 italic block mb-1"> - </span>)}
                     {(item.proof_url || item.doc_url) && (<button onClick={() => setInfoModal({isOpen: true, data: item, mode: 'PROOF'})} className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded border border-blue-100 dark:border-blue-900 hover:bg-blue-100 transition"><Paperclip size={10} /> Lihat Bukti</button>)}
                  </td>
                  <td className="px-6 py-4 align-top"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">{organizations.find(o => o.id === item.organization_id)?.name || 'N/A'}</span></td>
                  <td className="px-6 py-4 align-top text-sm text-gray-600 dark:text-gray-300 min-w-[140px]"><div className="font-semibold mb-1 text-gray-900 dark:text-white">{item.year || 2024}</div><div className="flex flex-wrap gap-1">{months.map(m => (<span key={m} className={`px-1.5 py-0.5 rounded text-[10px] ${filterMonths.includes(m) ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 font-bold ring-1 ring-primary-200' : 'bg-gray-100 dark:bg-gray-700'}`}>{m.substring(0, 3)}</span>))}</div></td>
                  <td className="px-6 py-4 align-top text-sm"><div className="font-bold text-gray-800 dark:text-white">{formatCurrency(item.cost)}</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{formatCurrency(unitCost)} / bln</div></td>
                  <td className="px-6 py-4 align-top"><span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getStatusColor(item.status)}`}>{item.status}</span></td>
                  <td className="px-6 py-4 align-top text-right">{!isSuperAdmin && (<div className="flex justify-end gap-2"><button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"><Edit size={18} /></button><button onClick={() => confirmDelete(item.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={18} /></button></div>)}</td>
                </tr>
              )})}
              
              {/* TOTAL ROW - ADDED FEATURE */}
              {filteredData.length > 0 && (
                  <tr className="bg-gray-50 dark:bg-gray-800/50 font-bold border-t-2 border-gray-200 dark:border-gray-700 text-sm">
                      <td colSpan={4} className="px-6 py-4 text-right text-gray-700 dark:text-gray-300 uppercase">Total Anggaran:</td>
                      <td className="px-6 py-4 text-primary-700 dark:text-primary-400">{formatCurrency(filteredData.reduce((sum, item) => sum + item.cost, 0))}</td>
                      <td colSpan={2}></td>
                  </tr>
              )}

              {filteredData.length === 0 && (<tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"><div className="flex flex-col items-center justify-center"><Briefcase size={40} className="text-gray-300 dark:text-gray-600 mb-2" /><p>Tidak ada program yang ditemukan.</p>{(filterDivisionId || filterOrgId || filterYear || filterMonths.length > 0) && <p className="text-xs mt-1">Coba reset filter anda.</p>}</div></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
  );

  return (
    <div ref={containerRef} className={`transition-all duration-300 space-y-6 ${isFullScreen ? 'bg-gray-50 dark:bg-dark-bg p-8 overflow-y-auto h-screen w-screen fixed inset-0 z-50' : ''}`}>
      
      {/* Toast Notification */}
      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="text-sm font-medium">{toast.message}</span>
          </div>
      )}

      {/* ... (Header & Stats code same as previous) ... */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Briefcase className="text-primary-600 dark:text-primary-400" /> Program Kerja
        </h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            {/* View Toggles */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg self-start">
                <button onClick={() => setViewMode('table')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'table' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}><Table size={16} /> Table</button>
                <button onClick={() => setViewMode('sheet')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'sheet' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}><FileSpreadsheet size={16} /> Sheet</button>
                <button onClick={() => setViewMode('document')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'document' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}><FileText size={16} /> Laporan</button>
            </div>
             <button onClick={toggleFullScreen} className="bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:text-primary-600 border border-gray-200 dark:border-gray-600 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition" title={isFullScreen ? "Keluar Full Screen" : "Focus Mode"}>{isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}<span className="hidden sm:inline">{isFullScreen ? 'Minimize' : 'Focus Mode'}</span></button>
            {!isSuperAdmin && (<button onClick={() => handleOpen()} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition shadow-sm"><Plus size={18} /> Tambah Program</button>)}
        </div>
      </div>

      {/* --- STATS SUMMARY & FILTERS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Summary Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-800 p-5 rounded-xl text-white shadow-md">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-blue-100 text-sm font-medium mb-1">{stats.isMonthlyFilter ? 'Estimasi Biaya (Tersaring)' : 'Total Anggaran (Setahun)'}</p>
                  <h3 className="text-3xl font-bold">{formatCurrency(stats.totalCost)}</h3>
               </div>
               <div className="p-2 bg-white/20 rounded-lg"><Wallet size={24} className="text-white" /></div>
            </div>
            <p className="text-sm text-blue-100 mt-4 flex items-center gap-1"><Layers size={14} /> {stats.divisionNames ? `Bidang: ${stats.divisionNames}` : 'Semua Bidang'}</p>
          </div>
          <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col justify-center">
             <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"><Briefcase size={20} /></div>
               <span className="text-gray-500 dark:text-gray-400 text-sm">Jumlah Program</span>
             </div>
             <p className="text-2xl font-bold text-gray-800 dark:text-white pl-1">{stats.totalPrograms} <span className="text-sm font-normal text-gray-500">Program</span></p>
             <p className="text-xs text-gray-400 mt-2 pl-1">{(filterDivisionId || filterOrgId || filterYear || filterMonths.length > 0) ? 'Hasil filter diterapkan' : 'Menampilkan semua data'}</p>
          </div>
        </div>
        {/* Right: Filters */}
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-gray-800 dark:text-white font-semibold"><Filter size={18} /> Filter Data</div>
            {(filterDivisionId || filterOrgId || filterYear || filterMonths.length > 0) && (<button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><X size={12} /> Reset</button>)}
          </div>
          <div className="space-y-3">
             <div className="grid grid-cols-2 gap-2">
                <div>
                   <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Tahun</label>
                   <select className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value) || '')}>
                      <option value="">Semua</option>
                      {availableYears.map(y => (<option key={y} value={y}>{y}</option>))}
                   </select>
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Organisasi</label>
                    <select className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none" value={filterOrgId} onChange={(e) => setFilterOrgId(e.target.value)}>
                        <option value="">Semua</option>
                        {organizations.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
                    </select>
                </div>
             </div>
             <div>
               <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Bidang</label>
               <select className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none" value={filterDivisionId} onChange={(e) => setFilterDivisionId(e.target.value)}>
                  <option value="">Semua Bidang</option>
                  {divisions.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
               </select>
             </div>
             <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Filter Bulan (Multi Select)</label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {allMonths.map(m => {
                        const isSelected = filterMonths.includes(m);
                        return (<button key={m} onClick={() => toggleMonthSelection(m, true)} className={`text-[10px] px-2 py-1 rounded-full border ${isSelected ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'}`}>{m.substring(0, 3)}</button>)
                    })}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* --- CONTENT AREA (TOGGLE) --- */}
      {viewMode === 'table' ? renderTableView() : viewMode === 'sheet' ? renderSheetView() : renderDocumentView()}

      {/* --- FORM MODAL (Wide & Grid) --- */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingItem ? 'Edit Program Kerja' : 'Tambah Program Kerja'}
        size="2xl" // WIDE MODAL
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Top Section: Name & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Program</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-4 py-2.5 focus:border-primary-500 focus:ring-primary-500 outline-none transition"
                  placeholder="Contoh: Santunan Anak Yatim"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2.5 focus:border-primary-500 focus:ring-primary-500 outline-none transition"
                >
                    <option value="Planned">Planned (Rencana)</option>
                    <option value="In Progress">In Progress (Berjalan)</option>
                    <option value="Completed">Completed (Selesai)</option>
                </select>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Details */}
              <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan / Deskripsi</label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none resize-none"
                      placeholder="Tambahkan detail tujuan dan teknis program..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bidang (Divisi)</label>
                        <select
                            value={divisionId}
                            onChange={e => setDivisionId(e.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
                        >
                            <option value="">Pilih Bidang</option>
                            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organisasi</label>
                        <select
                            value={organizationId}
                            onChange={e => setOrganizationId(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
                        >
                            <option value="">Pilih Organisasi</option>
                            {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                     </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tahun Anggaran</label>
                    <input
                        type="number"
                        required
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
                    />
                  </div>
              </div>

              {/* Right Column: Schedule, Cost, Attachments */}
              <div className="space-y-5">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                      <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-bold text-blue-800 dark:text-blue-300">Estimasi Biaya</label>
                          <span className="text-xs text-blue-600 dark:text-blue-400 bg-white dark:bg-blue-900/50 px-2 py-1 rounded border border-blue-100 dark:border-blue-800">
                              Total: {formatCurrency(costPerMonth * selectedMonths.length)}
                          </span>
                      </div>
                      <div className="relative mb-3">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400">Rp</span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={costPerMonth}
                          onChange={e => setCostPerMonth(Number(e.target.value))}
                          className="w-full rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 dark:text-white pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Biaya per bulan"
                        />
                      </div>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400">
                        *Masukkan biaya untuk satu kali pelaksanaan (per bulan).
                      </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pilih Bulan Pelaksanaan</label>
                    <div className="grid grid-cols-4 gap-2">
                      {allMonths.map(m => {
                        const isSelected = selectedMonths.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => toggleMonthSelection(m, false)}
                            className={`text-[10px] py-2 px-1 rounded border transition-colors flex flex-col items-center justify-center gap-1 ${
                              isSelected 
                                ? 'bg-primary-600 border-primary-600 text-white shadow-sm' 
                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <span>{m.substring(0, 3)}</span>
                            {isSelected && <CheckSquare size={10}/>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Attachments Area */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Paperclip size={16} /> Lampiran & Bukti
                      </label>
                      
                      <div className="grid grid-cols-1 gap-3">
                          <div>
                              <div className="relative">
                                  <Image size={14} className="absolute left-3 top-2.5 text-gray-400" />
                                  <input 
                                    type="url"
                                    placeholder="Link Foto (Google Drive/Imgur)..."
                                    value={proofUrl}
                                    onChange={e => setProofUrl(e.target.value)}
                                    className="w-full pl-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-xs focus:ring-primary-500 outline-none"
                                  />
                              </div>
                          </div>
                          <div>
                              <div className="relative">
                                  <FileText size={14} className="absolute left-3 top-2.5 text-gray-400" />
                                  <input 
                                    type="url"
                                    placeholder="Link Dokumen (GDocs/PDF)..."
                                    value={docUrl}
                                    onChange={e => setDocUrl(e.target.value)}
                                    className="w-full pl-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-xs focus:ring-primary-500 outline-none"
                                  />
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
         
          <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 shadow-md transition flex items-center gap-2"
            >
              {loading ? 'Menyimpan...' : 'Simpan Program'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- INFO / PROOF MODAL --- */}
      <Modal 
        isOpen={infoModal.isOpen} 
        onClose={() => setInfoModal({isOpen: false, data: null, mode: 'DESC'})} 
        title={
            infoModal.mode === 'PROOF' 
            ? `Bukti Program: ${infoModal.data?.name || ''}` 
            : `Keterangan: ${infoModal.data?.name || ''}`
        }
      >
        <div className="space-y-4">
            {infoModal.mode === 'DESC' && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 max-h-[60vh] overflow-y-auto">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                        {infoModal.data?.description || 'Tidak ada keterangan.'}
                    </p>
                </div>
            )}

            {infoModal.mode === 'PROOF' && (
                <div className="space-y-4">
                    {/* Image Preview */}
                    {infoModal.data?.proof_url ? (
                        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                            <img 
                                src={infoModal.data.proof_url} 
                                alt="Bukti Kegiatan" 
                                className="w-full h-auto max-h-[400px] object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).onerror = null; 
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Gambar+Tidak+Ditemukan';
                                }}
                            />
                            <div className="p-2 bg-white dark:bg-gray-800 text-center border-t border-gray-200 dark:border-gray-700">
                                <a href={infoModal.data.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1">
                                    <ExternalLink size={12} /> Buka Gambar di Tab Baru
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <Image size={32} className="mx-auto mb-2 opacity-50"/>
                            Tidak ada link gambar bukti.
                        </div>
                    )}

                    {/* Document Link */}
                    {infoModal.data?.doc_url ? (
                        <a 
                            href={infoModal.data.doc_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block w-full p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/40 transition group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200 rounded">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Dokumen Catatan / GDocs</p>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 truncate max-w-[200px] sm:max-w-xs">{infoModal.data.doc_url}</p>
                                </div>
                            </div>
                            <ExternalLink size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                        </a>
                    ) : (
                        <div className="p-2 text-center text-xs text-gray-400 italic">
                            Tidak ada link dokumen catatan.
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-end">
                <button
                    onClick={() => setInfoModal({isOpen: false, data: null, mode: 'DESC'})}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                >
                    Tutup
                </button>
            </div>
        </div>
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
                  Apakah Anda yakin ingin menghapus program kerja ini? Tindakan ini tidak dapat dibatalkan.
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
              onClick={executeDelete}
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
