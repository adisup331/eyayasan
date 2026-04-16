import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Foundation, Group } from '../types';
// PINDAHKAN SEMUA IMPORT KE ATAS
import { Plus, Edit, Trash2, MapPin, Users, AlertTriangle, ChevronLeft } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

// Definisikan Interface
interface Desa {
  id: string;
  name: string;
  description?: string;
  foundation_id?: string;
  created_at?: string;
}

interface DesaProps {
  desas: Desa[];
  groups: Group[];
  activeFoundation: Foundation | null;
  onRefresh: () => void;
  isSuperAdmin?: boolean;
}

// Gunakan export default jika ingin memanggil tanpa kurung kurawal
const DesaComponents: React.FC<DesaProps> = ({ desas, groups, activeFoundation, onRefresh, isSuperAdmin }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Desa | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const desaGroupCount = (desaId: string) => groups.filter(g => g.desa_id === desaId).length;

  const handleOpen = (desa?: Desa) => {
    if (desa) {
      setEditingItem(desa);
      setName(desa.name);
      setDescription(desa.description || '');
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
    
    // Perbaikan Payload agar TypeScript tidak komplain
    const payload: any = { name, description };
    if (!editingItem && activeFoundation) payload.foundation_id = activeFoundation.id;

    try {
      if (editingItem) {
        const { error } = await supabase.from('desas').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('desas').insert([payload]);
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

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('desas').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Konten UI Anda tetap sama */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <MapPin className="text-primary-600" size={24} /> Manajemen Desa
        </h2>
        {!isSuperAdmin && (
          <button onClick={() => handleOpen()} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg transition-all">
            <Plus size={18} /> Tambah Desa
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {desas.map((desa) => {
          const count = desaGroupCount(desa.id);
          return (
            <div key={desa.id} className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition cursor-pointer group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                  <MapPin size={20} />
                </div>
                {!isSuperAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); handleOpen(desa); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition">
                      <Edit size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: desa.id }); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{desa.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">{desa.description || 'Tidak ada deskripsi'}</p>
              <div className="flex items-center gap-3 text-xs font-bold uppercase text-primary-600 bg-primary-50 dark:bg-primary-900/30 p-2 rounded-lg">
                <Users size={14} />
                {count} Kelompok
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add/Edit */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Desa' : 'Tambah Desa Baru'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nama Desa</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
              placeholder="Contoh: Desa Sukamaju"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Deskripsi</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
              placeholder="Lokasi, jumlah RT/RW, dll..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl">Batal</button>
            <button type="submit" disabled={loading} className="px-12 py-3 text-sm font-bold text-white bg-primary-600 rounded-xl">
              {loading ? 'Menyimpan...' : 'Simpan Desa'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Delete */}
      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({ isOpen: false, id: null })} title="Konfirmasi Hapus">
        <div className="text-center space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hapus Desa?</h3>
          <p className="text-sm text-gray-500">Desa dan hubungan kelompok akan dihapus permanen.</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="px-6 py-2 bg-gray-100 rounded-lg">Batal</button>
            <button onClick={executeDelete} className="px-6 py-2 text-white bg-red-500 rounded-lg">Hapus</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DesaComponents;