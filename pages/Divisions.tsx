import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Division, Member, Program, Foundation } from '../types';
import { Plus, Edit, Trash2, Layers, AlertTriangle, Users, Briefcase, X, Search, Calendar, User, Wallet, Hash, UserPlus, CheckCircle2 } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface DivisionsProps {
  data: Division[];
  members: Member[];   
  programs: Program[]; 
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

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
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  
  const [memberSearch, setMemberSearch] = useState('');
  const [programYear, setProgramYear] = useState<number | ''>(new Date().getFullYear());
  const [programMonth, setProgramMonth] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  // Add Member State
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [headMemberId, setHeadMemberId] = useState(''); 
  const [loading, setLoading] = useState(false);

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const handleOpen = (division?: Division) => {
    if (division) {
      setEditingItem(division); setName(division.name);
      setDescription(division.description || ''); setHeadMemberId(division.head_member_id || '');
    } else {
      setEditingItem(null); setName(''); setDescription(''); setHeadMemberId('');
    }
    setIsModalOpen(true);
  };

  const openDetail = (division: Division) => {
      setSelectedDivision(division);
      setMemberSearch(''); setProgramYear(new Date().getFullYear()); setProgramMonth('');
      setDetailModalOpen(true);
      setIsAddingMember(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const payload: any = { name, description, head_member_id: headMemberId || null };
    if (!editingItem && activeFoundation) {
        payload.foundation_id = activeFoundation.id;
        const maxOrder = Math.max(0, ...data.map(d => d.order_index || 0));
        payload.order_index = maxOrder + 1;
    }
    try {
      if (editingItem) { await supabase.from('divisions').update(payload).eq('id', editingItem.id); } 
      else { await supabase.from('divisions').insert([payload]); }
      onRefresh(); setIsModalOpen(false);
    } catch (error: any) { alert('Error: ' + error.message); } finally { setLoading(false); }
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await supabase.from('divisions').delete().eq('id', deleteConfirm.id);
      onRefresh(); setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) { alert('Error: ' + error.message); }
  };

  const handleUpdateOrder = async (id: string, newOrder: number) => {
      if (isNaN(newOrder)) return;
      try { await supabase.from('divisions').update({ order_index: newOrder }).eq('id', id); onRefresh(); } catch (err) { console.error(err); }
  };

  // Add Member Logic
  const handleAddMember = async (memberId: string) => {
      if (!selectedDivision) return;
      try {
          const { error } = await supabase.from('members').update({ division_id: selectedDivision.id }).eq('id', memberId);
          if (error) throw error;
          onRefresh();
          setCandidateSearch('');
      } catch (err: any) { alert("Gagal menambahkan anggota: " + err.message); }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  const detailMembers = useMemo(() => {
      if (!selectedDivision) return [];
      let result = members.filter(m => m.division_id === selectedDivision.id);
      if (memberSearch) result = result.filter(m => m.full_name.toLowerCase().includes(memberSearch.toLowerCase()));
      return result;
  }, [selectedDivision, members, memberSearch]);

  const candidates = useMemo(() => {
      if (!selectedDivision) return [];
      return members
        .filter(m => m.division_id !== selectedDivision.id)
        .filter(m => m.full_name.toLowerCase().includes(candidateSearch.toLowerCase()))
        .slice(0, 10);
  }, [members, selectedDivision, candidateSearch]);

  const availableYears = useMemo(() => {
    const years = new Set(programs.map(p => p.year || 2024));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [programs]);

  const detailPrograms = useMemo(() => {
      if (!selectedDivision) return [];
      let result = programs.filter(p => p.division_id === selectedDivision.id);
      if (programYear) result = result.filter(p => (p.year || 2024) === programYear);
      if (programMonth) result = result.filter(p => parseMonths(p.month).includes(programMonth));
      return result;
  }, [selectedDivision, programs, programYear, programMonth]);

  const totalProgramCost = useMemo(() => detailPrograms.reduce((acc, curr) => acc + curr.cost, 0), [detailPrograms]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><Layers className="text-primary-600 dark:text-primary-400" /> Manajemen Bidang</h2>
        {!isSuperAdmin && <button onClick={() => handleOpen()} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition font-bold shadow-md shadow-primary-600/20"><Plus size={18} /> Tambah Bidang</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((item) => {
          const headName = members.find(m => m.id === item.head_member_id)?.full_name || '-';
          return (
          <div key={item.id} onClick={() => openDetail(item)} className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition cursor-pointer group relative flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3"><div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform"><Layers size={20} /></div>
                  {!isSuperAdmin && <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}><Hash size={14} className="text-gray-400"/><input type="number" defaultValue={item.order_index} onBlur={(e) => { const val = parseInt(e.target.value); if (val !== item.order_index) handleUpdateOrder(item.id, val); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} className="w-10 text-xs text-center border border-gray-200 dark:border-gray-600 rounded bg-transparent dark:text-white outline-none" title="Urutan"/></div>}
              </div>
              {!isSuperAdmin && <div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); handleOpen(item); }} className="text-gray-400 hover:text-blue-600 z-10"><Edit size={18} /></button><button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: item.id }); }} className="text-gray-400 hover:text-red-600 z-10"><Trash2 size={18} /></button></div>}
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.name}</h3>
            <div className="mb-2 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1"><User size={12} /> Kepala: <span className="font-semibold">{headName}</span></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">{item.description || 'Tidak ada deskripsi.'}</p>
            <div className="mt-4 pt-4 border-t dark:border-gray-800 flex gap-4 text-xs text-gray-500 font-bold uppercase tracking-widest"><span className="flex items-center gap-1"><Users size={14} className="text-primary-500"/> {members.filter(m => m.division_id === item.id).length} Anggota</span><span className="flex items-center gap-1"><Briefcase size={14} className="text-indigo-500"/> {programs.filter(p => p.division_id === item.id).length} Program</span></div>
          </div>
        )})}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Bidang' : 'Tambah Bidang'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Bidang</label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" placeholder="Misal: Humas" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kepala Bidang</label><select value={headMemberId} onChange={e => setHeadMemberId(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"><option value="">-- Pilih Anggota --</option>{members.filter(m => !m.division_id || (editingItem && m.division_id === editingItem.id)).map(m => (<option key={m.id} value={m.id}>{m.full_name}</option>))}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi</label><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" /></div>
          <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sm font-black text-gray-400 uppercase tracking-widest">Batal</button><button type="submit" disabled={loading} className="px-10 py-2.5 text-sm font-black text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary-600/20 active:scale-95 transition-all uppercase tracking-widest">SIMPAN</button></div>
        </form>
      </Modal>

      {selectedDivision && (
          <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={`Bidang: ${selectedDivision.name}`} size="3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[60vh]">
                  <div className="flex flex-col h-full border-r dark:border-gray-800 pr-0 md:pr-8">
                      <div className="shrink-0 mb-6 flex justify-between items-center"><h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Users size={16}/> Daftar Anggota</h4><button onClick={() => setIsAddingMember(!isAddingMember)} className={`p-2 rounded-xl transition-all shadow-sm ${isAddingMember ? 'bg-red-50 text-red-500 ring-1 ring-red-200' : 'bg-primary-50 text-primary-600 ring-1 ring-primary-200'}`}>{isAddingMember ? <X size={18}/> : <UserPlus size={18}/>}</button></div>
                      {isAddingMember ? (
                          <div className="mb-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                              <div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={14}/><input type="text" placeholder="Cari anggota yang belum masuk..." value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-primary-500" /></div>
                              <div className="max-h-48 overflow-y-auto divide-y dark:divide-gray-800 border rounded-xl dark:border-gray-800 shadow-inner bg-white dark:bg-gray-900">
                                  {candidates.map(m => (<div key={m.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition"><div className="flex flex-col"><span className="text-xs font-bold dark:text-white uppercase tracking-tight">{m.full_name}</span><span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{m.divisions?.name || 'BELUM ADA BIDANG'}</span></div><button onClick={() => handleAddMember(m.id)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-sm" title="Tambahkan ke Bidang"><UserPlus size={16}/></button></div>))}
                                  {candidates.length === 0 && <div className="p-10 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest italic">Anggota tidak ditemukan</div>}
                              </div>
                              <p className="text-[9px] font-black text-blue-600/50 uppercase text-center tracking-[0.2em]">Pilih anggota untuk ditambahkan ke bidang ini</p>
                          </div>
                      ) : (
                          <div className="mb-6"><div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={14}/><input type="text" placeholder="Filter anggota terdaftar..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-primary-500" /></div></div>
                      )}
                      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {detailMembers.map(m => (<div key={m.id} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 relative overflow-hidden group"><div className="flex justify-between items-center relative z-10"><div><span className="font-bold text-gray-700 dark:text-white text-xs uppercase tracking-tight">{m.full_name}</span><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{m.roles?.name || '-'}</p></div>{selectedDivision.head_member_id === m.id && <span className="text-[9px] bg-amber-500 text-white px-2 py-0.5 rounded-lg font-black uppercase shadow-lg shadow-amber-500/20 tracking-widest">Kepala</span>}</div></div>))}{detailMembers.length === 0 && <p className="text-xs text-gray-400 italic text-center py-10 font-bold uppercase tracking-widest opacity-50">Tidak ada anggota terdaftar</p>}
                      </div>
                  </div>
                  <div className="flex flex-col h-full">
                      <div className="shrink-0 mb-6"><h4 className="text-xs font-black text-green-600 uppercase tracking-widest flex items-center gap-2 mb-4"><Briefcase size={16}/> Program Kerja</h4><div className="flex gap-2"><select value={programYear} onChange={e => setProgramYear(Number(e.target.value) || '')} className="flex-1 py-2 px-3 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-green-500">{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select><select value={programMonth} onChange={e => setProgramMonth(e.target.value)} className="flex-[2] py-2 px-3 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-green-500"><option value="">-- SEMUA BULAN --</option>{allMonths.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select></div></div>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {detailPrograms.map(p => (<div key={p.id} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl text-xs border border-gray-100 dark:border-gray-700"><div className="flex justify-between items-start mb-2"><span className="font-black text-gray-800 dark:text-white uppercase leading-tight">{p.name}</span><span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${p.status === 'Completed' ? 'bg-green-100 text-green-700' : p.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>{p.status}</span></div><div className="flex justify-between items-center text-gray-400 font-bold"><span>{p.year}</span><span className="text-primary-600">{formatCurrency(p.cost)}</span></div></div>))}{detailPrograms.length === 0 && <p className="text-xs text-gray-400 italic text-center py-10 font-bold uppercase tracking-widest opacity-50">Tidak ada program terdaftar</p>}
                      </div>
                      <div className="shrink-0 mt-6 pt-4 border-t dark:border-gray-800"><div className="flex justify-between items-center text-xs font-black text-gray-800 dark:text-white bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/30 shadow-sm uppercase tracking-tighter"><span className="flex items-center gap-1.5 text-green-700 dark:text-green-400"><Wallet size={16}/> Estimasi Terfilter</span><span>{formatCurrency(totalProgramCost)}</span></div></div>
                  </div>
              </div>
              <div className="mt-8 flex justify-end pt-4 border-t dark:border-gray-800"><button onClick={() => setDetailModalOpen(false)} className="px-10 py-3 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">Tutup Detail</button></div>
          </Modal>
      )}

      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null})} title="Konfirmasi Hapus">
        <div className="text-center space-y-6">
            <div className="bg-red-50 p-6 rounded-full w-fit mx-auto text-red-600 animate-pulse"><AlertTriangle size={48}/></div>
            <p className="text-gray-700 dark:text-gray-300 font-bold uppercase text-sm tracking-tight leading-relaxed">Hapus bidang ini secara permanen? <br/><span className="text-xs text-gray-400 font-normal">Tindakan ini tidak dapat dibatalkan.</span></p>
            <div className="flex justify-center gap-3 pt-4 border-t dark:border-gray-800"><button onClick={() => setDeleteConfirm({isOpen: false, id: null})} className="px-8 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Batal</button><button onClick={executeDelete} className="px-12 py-3 text-xs font-black text-white bg-red-600 rounded-xl shadow-lg shadow-red-600/20 active:scale-95 transition-all">YA, HAPUS</button></div>
        </div>
      </Modal>
    </div>
  );
};