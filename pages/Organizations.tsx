
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Organization, Member, Role, Foundation, Group } from '../types';
import { Plus, Edit, Trash2, Building2, AlertTriangle, GraduationCap, Users, UserPlus, X, Save, School, BookOpen, Calendar, MapPin, User, Phone, Boxes, Clock } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface OrganizationsProps {
  data: Organization[];
  members: Member[];
  roles: Role[];
  groups: Group[]; // Added Groups
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

export const Organizations: React.FC<OrganizationsProps> = ({ data, members, roles, groups, onRefresh, activeFoundation, isSuperAdmin }) => {
  // Org CRUD State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Organization | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'General' | 'Education' | 'TPQ'>('General');
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
  // New Fields
  const [eduGender, setEduGender] = useState<'L' | 'P' | ''>('');
  const [eduOrigin, setEduOrigin] = useState('');
  const [eduBirthDate, setEduBirthDate] = useState('');
  const [eduGroupId, setEduGroupId] = useState(''); // New: Kelompok

  // Service Period Logic (Date Range)
  const [eduServiceStart, setEduServiceStart] = useState(''); // Start Date
  const [eduServiceDuration, setEduServiceDuration] = useState<number>(1); // Duration in Years (0 = Lifetime)

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
    
    const payload: any = { name, description, type };
    if (!editingItem && activeFoundation) {
        payload.foundation_id = activeFoundation.id;
    }

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

  // Filter groups for the selected organization
  const currentOrgGroups = useMemo(() => {
      if (!educatorModal.org) return [];
      return groups.filter(g => g.organization_id === educatorModal.org!.id);
  }, [groups, educatorModal.org]);

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
          setEduGender(member.gender || '');
          setEduOrigin(member.origin || '');
          setEduBirthDate(member.birth_date || '');
          setEduGroupId(member.group_id || ''); // Set Group
          
          setEduServiceStart(new Date().toISOString().split('T')[0]); 
          // Reset duration, user needs to re-select if updating period
          setEduServiceDuration(1); 
      } else {
          setEditingEducator(null);
          setEduName('');
          setEduEmail('');
          setEduPhone('');
          setEduRoleId('');
          setEduGender('');
          setEduOrigin('');
          setEduBirthDate('');
          setEduGroupId('');
          setEduServiceStart(new Date().toISOString().split('T')[0]);
          setEduServiceDuration(1);
      }
      setEducatorView('FORM');
  };

  const handleEducatorSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!educatorModal.org) return;

      // VALIDATION: Mandatory Group for TPQ
      if (educatorModal.org.type === 'TPQ' && !eduGroupId) {
          alert("Untuk TPQ, Tenaga Pendidik WAJIB memilih Kelompok.");
          return;
      }

      setEduLoading(true);

      // Calculate Service Period String & End Date
      let servicePeriodString = null;
      let serviceEndDateIso = null;

      if (educatorModal.org.type === 'TPQ' && eduServiceStart) {
          const startDate = new Date(eduServiceStart);
          const formatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
          const startStr = formatter.format(startDate);

          if (eduServiceDuration === 0) {
              // Lifetime
              servicePeriodString = `${startStr} - Seumur Hidup`;
              serviceEndDateIso = null; // No Expiry
          } else {
              // Specific Duration
              const endDate = new Date(startDate);
              endDate.setFullYear(startDate.getFullYear() + eduServiceDuration);
              
              servicePeriodString = `${startStr} - ${formatter.format(endDate)}`;
              serviceEndDateIso = endDate.toISOString();
          }
      }

      const payload: any = {
          full_name: eduName,
          email: eduEmail,
          phone: eduPhone,
          role_id: eduRoleId || null,
          organization_id: educatorModal.org.id, 
          division_id: null,
          gender: eduGender || null,
          origin: eduOrigin || null,
          birth_date: eduBirthDate || null,
          group_id: eduGroupId || null, // Save Group ID
          service_period: servicePeriodString, 
          service_end_date: serviceEndDateIso 
      };

      if (!editingEducator && activeFoundation) {
          payload.foundation_id = activeFoundation.id;
      }

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

  const getTypeIcon = (t: string) => {
      if (t === 'Education') return <School size={20} />;
      if (t === 'TPQ') return <BookOpen size={20} />;
      return <Building2 size={20} />;
  }

  const getTypeColor = (t: string) => {
      if (t === 'Education') return 'bg-blue-50 text-blue-600 border-blue-100';
      if (t === 'TPQ') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      return 'bg-orange-50 text-orange-600 border-orange-100';
  }


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Building2 className="text-primary-600 dark:text-primary-400" /> Manajemen Organisasi
        </h2>
        {!isSuperAdmin && (
            <button
            onClick={() => handleOpen()}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
            <Plus size={18} /> Tambah Organisasi
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((item) => {
           const educatorCount = members.filter(m => m.organization_id === item.id).length;
           const isEducational = item.type === 'Education' || item.type === 'TPQ';
           
           return (
            <div key={item.id} className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition flex flex-col relative overflow-hidden">
                {isEducational && (
                    <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-[10px] font-bold uppercase flex items-center gap-1 ${
                        item.type === 'TPQ' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    }`}>
                        {item.type === 'TPQ' ? <BookOpen size={12}/> : <School size={12} />} {item.type}
                    </div>
                )}

                <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg border ${getTypeColor(item.type)} dark:bg-opacity-20`}>
                        {getTypeIcon(item.type)}
                    </div>
                    {!isSuperAdmin && (
                        <div className="flex gap-2 mt-6 sm:mt-0">
                            <button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                            <Edit size={18} />
                            </button>
                            <button onClick={() => confirmDelete(item.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                            <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                </div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-4 flex-1">
                {item.description || 'Tidak ada deskripsi.'}
                </p>
                
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border flex justify-between items-center h-10">
                    {/* HANYA TAMPILKAN TOMBOL KELOLA PENDIDIK JIKA TIPE PENDIDIKAN / TPQ */}
                    {isEducational ? (
                        <>
                             <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Users size={14} /> {educatorCount} {item.type === 'TPQ' ? 'Ustadz/Ustadzah' : 'Guru'}
                            </div>
                            {!isSuperAdmin && (
                                <button 
                                    onClick={() => openEducatorManager(item)}
                                    className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-primary-100 transition"
                                >
                                    <GraduationCap size={14} /> Kelola Pendidik
                                </button>
                            )}
                        </>
                    ) : (
                        <span className="text-xs text-gray-400 italic">Organisasi Umum / Non-Pendidikan</span>
                    )}
                </div>
            </div>
        )})}
        {data.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
            Belum ada organisasi yang dibuat{activeFoundation ? ` untuk ${activeFoundation.name}` : ''}.
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
            <div className="grid grid-cols-3 gap-3 mt-1">
                <div 
                    onClick={() => setType('Education')}
                    className={`cursor-pointer border rounded-lg p-2 flex flex-col items-center gap-1 transition ${type === 'Education' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20' : 'bg-white border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700'}`}
                >
                    <School size={20} />
                    <span className="text-[10px] font-bold text-center">Sekolah Formal</span>
                </div>
                <div 
                    onClick={() => setType('TPQ')}
                    className={`cursor-pointer border rounded-lg p-2 flex flex-col items-center gap-1 transition ${type === 'TPQ' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/20' : 'bg-white border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700'}`}
                >
                    <BookOpen size={20} />
                    <span className="text-[10px] font-bold text-center">TPQ / Non-Formal</span>
                </div>
                <div 
                    onClick={() => setType('General')}
                    className={`cursor-pointer border rounded-lg p-2 flex flex-col items-center gap-1 transition ${type === 'General' ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900/20' : 'bg-white border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700'}`}
                >
                    <Building2 size={20} />
                    <span className="text-[10px] font-bold text-center">Umum / Lainnya</span>
                </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
                *Pilih "Sekolah" atau "TPQ" untuk mengaktifkan fitur Tenaga Pendidik.
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">Daftar {educatorModal.org?.type === 'TPQ' ? 'ustadz/ustadzah' : 'guru'} di organisasi ini.</p>
                    <button 
                        onClick={() => openEducatorForm()}
                        className="bg-primary-600 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-700 transition"
                    >
                        <UserPlus size={14} /> Tambah Data
                    </button>
                </div>
                
                <div className="max-h-[50vh] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Nama</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Kelompok</th>
                                <th className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border text-sm">
                            {currentOrgEducators.map(m => {
                                const groupName = groups.find(g => g.id === m.group_id)?.name;
                                return (
                                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900 dark:text-white">{m.full_name}</div>
                                        <div className="text-xs text-gray-500">{m.phone || m.email}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-xs">
                                            {m.roles?.name || '-'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {groupName ? (
                                            <span className="flex items-center gap-1 text-xs text-pink-600 bg-pink-50 dark:bg-pink-900/20 px-2 py-0.5 rounded">
                                                <Boxes size={10} /> {groupName}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEducatorForm(m)} className="text-blue-500 hover:text-blue-700"><Edit size={16}/></button>
                                            <button onClick={() => deleteEducator(m.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                            {currentOrgEducators.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-gray-500 italic">Belum ada data tenaga pendidik.</td>
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                        <div className="relative">
                            <User size={14} className="absolute left-3 top-2.5 text-gray-400"/>
                            <input type="text" required value={eduName} onChange={e => setEduName(e.target.value)} 
                                className="w-full pl-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Kelamin</label>
                        <select 
                            value={eduGender} 
                            onChange={e => setEduGender(e.target.value as 'L'|'P')}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none"
                        >
                            <option value="">Pilih Gender</option>
                            <option value="L">Laki-laki</option>
                            <option value="P">Perempuan</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Asal / Domisili</label>
                        <div className="relative">
                            <MapPin size={14} className="absolute left-3 top-2.5 text-gray-400"/>
                            <input type="text" value={eduOrigin} onChange={e => setEduOrigin(e.target.value)} 
                                className="w-full pl-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Lahir</label>
                        <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-2.5 text-gray-400"/>
                            <input type="date" value={eduBirthDate} onChange={e => setEduBirthDate(e.target.value)} 
                                className="w-full pl-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">No. Handphone (WA)</label>
                        <div className="relative">
                            <Phone size={14} className="absolute left-3 top-2.5 text-gray-400"/>
                            <input type="text" value={eduPhone} onChange={e => setEduPhone(e.target.value)} 
                                className="w-full pl-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none" placeholder="08..." />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <input type="email" required value={eduEmail} onChange={e => setEduEmail(e.target.value)} 
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
                    </div>
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
                
                {/* NEW: Kelompok Selection */}
                <div>
                     <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                         Kelompok {educatorModal.org?.type === 'TPQ' && <span className="text-red-500">* (Wajib untuk TPQ)</span>}
                     </label>
                     <div className="relative">
                         <Boxes size={14} className="absolute left-3 top-2.5 text-gray-400"/>
                         <select 
                            value={eduGroupId} 
                            onChange={e => setEduGroupId(e.target.value)}
                            required={educatorModal.org?.type === 'TPQ'} // HTML validation
                            className={`w-full pl-9 rounded-md border bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:ring-primary-500 outline-none ${
                                educatorModal.org?.type === 'TPQ' && !eduGroupId ? 'border-red-300 focus:border-red-500' : 'border-gray-300 dark:border-gray-600'
                            }`}
                         >
                             <option value="">Pilih Kelompok</option>
                             {currentOrgGroups.map(g => (
                                 <option key={g.id} value={g.id}>{g.name}</option>
                             ))}
                         </select>
                     </div>
                     {currentOrgGroups.length === 0 && (
                         <p className="text-[10px] text-orange-500 mt-1">Belum ada kelompok di organisasi ini. Buat di menu Kelompok.</p>
                     )}
                </div>


                {/* FEATURE: MASA BAKTI (ONLY FOR TPQ) - UPDATED DATE RANGE */}
                {educatorModal.org?.type === 'TPQ' && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                        <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-2">Masa Bakti (TPQ)</label>
                        
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                                <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Tanggal Mulai</label>
                                <input 
                                    type="date" 
                                    value={eduServiceStart} 
                                    onChange={e => setEduServiceStart(e.target.value)} 
                                    className="w-full rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 dark:text-white px-2 py-1.5 text-sm focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Durasi</label>
                                <select
                                    value={eduServiceDuration}
                                    onChange={e => setEduServiceDuration(Number(e.target.value))}
                                    className="w-full rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 dark:text-white px-2 py-1.5 text-sm focus:ring-emerald-500 outline-none"
                                >
                                    <option value={1}>1 Tahun</option>
                                    <option value={2}>2 Tahun</option>
                                    <option value={3}>3 Tahun</option>
                                    <option value={0}>Seumur Hidup</option> {/* NEW OPTION */}
                                </select>
                            </div>
                        </div>
                        
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 italic">
                            {eduServiceDuration === 0 
                                ? "*Masa bakti 'Seumur Hidup' tidak akan expired."
                                : "*Format akan disimpan otomatis: dd MMMM yyyy - dd MMMM yyyy"
                            }
                        </p>
                    </div>
                )}

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
