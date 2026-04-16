
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Village, Foundation } from '../types';
import { Plus, Edit, Trash2, Globe, AlertTriangle, Search, X, RefreshCw } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface VillagesProps {
  data: Village[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

export const Villages: React.FC<VillagesProps> = ({ data, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Village | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null, name?: string}>({ isOpen: false, id: null });
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpen = (village?: Village) => {
    if (village) {
      setEditingItem(village); 
      setName(village.name);
      setDescription(village.description || '');
    } else {
      setEditingItem(null); 
      setName(''); 
      setDescription('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setLoading(true);
    const payload: any = { name, description };
    if (!editingItem && activeFoundation) {
        payload.foundation_id = activeFoundation.id;
    }
    try {
      if (editingItem) { 
        await supabase.from('villages').update(payload).eq('id', editingItem.id); 
      } else { 
        await supabase.from('villages').insert([payload]); 
      }
      onRefresh(); 
      setIsModalOpen(false);
    } catch (error: any) { 
      alert('Error: ' + error.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await supabase.from('villages').delete().eq('id', deleteConfirm.id);
      onRefresh(); 
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) { 
      alert('Error: ' + error.message); 
    }
  };

  const filteredData = data.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    (v.description && v.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Globe className="text-primary-600 dark:text-primary-400" /> Manajemen Desa
          </h2>
          <p className="text-xs text-gray-500 mt-1">Kelola data wilayah desa untuk pengelompokan anggota.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari desa..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-card dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            />
          </div>
          {!isSuperAdmin && (
            <button 
              onClick={() => handleOpen()} 
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition font-bold shadow-md shadow-primary-600/20 whitespace-nowrap"
            >
              <Plus size={18} /> Tambah Desa
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredData.map((item) => (
          <div key={item.id} className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition group relative flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl group-hover:scale-110 transition-transform">
                <Globe size={24} />
              </div>
              {!isSuperAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => handleOpen(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => setDeleteConfirm({ isOpen: true, id: item.id, name: item.name })} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">
              {item.description || 'Tidak ada deskripsi.'}
            </p>
            <div className="mt-4 pt-4 border-t dark:border-gray-800 flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <span>Dibuat: {new Date(item.created_at || '').toLocaleDateString('id-ID')}</span>
            </div>
          </div>
        ))}
        {filteredData.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white dark:bg-dark-card rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
            <Globe size={48} className="mx-auto text-gray-200 mb-4"/>
            <p className="text-gray-500 font-medium">Data desa tidak ditemukan.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Desa' : 'Tambah Desa'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nama Desa</label>
            <input 
              type="text" 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm" 
              placeholder="Misal: Desa Sukamaju" 
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Deskripsi</label>
            <textarea 
              rows={3} 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm" 
              placeholder="Keterangan singkat desa..." 
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t dark:border-gray-800">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">Batal</button>
            <button type="submit" disabled={loading} className="px-10 py-2.5 text-xs font-black text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary-600/20 active:scale-95 transition-all uppercase tracking-widest flex items-center gap-2">
              {loading ? <RefreshCw className="animate-spin" size={16} /> : null}
              {editingItem ? 'SIMPAN PERUBAHAN' : 'TAMBAH DESA'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null})} title="Konfirmasi Hapus">
        <div className="text-center space-y-6">
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full w-fit mx-auto text-red-600">
              <AlertTriangle size={48}/>
            </div>
            <div className="space-y-2">
              <p className="text-gray-700 dark:text-gray-300 font-bold uppercase text-sm tracking-tight">Hapus desa <span className="text-red-600">{deleteConfirm.name}</span>?</p>
              <p className="text-xs text-gray-400 font-normal">Tindakan ini akan menghapus data desa secara permanen. Kelompok yang terhubung akan kehilangan referensi desa ini.</p>
            </div>
            <div className="flex justify-center gap-3 pt-4 border-t dark:border-gray-800">
              <button onClick={() => setDeleteConfirm({isOpen: false, id: null})} className="px-8 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Batal</button>
              <button onClick={executeDelete} className="px-12 py-3 text-xs font-black text-white bg-red-600 rounded-xl shadow-lg shadow-red-600/20 active:scale-95 transition-all">YA, HAPUS</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};
