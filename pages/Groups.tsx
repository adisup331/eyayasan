
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Group, Organization, Member, Foundation } from '../types';
import { Plus, Edit, Trash2, Boxes, Users, Building2, AlertTriangle, Globe } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface GroupsProps {
  data: Group[];
  organizations: Organization[];
  members: Member[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

export const Groups: React.FC<GroupsProps> = ({ data, organizations, members, onRefresh, activeFoundation, isSuperAdmin }) => {
  // CRUD States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Group | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });
  
  // Detail View States
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [loading, setLoading] = useState(false);

  // --- CRUD HANDLERS ---
  const handleOpen = (group?: Group) => {
    if (group) {
      setEditingItem(group);
      setName(group.name);
      setDescription(group.description || '');
      setOrganizationId(group.organization_id);
    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
      // Default to first organization if available
      setOrganizationId(organizations[0]?.id || '');
    }
    setIsModalOpen(true);
  };

  const openDetail = (group: Group) => {
      setSelectedGroup(group);
      setIsDetailOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!organizationId) {
        alert("Pilih organisasi terlebih dahulu.");
        setLoading(false);
        return;
    }

    const selectedOrg = organizations.find(o => o.id === organizationId);
    const targetFoundationId = selectedOrg?.foundation_id || activeFoundation?.id || null;

    const payload: any = { 
        name, 
        description, 
        organization_id: organizationId,
        foundation_id: targetFoundationId
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from('groups').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('groups').insert([payload]);
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
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, id });
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('groups').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  // Filter Members for Detail View
  const groupMembers = useMemo(() => {
      if (!selectedGroup) return [];
      return members.filter(m => m.group_id === selectedGroup.id);
  }, [selectedGroup, members]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Boxes className="text-primary-600 dark:text-primary-400" /> Manajemen Kelompok
        </h2>
        <button
        onClick={() => handleOpen()}
        className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
        <Plus size={18} /> Tambah Kelompok
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((item) => {
           const memberCount = members.filter(m => m.group_id === item.id).length;
           const org = organizations.find(o => o.id === item.organization_id);
           const foundationName = item.foundations?.name || org?.foundations?.name;
           
           return (
            <div 
                key={item.id} 
                onClick={() => openDetail(item)}
                className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition flex flex-col cursor-pointer group relative"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-lg group-hover:scale-110 transition-transform">
                        <Boxes size={20} />
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleOpen(item); }} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 z-10">
                        <Edit size={18} />
                        </button>
                        <button onClick={(e) => confirmDelete(item.id, e)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 z-10">
                        <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                <div className="mb-2">
                    {/* SUPER ADMIN: Show Foundation Name */}
                    {isSuperAdmin && foundationName && (
                        <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-semibold mb-1">
                            <Globe size={10}/> {foundationName}
                        </span>
                    )}
                    <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                        <Building2 size={10} /> {org?.name || 'Unknown Org'}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1">{item.name}</h3>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-1">
                    {item.description || 'Tidak ada deskripsi.'}
                </p>
                
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1"><Users size={14}/> {memberCount} Anggota</span>
                </div>
            </div>
        )})}
        {data.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
            Belum ada kelompok yang dibuat.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Kelompok' : 'Tambah Kelompok'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Kelompok</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
              placeholder="Contoh: Kelompok A, Kelas 1B"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organisasi</label>
            <select
                required
                value={organizationId}
                onChange={e => setOrganizationId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
            >
                <option value="">Pilih Organisasi</option>
                {organizations.map(o => (
                    <option key={o.id} value={o.id}>
                        {o.name} ({o.type}) {isSuperAdmin && o.foundations?.name ? `- ${o.foundations.name}` : ''}
                    </option>
                ))}
            </select>
            {isSuperAdmin && (
                <p className="text-[10px] text-gray-500 mt-1">
                    *Kelompok akan otomatis terdaftar di Yayasan milik Organisasi yang dipilih.
                </p>
            )}
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
      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={`Detail Kelompok: ${selectedGroup?.name || ''}`}>
          <div className="max-h-[60vh] overflow-y-auto">
              {selectedGroup?.description && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700">
                      <span className="font-semibold block mb-1">Deskripsi:</span>
                      {selectedGroup.description}
                  </div>
              )}

              <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                  <Users size={16} /> Anggota Kelompok ({groupMembers.length})
              </h4>
              
              {groupMembers.length > 0 ? (
                  <ul className="space-y-2">
                      {groupMembers.map(m => (
                          <li key={m.id} className="flex justify-between items-center bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                              <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.full_name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.email || m.phone}</p>
                              </div>
                              <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded">
                                  {m.roles?.name || 'Member'}
                              </span>
                          </li>
                      ))}
                  </ul>
              ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                      <Users size={32} className="mx-auto mb-2 opacity-50"/>
                      Belum ada anggota di kelompok ini.
                  </div>
              )}
          </div>
          <div className="mt-6 flex justify-end">
                <button
                    onClick={() => setIsDetailOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                    Tutup
                </button>
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
                  Apakah Anda yakin ingin menghapus kelompok ini?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Anggota di dalam kelompok ini akan kehilangan status kelompok mereka.
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
