import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Foundation, ViewState } from '../types';
import { Globe, Edit, Trash2, Plus, CheckSquare, Square, Save, X } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface FoundationsProps {
  data: Foundation[];
  onRefresh: () => void;
}

const AVAILABLE_FEATURES: {id: string, label: string}[] = [
    { id: 'DASHBOARD', label: 'Dashboard' },
    { id: 'EVENTS', label: 'Acara & Absensi' },
    { id: 'EDUCATORS', label: 'Tenaga Pendidik' },
    { id: 'FINANCE', label: 'Keuangan' },
    { id: 'ORGANIZATIONS', label: 'Organisasi' },
    { id: 'MEMBERS', label: 'Anggota' },
    { id: 'ROLES', label: 'Role & Akses' },
    { id: 'DIVISIONS', label: 'Bidang / Divisi' },
    { id: 'PROGRAMS', label: 'Program Kerja' },
];

export const Foundations: React.FC<FoundationsProps> = ({ data, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Foundation | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpen = (item?: Foundation) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setAddress(item.address || '');
      setFeatures(item.features || []);
    } else {
      setEditingItem(null);
      setName('');
      setAddress('');
      setFeatures(AVAILABLE_FEATURES.map(f => f.id)); // Default enable all
    }
    setIsModalOpen(true);
  };

  const toggleFeature = (id: string) => {
    setFeatures(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { name, address, features };
    try {
      if (editingItem) {
        const { error } = await supabase.from('foundations').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('foundations').insert([payload]);
        if (error) throw error;
      }
      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(!confirm("Hapus Yayasan? Data terkait mungkin akan error atau hilang.")) return;
      try {
          const { error } = await supabase.from('foundations').delete().eq('id', id);
          if (error) throw error;
          onRefresh();
      } catch (error: any) {
          alert(error.message);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Globe className="text-primary-600 dark:text-primary-400" /> Master Yayasan
        </h2>
        <button
          onClick={() => handleOpen()}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <Plus size={18} /> Tambah Yayasan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map(foundation => (
              <div key={foundation.id} className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-2">
                     <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                         <Globe size={24} />
                     </div>
                     <div className="flex gap-2">
                         <button onClick={() => handleOpen(foundation)} className="text-gray-400 hover:text-blue-500"><Edit size={16}/></button>
                         <button onClick={() => handleDelete(foundation.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                     </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{foundation.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">{foundation.address || 'Tidak ada alamat'}</p>
                  
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                      <p className="text-xs text-gray-500 mb-2 font-semibold">Fitur Aktif:</p>
                      <div className="flex flex-wrap gap-1">
                          {foundation.features?.slice(0, 5).map(f => (
                              <span key={f} className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                  {AVAILABLE_FEATURES.find(af => af.id === f)?.label || f}
                              </span>
                          ))}
                          {(foundation.features?.length || 0) > 5 && (
                              <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500">+{foundation.features.length - 5} lainnya</span>
                          )}
                      </div>
                  </div>
              </div>
          ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Yayasan' : 'Tambah Yayasan Baru'}>
          <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Yayasan</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Alamat</label>
                  <textarea rows={2} value={address} onChange={e => setAddress(e.target.value)} 
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pilih Fitur / Modul Aktif</label>
                  <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_FEATURES.map(feat => (
                          <div 
                            key={feat.id}
                            onClick={() => toggleFeature(feat.id)}
                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition ${features.includes(feat.id) ? 'bg-primary-50 border-primary-500 text-primary-700 dark:bg-primary-900/30' : 'bg-white border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700'}`}
                          >
                             {features.includes(feat.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                             <span className="text-xs font-medium">{feat.label}</span>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
                    <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700">{loading ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
          </form>
      </Modal>
    </div>
  );
};
