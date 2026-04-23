
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Workplace, Foundation, Member } from '../types';
import { Plus, Edit, Trash2, Building2, MapPin, AlertTriangle, Search, Info, ChevronLeft, User, Users } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface WorkplacesProps {
  data: Workplace[];
  members: Member[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean;
}

export const Workplaces: React.FC<WorkplacesProps> = ({ data, members, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');
  const [selectedParent, setSelectedParent] = useState<Workplace | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Workplace | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [parentWorkplaceId, setParentWorkplaceId] = useState<string>('');

  // Delete matching state
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  const getWorkplaceStats = (workplaceId: string) => {
    const workplaceMembers = members.filter(m => m.workplace_id === workplaceId);
    return {
      total: workplaceMembers.length,
      male: workplaceMembers.filter(m => m.gender === 'L').length,
      female: workplaceMembers.filter(m => m.gender === 'P').length,
      members: workplaceMembers
    };
  };

  const filteredData = useMemo(() => {
    let result = data;
    if (activeFoundation && !isSuperAdmin) {
      result = result.filter(w => w.foundation_id === activeFoundation.id);
    }
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      result = result.filter(w => 
        w.name.toLowerCase().includes(lowSearch) || 
        w.description?.toLowerCase().includes(lowSearch) ||
        w.address?.toLowerCase().includes(lowSearch)
      );
    }
    return result;
  }, [data, activeFoundation, searchTerm, isSuperAdmin]);

  const handleOpen = (item?: Workplace, forceParentId?: string) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setDescription(item.description || '');
      setAddress(item.address || '');
      setParentWorkplaceId(item.parent_workplace_id || '');
    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
      setAddress('');
      setParentWorkplaceId(forceParentId || '');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFoundation && !isSuperAdmin) {
        alert("Anda tidak memiliki akses untuk menambah data.");
        return;
    }
    
    setLoading(true);
    const payload: any = { 
      name, 
      description, 
      address,
      parent_workplace_id: parentWorkplaceId || null
    };

    if (!editingItem && activeFoundation) {
      payload.foundation_id = activeFoundation.id;
    }

    try {
      if (editingItem) {
        const { error } = await supabase.from('workplaces').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('workplaces').insert([payload]);
        if (error) throw error;
      }
      onRefresh();
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('workplaces').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {viewMode === 'LIST' ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Building2 className="text-primary-600 dark:text-primary-400" /> Manajemen Kantor/Tempat Kerja
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Daftar lokasi atau unit kerja anggota (Karyawan).</p>
            </div>
            <button
              onClick={() => handleOpen()}
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-primary-600/20 font-bold text-sm"
            >
              <Plus size={18} /> TAMBAH KANTOR/TEMPAT KERJA
            </button>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
            <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Cari nama atau alamat..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none transition dark:text-white"
                    />
                </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Nama Kantor/Tempat Kerja</th>
                  <th className="px-6 py-4">Alamat</th>
                  <th className="px-6 py-4 text-center">Cabang</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {(() => {
                    const parents = filteredData.filter(w => !w.parent_workplace_id);
                    if (parents.length > 0) {
                        return parents.map(parent => {
                            const branches = data.filter(w => w.parent_workplace_id === parent.id);
                            return (
                                <tr 
                                    key={parent.id} 
                                    onClick={() => { setSelectedParent(parent); setViewMode('DETAIL'); }}
                                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition group cursor-pointer"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center shrink-0">
                                                <Building2 size={20} />
                                            </div>
                                            <div>
                                                <span className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{parent.name}</span>
                                                <p className="text-[10px] text-primary-600 font-bold uppercase tracking-widest mt-0.5">Kantor Pusat / Utama</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                                            <MapPin size={14} className="text-gray-400" />
                                            {parent.address || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-[10px] font-bold">
                                            {branches.length} CABANG
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                                onClick={() => { setSelectedParent(parent); setViewMode('DETAIL'); }}
                                                className="px-3 py-1.5 text-xs font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition border border-primary-100 dark:border-primary-900/50"
                                            >
                                                KELOLA CABANG
                                            </button>
                                            <button onClick={() => handleOpen(parent)} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg transition">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => setDeleteConfirm({ isOpen: true, id: parent.id })} className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        });
                    } else if (filteredData.length > 0) {
                        // All are orphans/children? Show them as list
                        return filteredData.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center shrink-0">
                                            <MapPin size={20} />
                                        </div>
                                        <div>
                                            <span className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{item.name}</span>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Unit Kerja / Cabang</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-500">{item.address || '-'}</td>
                                <td className="px-6 py-4 text-center text-xs text-gray-400">-</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleOpen(item)} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg transition">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => setDeleteConfirm({ isOpen: true, id: item.id })} className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ));
                    } else {
                        return (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 italic font-medium">
                                    Belum ada data kantor/tempat kerja.
                                </td>
                            </tr>
                        );
                    }
                })()}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-right-4 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => { 
                            if (selectedParent?.parent_workplace_id) {
                                setSelectedParent(data.find(w => w.id === selectedParent.parent_workplace_id) || null);
                            } else {
                                setViewMode('LIST'); 
                                setSelectedParent(null); 
                            }
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition text-gray-500 flex items-center gap-2 font-bold text-sm"
                    >
                        <ChevronLeft size={20} /> Kembali
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                            Detail {selectedParent?.parent_workplace_id ? 'Cabang' : 'Kantor'}: <span className="text-primary-600">{selectedParent?.name}</span>
                        </h2>
                        <p className="text-xs text-gray-500 font-medium tracking-wide border-l-2 border-primary-500 pl-2 ml-1">
                            {selectedParent?.parent_workplace_id ? 'Informasi detail unit outlet/cabang.' : 'Kelola informasi unit pusat dan seluruh cabang/outlet.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpen(undefined, selectedParent?.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition shadow-lg shadow-emerald-600/20 font-bold text-xs"
                >
                    <Plus size={16} /> TAMBAH CABANG
                </button>
            </div>

            {/* PARENT INFO CARD */}
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 dark:bg-primary-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center shrink-0 shadow-inner">
                        <Building2 size={32} />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedParent?.name}</h3>
                                <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 w-fit px-2 py-0.5 rounded ${selectedParent?.parent_workplace_id ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600'}`}>
                                    {selectedParent?.parent_workplace_id ? 'Cabang / Outlet' : 'Kantor Pusat / Utama'}
                                </p>
                            </div>
                            <button onClick={() => selectedParent && handleOpen(selectedParent)} className="text-gray-400 hover:text-blue-600 transition p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <Edit size={18} />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lokasi Alamat</label>
                                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <MapPin size={16} className="text-primary-500" />
                                    <span>{selectedParent?.address || 'Alamat belum diatur'}</span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Keterangan / Memo</label>
                                <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <Info size={16} className="text-indigo-500 mt-0.5" />
                                    <span>{selectedParent?.description || 'Tidak ada keterangan tambahan'}</span>
                                </div>
                            </div>
                        </div>

                        {selectedParent && (
                            <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl">
                                    <Users size={14} />
                                    <span className="text-[10px] font-black uppercase">Total: {getWorkplaceStats(selectedParent.id).total} Anggota</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl">
                                    <User size={14} />
                                    <span className="text-[10px] font-black uppercase">Pria: {getWorkplaceStats(selectedParent.id).male}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-xl">
                                    <User size={14} />
                                    <span className="text-[10px] font-black uppercase">Wanita: {getWorkplaceStats(selectedParent.id).female}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedParent && getWorkplaceStats(selectedParent.id).total > 0 && (
                <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                           <Users size={14} /> Daftar Anggota di {selectedParent.name}
                        </h4>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {getWorkplaceStats(selectedParent.id).members.map(m => (
                                <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${m.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                                        {m.gender}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate uppercase tracking-tight">{m.full_name}</p>
                                        <p className="text-[9px] text-gray-500 dark:text-gray-400 font-medium truncate uppercase">{m.member_type}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!selectedParent?.parent_workplace_id && (
                <>
                    <div className="flex items-center gap-2 mt-8 mb-4">
                        <div className="h-px bg-gray-100 dark:bg-gray-800 flex-1"></div>
                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] px-4 whitespace-nowrap">Daftar Cabang & Outlet Terkait</h3>
                        <div className="h-px bg-gray-100 dark:bg-gray-800 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                        {(data.filter(w => w.parent_workplace_id === selectedParent?.id)).map(branch => (
                            <div 
                                key={branch.id} 
                                onClick={() => setSelectedParent(branch)}
                                className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-md transition group border-l-4 border-l-emerald-500/30 cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
                                        <MapPin size={20} />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => handleOpen(branch)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit size={16}/></button>
                                        <button onClick={() => setDeleteConfirm({ isOpen: true, id: branch.id })} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-tight leading-tight">{branch.name}</h3>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2 min-h-[32px] font-medium leading-relaxed">{branch.address || 'Alamat cabang belum diatur.'}</p>
                                
                                <div className="mt-3 flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</span>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white leading-none mt-1">{getWorkplaceStats(branch.id).total}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pria</span>
                                        <span className="text-sm font-bold text-blue-600 leading-none mt-1">{getWorkplaceStats(branch.id).male}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Wanita</span>
                                        <span className="text-sm font-bold text-rose-600 leading-none mt-1">{getWorkplaceStats(branch.id).female}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">UNIT OUTLET</span>
                                    <div className="flex items-center gap-1.5">
                                        <Info size={12} className="text-gray-300" />
                                        <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{branch.description || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(data.filter(w => w.parent_workplace_id === selectedParent?.id)).length === 0 && (
                            <div className="col-span-full py-20 text-center bg-gray-50 dark:bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-full w-fit mx-auto mb-4 shadow-sm text-gray-300"><Building2 size={40}/></div>
                                <p className="text-gray-500 dark:text-gray-400 font-bold">Belum ada cabang terdaftar.</p>
                                <button 
                                    onClick={() => handleOpen(undefined, selectedParent?.id)}
                                    className="text-primary-600 text-xs font-bold mt-2 hover:underline"
                                >
                                    Klik di sini untuk menambah cabang pertama.
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Kantor/Tempat Kerja' : 'Tambah Kantor/Tempat Kerja'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Nama Kantor/Tempat Kerja</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition"
              placeholder="Contoh: Mie Wonogiri / Jurcil"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Kantor Pusat (Opsional)</label>
            <select
              value={parentWorkplaceId}
              onChange={e => setParentWorkplaceId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition"
            >
              <option value="">-- Jadikan Kantor Pusat --</option>
              {data.filter(w => !w.parent_workplace_id && w.id !== editingItem?.id).map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[10px] text-gray-400 ml-1 italic">Pilih kantor pusat jika ini adalah cabang atau outlet.</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Alamat</label>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition"
              placeholder="Alamat lengkap lokasi..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Keterangan</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition"
              placeholder="Keterangan tambahan..."
            />
          </div>
          <div className="pt-4 border-t dark:border-gray-800 flex justify-end gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">BATAL</button>
            <button type="submit" disabled={loading} className="px-6 py-2.5 text-sm bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition disabled:opacity-50">
              {loading ? 'MENYIMPAN...' : 'SIMPAN'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({ isOpen: false, id: null })} title="Hapus Kantor/Tempat Kerja">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/30">
            <AlertTriangle size={24} />
            <p className="text-sm font-medium">Hapus data ini? Anggota yang terkait dengan kantor/tempat kerja ini tidak akan terhapus, namun data tempat kerja pada profil mereka akan kosong.</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="px-6 py-2.5 text-sm text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition">BATAL</button>
            <button onClick={handleDelete} className="px-6 py-2.5 text-sm bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition">YA, HAPUS</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
