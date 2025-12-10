
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Division, Member, Program, Foundation } from '../types';
import { Plus, Edit, Trash2, Layers, AlertTriangle, Users, Briefcase, X, Search, Calendar, User, Wallet, Hash } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface DivisionsProps {
  data: Division[];
  members: Member[];   
  programs: Program[]; 
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; // Added prop
}

// Helper for parsing month string
const parseMonths = (monthStr: string): string[] => {
    try {
      const parsed = JSON.parse(monthStr);
      return Array.isArray(parsed) ? parsed : [monthStr];
    } catch (e) {
      return monthStr ? [monthStr] : [];
    }
};

export const Divisions: React.FC<DivisionsProps> = ({ data, members, programs, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Division | null>(null);
  
  // Detail View State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  
  // Detail Filters
  const [memberSearch, setMemberSearch] = useState('');
  const [programYear, setProgramYear] = useState<number | ''>(new Date().getFullYear());
  const [programMonth, setProgramMonth] = useState('');

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [headMemberId, setHeadMemberId] = useState(''); // NEW: Kepala Bidang
  const [loading, setLoading] = useState(false);

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const handleOpen = (division?: Division) => {
    if (division) {
      setEditingItem(division);
      setName(division.name);
      setDescription(division.description || '');
      setHeadMemberId(division.head_member_id || '');
    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
      setHeadMemberId('');
    }
    setIsModalOpen(true);
  };

  const openDetail = (division: Division) => {
      setSelectedDivision(division);
      setMemberSearch(''); // Reset filter
      setProgramYear(new Date().getFullYear()); // Reset filter
      setProgramMonth(''); // Reset filter
      setDetailModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: any = { 
        name, 
        description,
        head_member_id: headMemberId || null
    };

    if (!editingItem && activeFoundation) {
        payload.foundation_id = activeFoundation.id;
        // Default order to last + 1
        const maxOrder = Math.max(0, ...data.map(d => d.order_index || 0));
        payload.order_index = maxOrder + 1;
    }

    try {
      if (editingItem) {
        const { error } = await supabase.from('divisions').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('divisions').insert([payload]);
        if (error) throw error;
      }
      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setDeleteConfirm({ isOpen: true, id });
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('divisions').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  // NEW: Update Order Directly via Input
  const handleUpdateOrder = async (id: string, newOrder: number) => {
      if (isNaN(newOrder)) return;
      try {
          await supabase.from('divisions').update({ order_index: newOrder }).eq('id', id);
          onRefresh();
      } catch (err) {
          console.error(err);
      }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  // Filtered Lists for Detail View
  const detailMembers = useMemo(() => {
      if (!selectedDivision) return [];
      let result = members.filter(m => m.division_id === selectedDivision.id);
      
      if (memberSearch) {
          result = result.filter(m => m.full_name.toLowerCase().includes(memberSearch.toLowerCase()));
      }
      return result;
  }, [selectedDivision, members, memberSearch]);

  const detailPrograms = useMemo(() => {
      if (!selectedDivision) return [];
      let result = programs.filter(p => p.division_id === selectedDivision.id);

      if (programYear) {
          result = result.filter(p => (p.year || 2024) === programYear);
      }
      if (programMonth) {
          result = result.filter(p => {
              const months = parseMonths(p.month);
              return months.includes(programMonth);
          });
      }
      return result;
  }, [selectedDivision, programs, programYear, programMonth]);

  const totalProgramCost = useMemo(() => {
      return detailPrograms.reduce((acc, curr) => acc + curr.cost, 0);
  }, [detailPrograms]);


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Layers className="text-primary-600 dark:text-primary-400" /> Manajemen Bidang
        </h2>
        {/* HIDE BUTTON FOR SUPER ADMIN */}
        {!isSuperAdmin && (
            <button
            onClick={() => handleOpen()}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
            <Plus size={18} /> Tambah Bidang
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((item, index) => {
          const headName = members.find(m => m.id === item.head_member_id)?.full_name || '-';

          return (
          <div 
            key={item.id} 
            onClick={() => openDetail(item)}
            className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition cursor-pointer group relative flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
                    <Layers size={20} />
                  </div>
                  {/* Reorder Input */}
                  {!isSuperAdmin && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Hash size={14} className="text-gray-400"/>
                          <input 
                            type="number"
                            defaultValue={item.order_index}
                            onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (val !== item.order_index) handleUpdateOrder(item.id, val);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                }
                            }}
                            className="w-10 text-xs text-center border border-gray-200 dark:border-gray-600 rounded bg-transparent dark:text-white focus:ring-1 focus:ring-primary-500 outline-none"
                            title="Urutan Tampilan"
                          />
                      </div>
                  )}
              </div>
              
              {!isSuperAdmin && (
                  <div className="flex gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleOpen(item); }} 
                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 z-10"
                    >
                    <Edit size={18} />
                    </button>
                    <button 
                        onClick={(e) => confirmDelete(item.id, e)} 
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 z-10"
                    >
                    <Trash2 size={18} />
                    </button>
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.name}</h3>
            
            {/* Show Head of Division */}
            <div className="mb-2 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                <User size={12} /> Kepala: <span className="font-semibold">{headName}</span>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 flex-1">
              {item.description || 'Tidak ada deskripsi.'}
            </p>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Users size={12}/> {members.filter(m => m.division_id === item.id).length} Anggota</span>
                <span className="flex items-center gap-1"><Briefcase size={12}/> {programs.filter(p => p.division_id === item.id).length} Program</span>
            </div>
          </div>
        )})}
        {data.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
            Belum ada bidang yang dibuat{activeFoundation ? ` untuk ${activeFoundation.name}` : ''}.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Bidang' : 'Tambah Bidang'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Bidang</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
              placeholder="Contoh: Humas"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kepala Bidang</label>
            <select
              value={headMemberId}
              onChange={e => setHeadMemberId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
            >
              <option value="">-- Pilih Anggota --</option>
              {/* Show only members that belong to this division OR allow assigning anyone */}
              {members.filter(m => !m.division_id || (editingItem && m.division_id === editingItem.id)).map(m => (
                  <option key={m.id} value={m.id}>{m.full_name} ({m.divisions?.name || 'No Div'})</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">*Disarankan memilih anggota yang sudah ada di bidang ini.</p>
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
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- DETAIL MODAL (GRID LAYOUT) --- */}
      {selectedDivision && (
          <Modal 
            isOpen={detailModalOpen} 
            onClose={() => setDetailModalOpen(false)} 
            title={`Detail Bidang: ${selectedDivision.name}`}
            size="3xl"
          >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[70vh]">
                  {/* LEFT COLUMN: MEMBERS */}
                  <div className="flex flex-col h-full overflow-hidden border-r border-gray-100 dark:border-dark-border pr-2 md:pr-4">
                      <div className="shrink-0 mb-4">
                          <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2 pb-1">
                              <Users size={16} className="text-blue-500" /> Anggota Bidang
                          </h4>
                          <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                              <input 
                                  type="text" 
                                  placeholder="Cari anggota..." 
                                  value={memberSearch}
                                  onChange={(e) => setMemberSearch(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none"
                              />
                          </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                          {detailMembers.length > 0 ? (
                              detailMembers.map(m => (
                                  <div key={m.id} className="flex flex-col p-2 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-100 dark:border-gray-700">
                                      <div className="flex justify-between items-center">
                                          <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">{m.full_name}</span>
                                          {selectedDivision.head_member_id === m.id && (
                                              <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">Kepala</span>
                                          )}
                                      </div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">{m.roles?.name || '-'}</span>
                                  </div>
                              ))
                          ) : (
                              <p className="text-sm text-gray-400 italic text-center py-4">Tidak ada anggota.</p>
                          )}
                      </div>
                  </div>

                  {/* RIGHT COLUMN: PROGRAMS */}
                  <div className="flex flex-col h-full overflow-hidden">
                      <div className="shrink-0 mb-4">
                          <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2 pb-1">
                              <Briefcase size={16} className="text-green-500" /> Program Kerja
                          </h4>
                          <div className="flex gap-2">
                              <select 
                                  value={programYear}
                                  onChange={(e) => setProgramYear(Number(e.target.value) || '')}
                                  className="w-1/3 py-1.5 px-2 text-xs border rounded bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700 focus:outline-none"
                              >
                                  <option value="">Semua Thn</option>
                                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                  <option value={new Date().getFullYear()+1}>{new Date().getFullYear()+1}</option>
                              </select>
                              <select 
                                  value={programMonth}
                                  onChange={(e) => setProgramMonth(e.target.value)}
                                  className="w-2/3 py-1.5 px-2 text-xs border rounded bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700 focus:outline-none"
                              >
                                  <option value="">Semua Bulan</option>
                                  {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                          </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                          {detailPrograms.length > 0 ? (
                              detailPrograms.map(p => (
                                  <div key={p.id} className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded text-sm border-l-2 border-primary-500">
                                      <div className="flex justify-between items-start">
                                          <span className="font-bold text-gray-800 dark:text-white line-clamp-1">{p.name}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                                              p.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                              p.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                                          }`}>{p.status}</span>
                                      </div>
                                      <div className="flex justify-between items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                                          <span>{p.year}</span>
                                          <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(p.cost)}</span>
                                      </div>
                                  </div>
                              ))
                          ) : (
                              <p className="text-sm text-gray-400 italic text-center py-4">Tidak ada program kerja.</p>
                          )}
                      </div>

                      {/* Total Budget Footer */}
                      <div className="shrink-0 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-card">
                          <div className="flex justify-between items-center text-sm font-bold text-gray-800 dark:text-white bg-green-50 dark:bg-green-900/20 p-2 rounded">
                              <span className="flex items-center gap-1 text-green-700 dark:text-green-400"><Wallet size={14}/> Total Anggaran</span>
                              <span>{formatCurrency(totalProgramCost)}</span>
                          </div>
                      </div>
                  </div>
              </div>
              <div className="mt-4 flex justify-end pt-2 border-t border-gray-100 dark:border-dark-border">
                <button
                    onClick={() => setDetailModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                    Tutup
                </button>
              </div>
          </Modal>
      )}

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
                  Apakah Anda yakin ingin menghapus bidang ini?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Semua anggota dan program terkait mungkin akan terpengaruh.
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
