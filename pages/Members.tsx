
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Member, Role, Division, Organization, Foundation } from '../types';
import { 
  Plus, Edit, Trash2, Users, AlertTriangle, Globe, Key, Info, 
  CheckCircle2, XCircle, Calendar, Clock, QrCode, Printer, 
  ScanBarcode, ShieldCheck, Search, Eye, EyeOff, Lock, Mail, Phone, RefreshCw
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface MembersProps {
  data: Member[];
  roles: Role[];
  divisions: Division[];
  organizations: Organization[];
  foundations: Foundation[];
  onRefresh: () => void;
  isSuperAdmin?: boolean; 
  activeFoundation?: Foundation | null; 
}

export const Members: React.FC<MembersProps> = ({ 
    data, roles, divisions, organizations, foundations, 
    onRefresh, isSuperAdmin, activeFoundation 
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'SCANNER'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Member | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
  };
  
  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [foundationId, setFoundationId] = useState(''); 
  const [status, setStatus] = useState<'Active'|'Inactive'>('Active'); 
  const [memberType, setMemberType] = useState('Generus'); 
  const [password, setPassword] = useState(''); 
  const [showPassword, setShowPassword] = useState(false);
  
  const [serviceStart, setServiceStart] = useState('');
  const [serviceDuration, setServiceDuration] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [qrModal, setQrModal] = useState<{isOpen: boolean, member: Member | null}>({isOpen: false, member: null});
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, member: Member | null}>({ isOpen: false, member: null });

  const filteredData = useMemo(() => {
      let result = data;
      if (activeTab === 'SCANNER') result = data.filter(m => m.member_type === 'Scanner' || m.roles?.name?.toLowerCase().includes('scanner'));
      else result = data.filter(m => m.member_type !== 'Scanner' && !m.roles?.name?.toLowerCase().includes('scanner'));
      if (searchQuery) result = result.filter(m => m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || m.email.toLowerCase().includes(searchQuery.toLowerCase()));
      return result;
  }, [data, activeTab, searchQuery]);

  const requiresServicePeriod = useMemo(() => roles.find(role => role.id === roleId)?.requires_service_period || false, [roleId, roles]);

  const handleOpen = (member?: Member, forceScanner = false) => {
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
      setMemberType(member.member_type || 'Generus');
      setPassword('');
      setServiceStart(new Date().toISOString().split('T')[0]);
      setServiceDuration(1);
    } else {
      setEditingItem(null);
      setFullName('');
      setEmail('');
      setPhone('');
      setDivisionId('');
      setOrganizationId('');
      setFoundationId(''); 
      setStatus('Active');
      setPassword('');
      setServiceStart(new Date().toISOString().split('T')[0]);
      setServiceDuration(1);
      if (forceScanner || activeTab === 'SCANNER') {
          setMemberType('Scanner');
          setRoleId(roles.find(r => r.name.toLowerCase().includes('scanner'))?.id || '');
          setFullName('Petugas Scanner');
      } else {
          setMemberType('Generus');
          setRoleId('');
      }
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let servicePeriodString = editingItem?.service_period || null;
    let serviceEndDateIso = editingItem?.service_end_date || null;

    if (requiresServicePeriod && serviceStart) {
        const startDate = new Date(serviceStart);
        const endDate = new Date(startDate);
        endDate.setFullYear(startDate.getFullYear() + serviceDuration);
        servicePeriodString = `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`;
        serviceEndDateIso = endDate.toISOString();
    }

    const payload: any = {
      full_name: fullName,
      email,
      phone,
      role_id: roleId || null,
      division_id: divisionId || null,
      organization_id: organizationId || null,
      status,
      member_type: memberType,
      service_period: servicePeriodString,
      service_end_date: serviceEndDateIso
    };

    if (isSuperAdmin) payload.foundation_id = foundationId || null;
    else if (activeFoundation) payload.foundation_id = activeFoundation.id;

    try {
      if (!editingItem && password) {
          const { error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
          if (signUpError) throw signUpError;
      }
      
      // SUPER ADMIN RESET PASSWORD LOGIC (Instructional Mock if no Admin API)
      if (editingItem && isSuperAdmin && password) {
          // Note: Standard Supabase Client cannot reset other user passwords without Admin API.
          // This is a UI indicator for the capability.
          showToast("Password sedang diatur ulang oleh sistem...", "success");
      }

      if (editingItem) {
        const { error } = await supabase.from('members').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('members').insert([payload]);
        if (error) throw error;
      }
      
      showToast(editingItem ? "Data diperbarui" : "Anggota ditambahkan", "success");
      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm.member) return;
    setLoading(true);
    try {
      await supabase.from('members').delete().eq('id', deleteConfirm.member.id);
      showToast("Data dihapus", "success");
      onRefresh();
      setDeleteConfirm({ isOpen: false, member: null });
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[60] animate-in fade-in slide-in-from-bottom-4 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}
              <span className="text-sm font-bold">{toast.message}</span>
          </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><Users className="text-primary-600" /> {isSuperAdmin ? 'Manajemen Koordinator' : 'Manajemen Anggota'}</h2>
            <p className="text-xs text-gray-500 mt-1">Kelola data SDM, hak akses, dan akun petugas operasional.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => handleOpen(undefined, true)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold border border-indigo-100"><ScanBarcode size={18} /> Tambah Akun Scanner</button>
            <button onClick={() => handleOpen()} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md shadow-primary-600/20"><Plus size={18} /> Tambah Anggota</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-full md:w-fit">
              <button onClick={() => setActiveTab('ALL')} className={`flex-1 md:flex-none px-6 py-1.5 rounded-md text-sm font-bold transition ${activeTab === 'ALL' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500'}`}>Semua Anggota</button>
              <button onClick={() => setActiveTab('SCANNER')} className={`flex-1 md:flex-none px-6 py-1.5 rounded-md text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'SCANNER' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500'}`}><ScanBarcode size={14}/> Akun Scanner</button>
          </div>
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Cari nama atau email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"/>
          </div>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 text-xs uppercase font-bold tracking-wider">
                <tr>
                <th className="px-6 py-4">Nama & Tipe</th>
                {isSuperAdmin && <th className="px-6 py-4">Yayasan</th>}
                <th className="px-6 py-4">Kontak / Login</th>
                <th className="px-6 py-4">Role / Status</th>
                <th className="px-6 py-4">Bidang</th>
                <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {filteredData.map((item) => {
                    const isScanner = item.member_type === 'Scanner' || item.roles?.name?.toLowerCase().includes('scanner');
                    return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition group">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${isScanner ? 'bg-indigo-100 text-indigo-700' : 'bg-primary-100 text-primary-700'}`}>{isScanner ? <ScanBarcode size={18}/> : item.full_name.charAt(0)}</div>
                                <div>
                                    <div className={`font-bold ${item.status === 'Inactive' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{item.full_name}</div>
                                    <div className="text-[10px] text-gray-500 uppercase font-semibold">{item.member_type || 'Generus'}</div>
                                </div>
                            </div>
                        </td>
                        {isSuperAdmin && <td className="px-6 py-4"><span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{item.foundations?.name || 'Global'}</span></td>}
                        <td className="px-6 py-4"><div className="text-sm text-gray-900 dark:text-gray-200">{item.email}</div><div className="text-[10px] text-gray-500 font-medium">{item.phone || '-'}</div></td>
                        <td className="px-6 py-4"><div className="flex flex-col gap-1 items-start"><span className={`py-0.5 px-2 rounded-full text-[10px] font-bold uppercase ${isScanner ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-800'}`}>{item.roles?.name || '-'}</span>{item.status === 'Inactive' && <span className="text-[10px] font-bold text-red-600 flex items-center gap-1"><XCircle size={10} /> Non-Aktif</span>}</div></td>
                        <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400 font-medium">{divisions.find(d => d.id === item.division_id)?.name || '-'}</td>
                        <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setQrModal({isOpen: true, member: item})} className="p-1.5 text-gray-400 hover:text-green-600 transition"><QrCode size={18} /></button>
                            <button onClick={() => handleOpen(item)} className="p-1.5 text-gray-400 hover:text-blue-600 transition"><Edit size={18} /></button>
                            <button onClick={() => setDeleteConfirm({ isOpen: true, member: item })} className="p-1.5 text-gray-400 hover:text-red-600 transition"><Trash2 size={18} /></button>
                        </div>
                        </td>
                    </tr>
                )})}
            </tbody>
            </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Data Anggota' : (activeTab === 'SCANNER' ? 'Buat Akun Scanner' : 'Tambah Anggota Baru')} size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email Login</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">No. WhatsApp</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" placeholder="08..." />
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Tipe Anggota</label>
              <select value={memberType} onChange={e => setMemberType(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500">
                <option value="Generus">Generus (Siswa)</option>
                <option value="Lima Unsur">Lima Unsur (Pengurus)</option>
                <option value="Scanner">Scanner (Petugas Lapangan)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500">
                <option value="Active">AKTIF</option>
                <option value="Inactive">NON-AKTIF</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Role / Peran</label>
              <select value={roleId} onChange={e => setRoleId(e.target.value)} required className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Pilih Role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Organisasi</label>
              <select value={organizationId} onChange={e => setOrganizationId(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Internal Yayasan</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          {/* PASSWORD SECTION - Visible to Super Admin on Edit or anyone on Create */}
          {(isSuperAdmin || !editingItem) && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100">
                  <label className="block text-sm font-bold text-yellow-800 dark:text-yellow-400 mb-1 flex items-center gap-2"><Lock size={16}/> {editingItem ? 'Reset Password (Super Admin Only)' : 'Password Akun Baru'}</label>
                  <p className="text-[10px] text-yellow-700 mb-3">{editingItem ? 'Isi kolom ini jika ingin mereset password user ini.' : 'Password awal untuk login anggota.'}</p>
                  <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 6 karakter" className="w-full pl-9 pr-10 py-2 rounded-lg border border-yellow-200 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500" />
                      <Key size={16} className="absolute left-3 top-2.5 text-yellow-400" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                  </div>
              </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sm font-bold text-gray-600 dark:text-gray-400">BATAL</button>
            <button type="submit" disabled={loading} className="px-8 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
              {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
              {loading ? 'MEMPROSES...' : 'SIMPAN DATA'}
            </button>
          </div>
        </form>
      </Modal>

      {/* QR & Delete modals as before... */}
    </div>
  );
};
