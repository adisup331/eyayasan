import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Role, ViewState } from '../types';
import { Plus, Edit, Trash2, ShieldCheck, AlertTriangle, CheckSquare, Square, Lock, Unlock } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface RolesProps {
  data: Role[];
  onRefresh: () => void;
}

const ALL_PERMISSIONS: {id: ViewState, label: string}[] = [
    { id: 'DASHBOARD', label: 'Dashboard' },
    { id: 'EVENTS', label: 'Acara & Absensi' },
    { id: 'FINANCE', label: 'Keuangan' },
    { id: 'EDUCATORS', label: 'Tenaga Pendidik' },
    { id: 'ORGANIZATIONS', label: 'Organisasi' },
    { id: 'MEMBERS', label: 'Anggota' },
    { id: 'ROLES', label: 'Role & Akses' },
    { id: 'DIVISIONS', label: 'Bidang / Divisi' },
    { id: 'PROGRAMS', label: 'Program Kerja' },
];

export const Roles: React.FC<RolesProps> = ({ data, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Role | null>(null);
  
  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpen = (role?: Role) => {
    if (role) {
      setEditingItem(role);
      setName(role.name);
      
      // LOGIC: Jika Super Admin, otomatis pilih SEMUA permission untuk memastikan akses penuh
      if (role.name === 'Super Administration' || role.name === 'Super Admin') {
         setSelectedPermissions(ALL_PERMISSIONS.map(p => p.id));
      } else {
         setSelectedPermissions(role.permissions || []); 
      }
    } else {
      setEditingItem(null);
      setName('');
      setSelectedPermissions([]);
    }
    setIsModalOpen(true);
  };

  const togglePermission = (permId: string) => {
      // Prevent unchecking permissions for Super Admin
      if (editingItem?.name === 'Super Administration' || editingItem?.name === 'Super Admin') {
          return; 
      }

      setSelectedPermissions(prev => 
        prev.includes(permId) 
            ? prev.filter(p => p !== permId) 
            : [...prev, permId]
      );
  };

  const toggleAllPermissions = () => {
      // Prevent modifying Super Admin
      if (editingItem?.name === 'Super Administration' || editingItem?.name === 'Super Admin') return;

      if (selectedPermissions.length === ALL_PERMISSIONS.length) {
          setSelectedPermissions([]);
      } else {
          setSelectedPermissions(ALL_PERMISSIONS.map(p => p.id));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = { 
        name,
        permissions: selectedPermissions 
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from('roles').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('roles').insert([payload]);
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

  const confirmDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('roles').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <ShieldCheck className="text-primary-600 dark:text-primary-400" /> Manajemen Role & Hak Akses
        </h2>
        <button
          onClick={() => handleOpen()}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <Plus size={18} /> Tambah Role
        </button>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Nama Role</th>
              <th className="px-6 py-4">Hak Akses Menu</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white align-top">
                    {item.name}
                    {item.name === 'Super Administration' && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">System</span>}
                </td>
                <td className="px-6 py-4 align-top">
                    <div className="flex flex-wrap gap-1">
                        {item.permissions && item.permissions.length > 0 ? (
                            item.permissions.map(p => {
                                const label = ALL_PERMISSIONS.find(ap => ap.id === p)?.label || p;
                                return (
                                    <span key={p} className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600">
                                        {label}
                                    </span>
                                )
                            })
                        ) : (
                            <span className="text-xs text-gray-400 italic">Tidak ada akses</span>
                        )}
                    </div>
                </td>
                <td className="px-6 py-4 text-right align-top">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                      <Edit size={18} />
                    </button>
                    {/* Protect Super Admin role */}
                    {item.name !== 'Super Administration' && (
                        <button onClick={() => confirmDelete(item.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                        <Trash2 size={18} />
                        </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Belum ada data role.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Role & Akses' : 'Tambah Role Baru'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Role</label>
            <input
              type="text"
              required
              readOnly={editingItem?.name === 'Super Administration'}
              value={name}
              onChange={e => setName(e.target.value)}
              className={`mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none ${editingItem?.name === 'Super Administration' ? 'opacity-70 cursor-not-allowed' : ''}`}
              placeholder="Contoh: Guru, Kepala Sekolah"
            />
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Lock size={16} className="text-primary-500" /> Hak Akses Menu
                  </label>
                  {(editingItem?.name !== 'Super Administration' && editingItem?.name !== 'Super Admin') && (
                    <button 
                        type="button"
                        onClick={toggleAllPermissions}
                        className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                    >
                        {selectedPermissions.length === ALL_PERMISSIONS.length ? 'Hapus Semua' : 'Pilih Semua'}
                    </button>
                  )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map((perm) => {
                      const isChecked = selectedPermissions.includes(perm.id);
                      const isLocked = editingItem?.name === 'Super Administration' || editingItem?.name === 'Super Admin';
                      return (
                          <div 
                            key={perm.id}
                            onClick={() => togglePermission(perm.id)}
                            className={`flex items-center gap-2 p-2 rounded transition border ${
                                isChecked 
                                ? 'bg-primary-50 border-primary-200 dark:bg-primary-900/30 dark:border-primary-800' 
                                : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            } ${isLocked ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                          >
                              <div className={`text-primary-600 dark:text-primary-400`}>
                                  {isChecked ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-400" />}
                              </div>
                              <span className={`text-sm ${isChecked ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {perm.label}
                              </span>
                          </div>
                      )
                  })}
              </div>
              {(editingItem?.name === 'Super Administration' || editingItem?.name === 'Super Admin') && (
                  <p className="text-[10px] text-gray-500 mt-2 italic">* Akses Super Admin dikunci pada "Semua Akses".</p>
              )}
          </div>

          <div className="pt-2 flex justify-end gap-3">
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
                  Apakah Anda yakin ingin menghapus role ini?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Anggota yang memiliki role ini akan kehilangan role mereka di sistem.
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