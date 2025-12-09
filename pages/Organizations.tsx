import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Organization, Member, Role } from '../types';
import { Plus, Edit, Trash2, Building2, AlertTriangle, GraduationCap, Users, UserPlus, X, Save, School } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface OrganizationsProps {
  data: Organization[];
  members: Member[];
  roles: Role[];
  onRefresh: () => void;
}

export const Organizations: React.FC<OrganizationsProps> = ({ data, members, roles, onRefresh }) => {
  // Org CRUD State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Organization | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'General' | 'Education'>('General');
  const [loading, setLoading] = useState(false);

  // Educator Management State
  const [educatorModal, setEducatorModal] = useState<{isOpen: boolean, org: Organization | null}>({ isOpen: false, org: null });
  const [educatorView, setEducatorView] = useState<'LIST' | 'FORM'>('LIST');
  const [editingEducator, setEditingEducator] = useState<Member | null>(null);
  
  // Educator Form State
  const [eduName, setEduName] = useState('');
  const [eduEmail, setEduEmail] = useState('');
  const [eduPhone, setEduPhone] = useState('');
  const [eduRoleId, setEduRoleId] = useState('');
  const [eduLoading, setEduLoading] = useState(false);

  // --- ORG CRUD HANDLERS ---
  const handleOpen = (org?: Organization) => {
    if (org) {
      setEditingItem(org);
      setName(org.name);
      setDescription(org.description || '');
      setType(org.type || 'General');
    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
      setType('General');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { name, description, type };
    try {
      if (editingItem) {
        const { error } = await supabase.from('organizations').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('organizations').insert([payload]);
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
      const { error } = await supabase.from('organizations').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  // --- EDUCATOR CRUD HANDLERS ---
  
  const currentOrgEducators = useMemo(() => {
      if (!educatorModal.org) return [];
      return members.filter(m => m.organization_id === educatorModal.org!.id);
  }, [members, educatorModal.org]);

  const openEducatorManager = (org: Organization) => {
      setEducatorModal({ isOpen: true, org });
      setEducatorView('LIST');
  };

  const openEducatorForm = (member?: Member) => {
      if (member) {
          setEditingEducator(member);
          setEduName(member.full_name);
          setEduEmail(member.email);
          setEduPhone(member.phone || '');
          setEduRoleId(member.role_id || '');
      } else {
          setEditingEducator(null);
          setEduName('');
          setEduEmail('');
          setEduPhone('');
          setEduRoleId('');
      }
      setEducatorView('FORM');
  };

  const handleEducatorSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!educatorModal.org) return;
      setEduLoading(true);

      const payload = {
          full_name: eduName,
          email: eduEmail,
          phone: eduPhone,
          role_id: eduRoleId || null,
          organization_id: educatorModal.org.id, 
          division_id: null
      };

      try {
          if (editingEducator) {
              const { error } = await supabase.from('members').update(payload).eq('id', editingEducator.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('members').insert([payload]);
              if (error) throw error;
          }
          onRefresh();
          setEducatorView('LIST');
      } catch (error: any) {
          alert("Gagal menyimpan data pendidik: " + error.message);
      } finally {
          setEduLoading(false);
      }
  };

  const deleteEducator = async (id: string) => {
      if (!confirm("Yakin ingin menghapus data pendidik ini? Data akan hilang permanen.")) return;
      try {
          const { error } = await supabase.from('members').delete().eq('id', id);
          if (error) throw error;
          onRefresh();
      } catch (error: any) {
          alert("Gagal menghapus: " + error.message);
      }
  }


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Building2 className="text-primary-600 dark:text-primary-400" /> Manajemen Organisasi
        </h2>
        <button
          onClick={() => handleOpen()}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <Plus size={18} /> Tambah Organisasi
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((item) => {
           const educatorCount = members.filter(m => m.organization_id === item.id).length;
           const isEducation = item.type === 'Education';
           
           return (
            <div key={item.id} className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition flex flex-col relative overflow-hidden">
                {isEducation && (
                    <div className="absolute top-0 right-0 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-bl-lg text-[10px] font-bold uppercase flex items-center gap-1">
                        <School size={12} /> Pendidikan
                    </div>
                )}

                <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg ${isEducation ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'} dark:bg-opacity-20`}>
                        {isEducation ? <School size={20} /> : <Building2 size={20} />}
                    </div>
                    <div className="flex gap-2 mt-6 sm:mt-0">
                        <button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                        <Edit size={18} />
                        </button>
                        <button onClick={() => confirmDelete(item.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                        <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-4 flex-1">
                {item.description || 'Tidak ada deskripsi.'}
                </p>
                
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border flex justify-between items-center h-10">
                    {/* HANYA TAMPILKAN TOMBOL KELOLA PENDIDIK JIKA TIPE PENDIDIKAN */}
                    {isEducation ? (
                        <>
                             <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Users size={14} /> {educatorCount} Guru
                            </div>
                            <button 
                                onClick={() => openEducatorManager(item)}
                                className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-primary-100 transition"
                            >
                                <GraduationCap size={14} /> Kelola Pendidik
                            </button>
                        </>
                    ) : (
                        <span className="text-xs text-gray-400 italic">Organisasi Umum / Non-Pendidikan</span>
                    )}
                </div>
            </div>
        )})}
        {data.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
            Belum ada organisasi yang dibuat.
          </div>
        )}
      </div>

      {/* --- MODAL EDIT ORGANISASI --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Organisasi' : 'Tambah Organisasi'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Organisasi</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
              placeholder="Contoh: SD IT Yayasan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipe Organisasi</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
                <div 
                    onClick={() => setType('Education')}
                    className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 transition ${type === 'Education' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20' : 'bg-white border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700'}`}
                >
                    <School size={24} />
                    <span className="text-xs font-bold">Pendidikan</span>
                </div>
                <div 
                    onClick={() => setType('General')}
                    className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 transition ${type === 'General' ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900/20' : 'bg-white border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700'}`}
                >
                    <Building2 size={24} />
                    <span className="text-xs font-bold">Umum / Lainnya</span>
                </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
                *Pilih "Pendidikan" untuk mengaktifkan fitur Tenaga Pendidik.
            </p>
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

      {/* --- MODAL MANAGEMENT EDUCATOR --- */}
      <Modal 
        isOpen={educatorModal.isOpen} 
        onClose={() => setEducatorModal({isOpen: false, org: null})} 
        title={`Manajemen Pendidik: ${educatorModal.org?.name || ''}`}
      >
        {educatorView === 'LIST' ? (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Daftar guru dan staf di organisasi ini.</p>
                    <button 
                        onClick={() => openEducatorForm()}
                        className="bg-primary-600 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-700 transition"
                    >
                        <UserPlus size={14} /> Tambah Guru
                    </button>
                </div>
                
                <div className="max-h-[50vh] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Nama</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border text-sm">
                            {currentOrgEducators.map(m => (
                                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900 dark:text-white">{m.full_name}</div>
                                        <div className="text-xs text-gray-500">{m.email}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-xs">
                                            {m.roles?.name || '-'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEducatorForm(m)} className="text-blue-500 hover:text-blue-700"><Edit size={16}/></button>
                                            <button onClick={() => deleteEducator(m.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {currentOrgEducators.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-6 text-center text-gray-500 italic">Belum ada data tenaga pendidik.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end">
                     <button
                        onClick={() => setEducatorModal({isOpen: false, org: null})}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1"
                     >
                        Tutup
                     </button>
                </div>
            </div>
        ) : (
            // FORM VIEW
            <form onSubmit={handleEducatorSubmit} className="space-y-4 animate-in slide-in-from-right-10 duration-200">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                        {editingEducator ? 'Edit Pendidik' : 'Tambah Pendidik Baru'}
                    </h4>
                    <button 
                        type="button" 
                        onClick={() => setEducatorView('LIST')}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X size={16} />
                    </button>
                </div>
                
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                    <input type="text" required value={eduName} onChange={e => setEduName(e.target.value)} 
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input type="email" required value={eduEmail} onChange={e => setEduEmail(e.target.value)} 
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">No. Telepon</label>
                    <input type="text" value={eduPhone} onChange={e => setEduPhone(e.target.value)} 
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Role / Jabatan</label>
                    <select required value={eduRoleId} onChange={e => setEduRoleId(e.target.value)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none"
                    >
                        <option value="">Pilih Role</option>
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setEducatorView('LIST')} className="px-3 py-2 text-sm border rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300">Kembali</button>
                    <button type="submit" disabled={eduLoading} className="px-3 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1">
                        <Save size={14} /> {eduLoading ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </div>
            </form>
        )}
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
                  Apakah Anda yakin ingin menghapus organisasi ini?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Anggota dan program yang terkait akan kehilangan status organisasi mereka.
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