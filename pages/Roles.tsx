
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Role, ViewState, Foundation } from '../types';
import { Plus, Edit, Trash2, ShieldCheck, AlertTriangle, CheckSquare, Square, Lock, Globe, Building2, Info, Clock } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface RolesProps {
  data: Role[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

const ALL_PERMISSIONS: {id: ViewState, label: string}[] = [
    { id: 'DASHBOARD', label: 'Dashboard' },
    { id: 'DOCUMENTATION', label: 'Dokumentasi' }, 
    { id: 'EVENTS', label: 'Acara & Absensi' }, // Merged
    { id: 'SCANNER', label: 'Scanner' }, 
    { id: 'FINANCE', label: 'Keuangan' },
    { id: 'EDUCATORS', label: 'Tenaga Pendidik' },
    { id: 'ORGANIZATIONS', label: 'Organisasi' },
    { id: 'GROUPS', label: 'Kelompok' }, 
    { id: 'MEMBERS', label: 'Anggota' },
    { id: 'ROLES', label: 'Role & Akses' },
    { id: 'DIVISIONS', label: 'Bidang / Divisi' },
    { id: 'PROGRAMS', label: 'Program Kerja' },
];

export const Roles: React.FC<RolesProps> = ({ data, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Role | null>(null);
  
  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [requiresServicePeriod, setRequiresServicePeriod] = useState(false); // NEW STATE
  const [loading, setLoading] = useState(false);

  // --- FILTER LOGIC (STRICT PER FOUNDATION) ---
  const filteredData = useMemo(() => {
      // 1. Jika Super Admin Global (Tidak ada yayasan aktif terpilih) -> Tampilkan SEMUA (Global + Semua Yayasan)
      if (isSuperAdmin && !activeFoundation) {
          return data;
      }

      // 2. Jika Konteks Yayasan Aktif (Koordinator atau Super Admin masquerading)
      if (activeFoundation) {
          // Hanya tampilkan role yang dibuat SPESIFIK untuk yayasan ini.
          // Sembunyikan Role Global (foundation_id === null) agar list terlihat "bersih" dan eksklusif.
          return data.filter(r => r.foundation_id === activeFoundation.id);
      }

      // Fallback
      return [];
  }, [data, activeFoundation, isSuperAdmin]);

  const handleOpen = (role?: Role) => {
    if (role) {
      setEditingItem(role);
      setName(role.name);
      setRequiresServicePeriod(role.requires_service_period || false);
      
      if (role.name === 'Super Administration' || role.name === 'Super Admin') {
         setSelectedPermissions(ALL_PERMISSIONS.map(p => p.id));
      } else {
         setSelectedPermissions(role.permissions || []); 
      }
    } else {
      setEditingItem(null);
      setName('');
      setRequiresServicePeriod(false);
      setSelectedPermissions([]);
    }
    setIsModalOpen(true);
  };

  const togglePermission = (permId: string) => {
      // Prevent modifying System Roles
      if (editingItem?.foundation_id === undefined && editingItem?.name === 'Super Administration') return;
      
      setSelectedPermissions(prev => 
        prev.includes(permId) 
            ? prev.filter(p => p !== permId) 
            : [...prev, permId]
      );
  };

  const toggleAllPermissions = () => {
      if (editingItem?.foundation_id === undefined && editingItem?.name === 'Super Administration') return;

      if (selectedPermissions.length === ALL_PERMISSIONS.length) {
          setSelectedPermissions([]);
      } else {
          setSelectedPermissions(ALL_PERMISSIONS.map(p => p.id));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: any = { 
        name,
        permissions: selectedPermissions,
        requires_service_period: requiresServicePeriod
    };

    // Strict Assignment: Jika ada activeFoundation, role HARUS milik yayasan itu.
    if (!editingItem) {
        if (activeFoundation) {
            payload.foundation_id = activeFoundation.id;
        } else if (isSuperAdmin) {
            // Jika Super Admin di mode global membuat role, anggap Global
            payload.foundation_id = null;
        }
    }

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
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <ShieldCheck className="text-primary-600 dark:text-primary-400" /> Manajemen Role & Hak Akses
            </h2>
            {activeFoundation && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Building2 size={12}/> Menampilkan Role khusus untuk <strong>{activeFoundation.name}</strong>
                </p>
            )}
        </div>
        
        {/* Tombol Tambah: Aktif untuk Super Admin ATAU Koordinator Yayasan */}
        {(isSuperAdmin || activeFoundation) && (
            <button
            onClick={() => handleOpen()}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
            <Plus size={18} /> Tambah Role
            </button>
        )}
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Nama Role</th>
              {(!activeFoundation || isSuperAdmin) && <th className="px-6 py-4">Lingkup</th>}
              <th className="px-6 py-4">Wajib Masa Bakti?</th>
              <th className="px-6 py-4">Hak Akses Menu</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {filteredData.map((item) => {
              const isSystemRole = item.name === 'Super Administration';
              // Allow editing if it's the foundation's own role OR if user is Super Admin
              const canEdit = isSuperAdmin || (activeFoundation && item.foundation_id === activeFoundation.id);

              return (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white align-top">
                    {item.name}
                    {isSystemRole && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">System</span>}
                </td>
                
                {/* Kolom Lingkup hanya muncul jika Super Admin / Global view */}
                {(!activeFoundation || isSuperAdmin) && (
                    <td className="px-6 py-4 align-top">
                        {item.foundation_id ? (
                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 px-2 py-1 rounded w-fit">
                                <Building2 size={12} /> {activeFoundation && activeFoundation.id === item.foundation_id ? 'Yayasan Ini' : 'Lokal Yayasan'}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-300 px-2 py-1 rounded w-fit">
                                <Globe size={12} /> Global
                            </span>
                        )}
                    </td>
                )}

                <td className="px-6 py-4 align-top">
                    {item.requires_service_period ? (
                        <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded w-fit border border-orange-100 dark:border-orange-800">
                            <Clock size={12}/> Ya (MT/MS)
                        </span>
                    ) : (
                        <span className="text-xs text-gray-400">-</span>
                    )}
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
                    {canEdit ? (
                       <>
                        <button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Edit">
                            <Edit size={18} />
                        </button>
                        {!isSystemRole && (
                            <button onClick={() => confirmDelete(item.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Hapus">
                                <Trash2 size={18} />
                            </button>
                        )}
                       </>
                    ) : (
                        <span className="text-xs text-gray-400 italic">Read Only</span>
                    )}
                  </div>
                </td>
              </tr>
            )})}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 5 : 4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center">
                      <ShieldCheck size={40} className="text-gray-300 dark:text-gray-600 mb-2"/>
                      <p>Belum ada role khusus untuk yayasan ini.</p>
                      {activeFoundation && (
                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-600 dark:text-blue-300 rounded border border-blue-100 dark:border-blue-800 max-w-md">
                              <p className="font-semibold flex items-center justify-center gap-1"><Info size={12}/> Info:</p>
                              Role "Global" (seperti Member standar) tetap bisa digunakan pada menu Anggota, namun tidak ditampilkan di list ini agar manajemen lebih rapi.
                          </div>
                      )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Modal Form */}
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
              placeholder="Contoh: Guru, Kepala Sekolah, Bendahara"
            />
            {activeFoundation && !editingItem && (
                <p className="text-[10px] text-gray-500 mt-1">Role ini akan dibuat khusus untuk <strong>{activeFoundation.name}</strong>.</p>
            )}
          </div>

          {/* New: Requires Service Period Checkbox */}
          <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800">
              <div 
                onClick={() => setRequiresServicePeriod(!requiresServicePeriod)}
                className="cursor-pointer text-orange-600 dark:text-orange-400"
              >
                  {requiresServicePeriod ? <CheckSquare size={20} /> : <Square size={20} />}
              </div>
              <div>
                  <label onClick={() => setRequiresServicePeriod(!requiresServicePeriod)} className="block text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                      Wajib Isi Masa Bakti?
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                      Aktifkan untuk role penugasan seperti Muballigh Tugas (MT) atau Muballigh Setempat (MS).
                  </p>
              </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Lock size={16} className="text-primary-500" /> Hak Akses Menu
                  </label>
                  {(editingItem?.name !== 'Super Administration') && (
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
                      const isLocked = editingItem?.name === 'Super Administration';
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
              {(editingItem?.name === 'Super Administration') && (
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
