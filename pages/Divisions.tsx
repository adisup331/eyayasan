
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Division, Member, Program, Foundation } from '../types';
import { Plus, Edit, Trash2, Layers, AlertTriangle, Users, Briefcase, X } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface DivisionsProps {
  data: Division[];
  members: Member[];   
  programs: Program[]; 
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; // Added prop
}

export const Divisions: React.FC<DivisionsProps> = ({ data, members, programs, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Division | null>(null);
  
  // Detail View State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  
  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpen = (division?: Division) => {
    if (division) {
      setEditingItem(division);
      setName(division.name);
      setDescription(division.description || '');
    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
    }
    setIsModalOpen(true);
  };

  const openDetail = (division: Division) => {
      setSelectedDivision(division);
      setDetailModalOpen(true);
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

  // Filtered Lists for Detail View
  const detailMembers = useMemo(() => {
      return selectedDivision ? members.filter(m => m.division_id === selectedDivision.id) : [];
  }, [selectedDivision, members]);

  const detailPrograms = useMemo(() => {
      return selectedDivision ? programs.filter(p => p.division_id === selectedDivision.id) : [];
  }, [selectedDivision, programs]);


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
        {data.map((item) => (
          <div 
            key={item.id} 
            onClick={() => openDetail(item)}
            className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition cursor-pointer group relative"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
                <Layers size={20} />
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
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3">
              {item.description || 'Tidak ada deskripsi.'}
            </p>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Users size={12}/> {members.filter(m => m.division_id === item.id).length} Anggota</span>
                <span className="flex items-center gap-1"><Briefcase size={12}/> {programs.filter(p => p.division_id === item.id).length} Program</span>
            </div>
          </div>
        ))}
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

      {/* --- DETAIL MODAL --- */}
      {selectedDivision && (
          <Modal 
            isOpen={detailModalOpen} 
            onClose={() => setDetailModalOpen(false)} 
            title={`Detail Bidang: ${selectedDivision.name}`}
          >
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                  <div className="mb-6">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-1">
                          <Users size={16} /> Anggota Bidang
                      </h4>
                      {detailMembers.length > 0 ? (
                          <ul className="space-y-2">
                              {detailMembers.map(m => (
                                  <li key={m.id} className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">{m.full_name}</span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">{m.roles?.name || '-'}</span>
                                  </li>
                              ))}
                          </ul>
                      ) : (
                          <p className="text-sm text-gray-400 italic">Belum ada anggota di bidang ini.</p>
                      )}
                  </div>

                  <div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-1">
                          <Briefcase size={16} /> Program Kerja
                      </h4>
                      {detailPrograms.length > 0 ? (
                          <div className="space-y-3">
                              {detailPrograms.map(p => (
                                  <div key={p.id} className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded text-sm border-l-2 border-primary-500">
                                      <div className="flex justify-between items-start">
                                          <span className="font-bold text-gray-800 dark:text-white">{p.name}</span>
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                              p.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                              p.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                                          }`}>{p.status}</span>
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{p.description || 'Tidak ada deskripsi'}</p>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <p className="text-sm text-gray-400 italic">Belum ada program kerja.</p>
                      )}
                  </div>
              </div>
              <div className="mt-6 flex justify-end">
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
