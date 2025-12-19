
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Member, Role, Division, Organization, Foundation } from '../types';
import { 
  Plus, Edit, Trash2, Users, AlertTriangle, Globe, Key, Info, 
  CheckCircle2, XCircle, Calendar, Clock, QrCode, Printer, 
  ScanBarcode, ShieldCheck, Search, Eye, EyeOff, Lock, Mail, Phone, RefreshCw, BadgeCheck,
  Download, Image as ImageIcon
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
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

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

  const downloadFullCardFromModal = (member: Member) => {
    setIsGenerating(member.id);
    const orgName = organizations.find(o => o.id === member.organization_id)?.name || activeFoundation?.name || 'YAYASAN';
    const isLimaUnsur = member.member_type === 'Lima Unsur';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1012;
    canvas.height = 638;

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (isLimaUnsur) {
        grad.addColorStop(0, '#d97706'); 
        grad.addColorStop(1, '#0f172a'); 
    } else {
        grad.addColorStop(0, '#2563eb'); 
        grad.addColorStop(1, '#1e1b4b'); 
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 22px Arial';
    ctx.globalAlpha = 0.6;
    ctx.fillText('KARTU IDENTITAS DIGITAL', 50, 50);
    ctx.globalAlpha = 1.0;
    ctx.font = '900 32px Arial';
    ctx.fillText(orgName.toUpperCase(), 50, 85);

    ctx.font = '900 48px Arial';
    ctx.fillText(member.full_name.toUpperCase(), 50, canvas.height - 130);
    ctx.font = 'bold 22px Courier New';
    ctx.globalAlpha = 0.6;
    ctx.fillText(`ID: ${member.id.toUpperCase()}`, 50, canvas.height - 75);

    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${member.id}`;
    qrImg.onload = () => {
        const qrSize = 240;
        const qrX = canvas.width / 2 - qrSize / 2;
        const qrY = canvas.height / 2 - qrSize / 2 - 20;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30, 25);
        ctx.fill();
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
        const link = document.createElement('a');
        link.download = `CARD_${member.full_name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setIsGenerating(null);
    };
  };

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
                            <button onClick={() => setQrModal({isOpen: true, member: item})} className="p-1.5 text-gray-400 hover:text-green-600 transition" title="Lihat Kartu"><BadgeCheck size={18} /></button>
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

          {(isSuperAdmin || !editingItem) && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100">
                  <label className="block text-sm font-bold text-yellow-800 dark:text-yellow-400 mb-1 flex items-center gap-2"><Lock size={16}/> {editingItem ? 'Reset Password' : 'Password Akun Baru'}</label>
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

      <Modal isOpen={qrModal.isOpen} onClose={() => setQrModal({isOpen: false, member: null})} title="Kartu Identitas Anggota">
          {qrModal.member && (
              <div className="flex flex-col items-center gap-6 py-4">
                  <div className="relative w-full max-w-sm aspect-[1.58/1] rounded-2xl overflow-hidden shadow-2xl bg-slate-900 text-white p-4 flex flex-col justify-between">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-slate-900 to-indigo-900 opacity-50"></div>
                        <div className="relative z-10 flex justify-between items-start">
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-80">KARTU ANGGOTA</h4>
                                <p className="text-xs font-bold">{activeFoundation?.name || 'YAYASAN'}</p>
                            </div>
                            <div className="bg-primary-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase">{qrModal.member.member_type}</div>
                        </div>
                        <div className="relative z-10 flex justify-center">
                            <div className="bg-white p-1 rounded-xl shadow-xl border-4 border-white/20">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrModal.member.id}`} alt="QR" className="w-20 h-20" />
                            </div>
                        </div>
                        <div className="relative z-10 flex justify-between items-end">
                            <div className="text-left">
                                <p className="text-sm font-black uppercase tracking-tighter leading-none">{qrModal.member.full_name}</p>
                                <p className="text-[8px] font-mono opacity-60 tracking-widest">{qrModal.member.id.substring(0,12).toUpperCase()}</p>
                            </div>
                        </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                      <button 
                        onClick={() => downloadFullCardFromModal(qrModal.member!)} 
                        disabled={isGenerating === qrModal.member.id}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition"
                      >
                          {isGenerating === qrModal.member.id ? <RefreshCw size={18} className="animate-spin"/> : <ImageIcon size={18}/>} 
                          Download Kartu
                      </button>
                      <a href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${qrModal.member.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition">
                          <Download size={18}/> Download QR Saja
                      </a>
                  </div>
              </div>
          )}
      </Modal>

      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, member: null})} title="Konfirmasi Hapus Anggota">
          <div className="text-center">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full w-fit mx-auto mb-4 text-red-600"><AlertTriangle size={48}/></div>
              <p className="text-gray-700 dark:text-gray-300 mb-6 font-medium">Apakah Anda yakin ingin menghapus data <strong>{deleteConfirm.member?.full_name}</strong>?</p>
              <div className="flex justify-center gap-3">
                  <button onClick={() => setDeleteConfirm({isOpen: false, member: null})} className="px-6 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg font-bold text-gray-600 dark:text-gray-400">BATAL</button>
                  <button onClick={executeDelete} disabled={loading} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-2">
                      {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
                      HAPUS SEKARANG
                  </button>
              </div>
          </div>
      </Modal>
    </div>
  );
};
