
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Member, Role, Division, Organization, Foundation } from '../types';
import { Plus, Edit, Trash2, Users, AlertTriangle, Globe } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface MembersProps {
  data: Member[];
  roles: Role[];
  divisions: Division[];
  organizations: Organization[];
  foundations: Foundation[];
  onRefresh: () => void;
  currentUserEmail?: string;
  isSuperAdmin?: boolean;
}

export const Members: React.FC<MembersProps> = ({ 
    data, roles, divisions, organizations, foundations, 
    onRefresh, currentUserEmail, isSuperAdmin 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Member | null>(null);
  
  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, member: Member | null}>({ isOpen: false, member: null });

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [foundationId, setFoundationId] = useState(''); // New State for Super Admin
  const [loading, setLoading] = useState(false);

  // Filter Logic:
  // If Super Admin: Show All.
  // If Regular Admin: Show only members in their foundation.
  const filteredData = useMemo(() => {
      if (isSuperAdmin) return data;
      
      // Get current user foundation
      const currentUser = data.find(m => m.email === currentUserEmail);
      if (!currentUser?.foundation_id) return []; // Should not happen for valid admin
      
      return data.filter(m => m.foundation_id === currentUser.foundation_id);
  }, [data, isSuperAdmin, currentUserEmail]);

  const handleOpen = (member?: Member) => {
    if (member) {
      setEditingItem(member);
      setFullName(member.full_name);
      setEmail(member.email);
      setPhone(member.phone || '');
      setRoleId(member.role_id || '');
      setDivisionId(member.division_id || '');
      setOrganizationId(member.organization_id || '');
      setFoundationId(member.foundation_id || '');
    } else {
      setEditingItem(null);
      setFullName('');
      setEmail('');
      setPhone('');
      setRoleId('');
      setDivisionId('');
      setOrganizationId('');
      
      // If not super admin, auto-set foundation id based on current user
      if (!isSuperAdmin && currentUserEmail) {
          const me = data.find(m => m.email === currentUserEmail);
          setFoundationId(me?.foundation_id || '');
      } else {
          setFoundationId('');
      }
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      full_name: fullName,
      email,
      phone,
      role_id: roleId || null,
      division_id: divisionId || null,
      organization_id: organizationId || null,
      foundation_id: foundationId || null // Ensure this is saved
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from('members').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('members').insert([payload]);
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

  const confirmDelete = (member: Member) => {
    // PROTEKSI AKUN
    if (member.email === 'super@yayasan.org') {
        alert("Akun Super Admin Utama tidak dapat dihapus!");
        return;
    }
    if (currentUserEmail && member.email === currentUserEmail) {
        alert("Anda tidak dapat menghapus akun yang sedang Anda gunakan login.");
        return;
    }
    setDeleteConfirm({ isOpen: true, member });
  };

  const executeDelete = async () => {
    if (!deleteConfirm.member) return;
    try {
      const { error } = await supabase.from('members').delete().eq('id', deleteConfirm.member.id);
      if (error) throw error;
      onRefresh();
      setDeleteConfirm({ isOpen: false, member: null });
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Users className="text-primary-600 dark:text-primary-400" /> Manajemen Anggota
        </h2>
        <button
          onClick={() => handleOpen()}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <Plus size={18} /> Tambah Anggota
        </button>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold">
                <tr>
                <th className="px-6 py-4">Nama & Organisasi</th>
                {isSuperAdmin && <th className="px-6 py-4">Yayasan</th>}
                <th className="px-6 py-4">Kontak</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Bidang</th>
                <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{item.full_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {organizations.find(o => o.id === item.organization_id)?.name || 'Tanpa Organisasi'}
                        </div>
                    </td>
                    {isSuperAdmin && (
                         <td className="px-6 py-4">
                             {item.foundations ? (
                                 <span className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded">
                                     <Globe size={12} /> {item.foundations.name}
                                 </span>
                             ) : (
                                 <span className="text-xs text-gray-400 italic">Global / Super Admin</span>
                             )}
                         </td>
                    )}
                    <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-200">{item.email}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 py-1 px-2 rounded-full text-xs font-medium">
                        {roles.find(r => r.id === item.role_id)?.name || '-'}
                    </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {divisions.find(d => d.id === item.division_id)?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                        <Edit size={18} />
                        </button>
                        <button onClick={() => confirmDelete(item)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                        <Trash2 size={18} />
                        </button>
                    </div>
                    </td>
                </tr>
                ))}
                {filteredData.length === 0 && (
                <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Belum ada data anggota.
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Anggota' : 'Tambah Anggota'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">No. Telepon</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* SUPER ADMIN ONLY: Foundation Selector */}
          {isSuperAdmin && (
             <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
                <label className="block text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-1 flex items-center gap-1">
                   <Globe size={14}/> Penugasan Yayasan (Koordinator)
                </label>
                <select
                  value={foundationId}
                  onChange={e => setFoundationId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none text-sm"
                >
                  <option value="">-- Global / Super Admin (Tidak Terikat) --</option>
                  {foundations.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">
                   *Pilih yayasan untuk menjadikan anggota ini Admin/Staff di yayasan tersebut. Kosongkan untuk staff global.
                </p>
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
              <select
                value={roleId}
                onChange={e => setRoleId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
              >
                <option value="">Pilih Role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organisasi</label>
              <select
                value={organizationId}
                onChange={e => setOrganizationId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
              >
                <option value="">Pilih Organisasi</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bidang (Divisi)</label>
              <select
                value={divisionId}
                onChange={e => setDivisionId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
              >
                <option value="">Pilih Bidang</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
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

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <Modal 
        isOpen={deleteConfirm.isOpen} 
        onClose={() => setDeleteConfirm({isOpen: false, member: null})} 
        title="Konfirmasi Hapus"
      >
        <div className="text-center sm:text-left">
          <div className="flex flex-col items-center gap-4 mb-4">
             <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
               <AlertTriangle size={32} />
             </div>
             <div>
                <p className="text-gray-700 dark:text-gray-300">
                  Apakah Anda yakin ingin menghapus anggota <strong>{deleteConfirm.member?.full_name}</strong>?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Akun ini tidak akan bisa mengakses sistem lagi.
                </p>
             </div>
          </div>
          <div className="flex justify-center sm:justify-end gap-3 mt-6">
            <button
              onClick={() => setDeleteConfirm({isOpen: false, member: null})}
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
