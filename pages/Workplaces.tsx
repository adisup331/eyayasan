
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Workplace, Foundation } from '../types';
import { Plus, Edit, Trash2, Building2, MapPin, AlertTriangle, Search, Info } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface WorkplacesProps {
  data: Workplace[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean;
}

export const Workplaces: React.FC<WorkplacesProps> = ({ data, onRefresh, activeFoundation, isSuperAdmin }) => {
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

  const filteredData = useMemo(() => {
    let result = data;
    if (activeFoundation) {
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
  }, [data, activeFoundation, searchTerm]);

  const handleOpen = (item?: Workplace) => {
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
      setParentWorkplaceId('');
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
              <th className="px-6 py-4">Keterangan</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {filteredData.length > 0 ? (
                // Group by Parent
                data.filter(w => !w.parent_workplace_id).map(parent => {
                    const branches = data.filter(w => w.parent_workplace_id === parent.id);
                    return (
                        <React.Fragment key={parent.id}>
                            <tr className="bg-gray-50/30 dark:bg-gray-800/20">
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
                                <td className="px-6 py-4">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{parent.description || '-'}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleOpen(parent)} className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => setDeleteConfirm({ isOpen: true, id: parent.id })} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Hapus">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {branches.map(branch => (
                                <tr key={branch.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition">
                                    <td className="px-6 py-3 pl-14">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center shrink-0">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                            </div>
                                            <div>
                                                <span className="font-bold text-gray-800 dark:text-white text-sm tracking-tight">{branch.name}</span>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Cabang / Outlet</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                            {branch.address || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 italic text-[11px] text-gray-400">
                                        Outlet dari {parent.name}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleOpen(branch)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => setDeleteConfirm({ isOpen: true, id: branch.id })} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </React.Fragment>
                    );
                })
            ) : (
                <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 italic">
                        Belum ada data kantor/tempat kerja.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

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
