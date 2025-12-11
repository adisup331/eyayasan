
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Member, Role, Division, Organization, Foundation } from '../types';
import { Plus, Edit, Trash2, Users, AlertTriangle, Globe, Key, Info, CheckCircle2, XCircle, Calendar, Clock, QrCode, Printer } from '../components/ui/Icons';
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
  activeFoundation?: Foundation | null; // Added prop
}

export const Members: React.FC<MembersProps> = ({ 
    data, roles, divisions, organizations, foundations, 
    onRefresh, currentUserEmail, isSuperAdmin, activeFoundation 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Member | null>(null);
  
  // QR Code Modal State
  const [qrModal, setQrModal] = useState<{isOpen: boolean, member: Member | null}>({isOpen: false, member: null});

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, member: Member | null}>({ isOpen: false, member: null });

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [foundationId, setFoundationId] = useState(''); 
  const [status, setStatus] = useState<'Active'|'Inactive'>('Active'); 
  
  // MT/MS Specific State
  const [serviceStart, setServiceStart] = useState('');
  const [serviceDuration, setServiceDuration] = useState<number>(1);
  
  const [loading, setLoading] = useState(false);

  // Filter Logic:
  const filteredData = useMemo(() => {
      if (isSuperAdmin) return data;
      return data;
  }, [data, isSuperAdmin]);

  // Check if selected role requires service period
  // Changed logic to check role property instead of string matching
  const requiresServicePeriod = useMemo(() => {
      if (!roleId) return false;
      const r = roles.find(role => role.id === roleId);
      return r?.requires_service_period || false;
  }, [roleId, roles]);

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
      setStatus(member.status || 'Active');
      // Set default service start to today if editing, purely for UI if they want to update it
      setServiceStart(new Date().toISOString().split('T')[0]);
      setServiceDuration(1);
    } else {
      setEditingItem(null);
      setFullName('');
      setEmail('');
      setPhone('');
      setRoleId('');
      setDivisionId('');
      setOrganizationId('');
      setFoundationId(''); 
      setStatus('Active');
      setServiceStart(new Date().toISOString().split('T')[0]);
      setServiceDuration(1);
    }
    setIsModalOpen(true);
  };

  const handleShowQr = (member: Member) => {
      setQrModal({isOpen: true, member});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Logic Masa Bakti for MT/MS (or any role requiring it)
    let servicePeriodString = editingItem?.service_period || null;
    let serviceEndDateIso = editingItem?.service_end_date || null;

    if (requiresServicePeriod) {
        if (!serviceStart) {
            alert("Untuk role ini, Tanggal Mulai Penugasan wajib diisi.");
            setLoading(false);
            return;
        }

        const startDate = new Date(serviceStart);
        const formatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const startStr = formatter.format(startDate);

        const endDate = new Date(startDate);
        endDate.setFullYear(startDate.getFullYear() + serviceDuration);
        
        servicePeriodString = `${startStr} - ${formatter.format(endDate)}`;
        serviceEndDateIso = endDate.toISOString();
    }

    const payload: any = {
      full_name: fullName,
      email,
      phone,
      role_id: roleId || null,
      division_id: divisionId || null,
      organization_id: organizationId || null,
      status: status,
      service_period: servicePeriodString,
      service_end_date: serviceEndDateIso
    };

    // STRICT ISOLATION LOGIC
    if (isSuperAdmin) {
        payload.foundation_id = foundationId || null;
    } else if (activeFoundation) {
        payload.foundation_id = activeFoundation.id;
    }

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Users className="text-primary-600 dark:text-primary-400" /> 
            {isSuperAdmin ? 'Manajemen Koordinator & Akses' : 'Manajemen Anggota & Staff'}
            </h2>
            {isSuperAdmin && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <Info size={12} /> Tambahkan Koordinator di sini dan tetapkan Yayasan mereka.
                </p>
            )}
        </div>
        <button
          onClick={() => handleOpen()}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <Plus size={18} /> {isSuperAdmin ? 'Tambah Koordinator' : 'Tambah Anggota'}
        </button>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold">
                <tr>
                <th className="px-6 py-4">Nama & Organisasi</th>
                {isSuperAdmin && <th className="px-6 py-4">Yayasan (Akses)</th>}
                <th className="px-6 py-4">Kontak (Login)</th>
                <th className="px-6 py-4">Role / Status</th>
                <th className="px-6 py-4">Bidang</th>
                <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {filteredData.map((item) => {
                    const roleName = roles.find(r => r.id === item.role_id)?.name || '-';
                    
                    return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                        <td className="px-6 py-4">
                            <div className={`font-medium ${item.status === 'Inactive' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{item.full_name}</div>
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
                        <div className="text-sm text-gray-900 dark:text-gray-200 flex items-center gap-1">
                            {item.email}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.phone}</div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                            <div className="flex flex-col gap-1 items-start">
                                <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 py-0.5 px-2 rounded-full text-[10px] font-medium">
                                    {roleName}
                                </span>
                                {item.status === 'Inactive' && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full border border-red-100 dark:border-red-900">
                                        <XCircle size={10} /> Non-Aktif
                                    </span>
                                )}
                                {item.service_period && (
                                    <span className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-900/50">
                                        <Clock size={10} /> {item.service_period}
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {divisions.find(d => d.id === item.division_id)?.name || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => handleShowQr(item)} className="text-gray-400 hover:text-green-600 dark:hover:text-green-400" title="Lihat Kartu/QR">
                                <QrCode size={18} />
                            </button>
                            <button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Edit">
                                <Edit size={18} />
                            </button>
                            <button onClick={() => confirmDelete(item)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Hapus">
                                <Trash2 size={18} />
                            </button>
                        </div>
                        </td>
                    </tr>
                )})}
                {filteredData.length === 0 && (
                <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Belum ada data {isSuperAdmin ? 'koordinator' : 'anggota'}.
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Data' : (isSuperAdmin ? 'Tambah Koordinator' : 'Tambah Anggota')}>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email (Untuk Login)</label>
            <div className="relative">
                <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
                />
                <Key size={14} className="absolute right-3 top-3.5 text-gray-400" />
            </div>
            {!editingItem && (
                <p className="text-[10px] text-gray-500 mt-1">
                    *User dapat melakukan "Aktivasi Akun" menggunakan email ini di halaman login.
                </p>
            )}
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
                   *Wajib pilih yayasan agar Koordinator bisa mengelola datanya.
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
                {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name} {r.foundation_id ? '(Lokal)' : '(Global)'}</option>
                ))}
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status Keaktifan</label>
                <div className="mt-1 flex gap-2">
                    <button 
                        type="button"
                        onClick={() => setStatus('Active')}
                        className={`flex-1 py-2 px-3 rounded-md border text-sm flex items-center justify-center gap-1 transition ${status === 'Active' ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30' : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600'}`}
                    >
                        <CheckCircle2 size={14}/> Aktif
                    </button>
                    <button 
                        type="button"
                        onClick={() => setStatus('Inactive')}
                        className={`flex-1 py-2 px-3 rounded-md border text-sm flex items-center justify-center gap-1 transition ${status === 'Inactive' ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30' : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600'}`}
                    >
                        <XCircle size={14}/> Non-Aktif
                    </button>
                </div>
            </div>
          </div>

          {/* MASA BAKTI (CONDITIONAL BASED ON ROLE CONFIG) */}
          {requiresServicePeriod && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-bold text-orange-800 dark:text-orange-400 mb-2 flex items-center gap-1">
                      <Clock size={14}/> Masa Bakti / Penugasan (Wajib)
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                          <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Tanggal Mulai</label>
                          <input 
                              type="date" 
                              required
                              value={serviceStart} 
                              onChange={e => setServiceStart(e.target.value)} 
                              className="w-full rounded-md border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 dark:text-white px-2 py-1.5 text-sm focus:ring-orange-500 outline-none"
                          />
                      </div>
                      <div>
                          <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Durasi</label>
                          <select
                              value={serviceDuration}
                              onChange={e => setServiceDuration(Number(e.target.value))}
                              className="w-full rounded-md border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 dark:text-white px-2 py-1.5 text-sm focus:ring-orange-500 outline-none"
                          >
                              <option value={1}>1 Tahun</option>
                              <option value={2}>2 Tahun</option>
                              <option value={3}>3 Tahun</option>
                              <option value={4}>4 Tahun</option>
                              <option value={5}>5 Tahun</option>
                          </select>
                      </div>
                  </div>
                  <p className="text-[10px] text-orange-700 dark:text-orange-400 italic">
                      *Masa bakti akan dihitung otomatis dari tanggal mulai.
                  </p>
              </div>
          )}

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

      {/* --- QR CODE CARD MODAL --- */}
      <Modal
        isOpen={qrModal.isOpen}
        onClose={() => setQrModal({isOpen: false, member: null})}
        title="Kartu Identitas Digital"
      >
          <div className="flex flex-col items-center p-4">
              <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-lg w-full max-w-sm overflow-hidden relative">
                  {/* Card Header */}
                  <div className="bg-primary-600 h-24 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-700 to-primary-500 opacity-90"></div>
                      <div className="absolute top-4 left-4 text-white z-10">
                          <h3 className="font-bold text-lg leading-tight">{activeFoundation?.name || 'YAYASAN'}</h3>
                          <p className="text-xs text-primary-100 opacity-90">Kartu Anggota Digital</p>
                      </div>
                      <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                  </div>

                  {/* Profile Photo & QR */}
                  <div className="px-6 pb-6 pt-12 relative text-center">
                      {/* Avatar */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-500 shadow-md">
                          {qrModal.member?.full_name.charAt(0)}
                      </div>

                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2">{qrModal.member?.full_name}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{qrModal.member?.roles?.name || 'Anggota'}</p>

                      <div className="bg-white p-2 rounded-lg inline-block border border-gray-100 shadow-sm mx-auto mb-4">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrModal.member?.id}`} 
                            alt="QR Code" 
                            className="w-32 h-32 object-contain"
                          />
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono">{qrModal.member?.id}</p>

                      <div className="mt-4 text-center text-sm">
                          <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded inline-block">
                              <span className="block text-[10px] text-gray-500 dark:text-gray-400">Organisasi</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs">
                                  {organizations.find(o => o.id === qrModal.member?.organization_id)?.name || '-'}
                              </span>
                          </div>
                      </div>
                  </div>
              </div>
              <div className="mt-6 flex justify-center w-full">
                  <button onClick={() => window.print()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition">
                      <Printer size={16} /> Cetak Kartu
                  </button>
              </div>
          </div>
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
                  Apakah Anda yakin ingin menghapus {isSuperAdmin ? 'koordinator' : 'anggota'} <strong>{deleteConfirm.member?.full_name}</strong>?
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
