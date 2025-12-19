
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Group, Organization, Member, Foundation, Role } from '../types';
import { Plus, Edit, Trash2, Boxes, Users, Building2, AlertTriangle, Globe, ChevronLeft, Calendar, Clock, User, UserPlus, Search, XCircle, ShieldCheck, Save, Mail, Phone, List, CheckCircle2, GraduationCap, RefreshCw, Printer, QrCode, Download, BadgeCheck } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface GroupsProps {
  data: Group[];
  organizations: Organization[];
  members: Member[];
  roles: Role[]; 
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

const STUDENT_GRADES = ['Caberawit', 'Praremaja', 'Remaja', 'Usia Nikah'];

export const Groups: React.FC<GroupsProps> = ({ data, organizations, members, roles, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Group | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; type: 'GROUP' | 'MEMBER'; name?: string; }>({ isOpen: false, id: null, type: 'GROUP' });
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberTab, setAddMemberTab] = useState<'SELECT' | 'CREATE'>('SELECT');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [newMemberForm, setNewMemberForm] = useState({ full_name: '', email: '', phone: '', role_id: '', gender: 'L', birth_date: '', grade: '', member_type: 'Generus' });
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memForm, setMemForm] = useState({ full_name: '', email: '', phone: '', gender: 'L', birth_date: '', grade: '', member_type: 'Generus' });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrModal, setQrModal] = useState<{isOpen: boolean, member: Member | null}>({isOpen: false, member: null});

  const getGradeColor = (grade?: string) => {
      switch(grade) {
          case 'Caberawit': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
          case 'Praremaja': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
          case 'Remaja': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
          case 'Usia Nikah': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300';
          default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
      }
  };

  const groupMembers = useMemo(() => {
      if (!selectedGroup) return [];
      return members.filter(m => m.group_id === selectedGroup.id);
  }, [selectedGroup, members]);

  const availableCandidates = useMemo(() => {
      if (!selectedGroup) return [];
      return members.filter(m => m.organization_id === selectedGroup.organization_id && m.group_id !== selectedGroup.id && m.full_name.toLowerCase().includes(candidateSearch.toLowerCase()));
  }, [members, selectedGroup, candidateSearch]);

  const handleAddMemberToGroup = async (memberId: string) => {
      if (!selectedGroup) return;
      try {
          const { error } = await supabase.from('members').update({ group_id: selectedGroup.id }).eq('id', memberId);
          if (error) throw error;
          onRefresh();
      } catch (err: any) { alert("Gagal: " + err.message); }
  };

  const handleCreateNewMember = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedGroup) return;
      setLoading(true);
      
      const payload = { 
          full_name: newMemberForm.full_name,
          email: newMemberForm.email || null,
          phone: newMemberForm.phone || null,
          role_id: newMemberForm.role_id || null,
          gender: newMemberForm.gender,
          birth_date: newMemberForm.birth_date || null, // PENTING: Cegah error string kosong pada tipe date
          grade: newMemberForm.grade || null,
          member_type: newMemberForm.member_type,
          organization_id: selectedGroup.organization_id, 
          group_id: selectedGroup.id, 
          foundation_id: activeFoundation?.id || null 
      };
      
      try {
          const { error } = await supabase.from('members').insert([payload]);
          if (error) throw error;
          onRefresh();
          setIsAddMemberOpen(false);
          setNewMemberForm({ full_name: '', email: '', phone: '', role_id: '', gender: 'L', birth_date: '', grade: '', member_type: 'Generus' });
      } catch (err: any) { alert("Gagal: " + err.message); } finally { setLoading(false); }
  };

  const handleOpen = (group?: Group) => {
    if (group) { setEditingItem(group); setName(group.name); setDescription(group.description || ''); setOrganizationId(group.organization_id); }
    else { setEditingItem(null); setName(''); setDescription(''); setOrganizationId(organizations[0]?.id || ''); }
    setIsModalOpen(true);
  };

  const openEditMember = (member: Member) => {
      setEditingMember(member);
      setMemForm({ full_name: member.full_name, email: member.email, phone: member.phone || '', gender: (member.gender as any) || 'L', birth_date: member.birth_date || '', grade: member.grade || '', member_type: member.member_type || 'Generus' });
      setIsEditMemberOpen(true);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingMember) return;
      setLoading(true);
      
      const sanitizedForm = {
          ...memForm,
          email: memForm.email || null,
          phone: memForm.phone || null,
          birth_date: memForm.birth_date || null // PENTING: Cegah error string kosong
      };

      try {
          const { error } = await supabase.from('members').update(sanitizedForm).eq('id', editingMember.id);
          if (error) throw error;
          onRefresh();
          setIsEditMemberOpen(false);
      } catch (err: any) { alert("Gagal: " + err.message); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const selectedOrg = organizations.find(o => o.id === organizationId);
    const payload: any = { name, description, organization_id: organizationId, foundation_id: selectedOrg?.foundation_id || activeFoundation?.id || null };
    try {
      if (editingItem) { await supabase.from('groups').update(payload).eq('id', editingItem.id); }
      else { await supabase.from('groups').insert([payload]); }
      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) { alert('Error: ' + error.message); } finally { setLoading(false); }
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      if (deleteConfirm.type === 'GROUP') { await supabase.from('groups').delete().eq('id', deleteConfirm.id); if (selectedGroup?.id === deleteConfirm.id) setViewMode('LIST'); }
      else { await supabase.from('members').update({ group_id: null }).eq('id', deleteConfirm.id); }
      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null, type: 'GROUP' });
    } catch (error: any) { alert('Error: ' + error.message); }
  };

  return (
    <div>
      {viewMode === 'LIST' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><Boxes className="text-primary-600" /> Manajemen Kelompok</h2>
            {!isSuperAdmin && <button onClick={() => handleOpen()} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md shadow-primary-600/20"><Plus size={18} /> Tambah Kelompok</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((item) => (
                <div key={item.id} onClick={() => { setSelectedGroup(item); setViewMode('DETAIL'); }} className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition cursor-pointer group flex flex-col relative">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-pink-50 dark:bg-pink-900/30 text-pink-600 rounded-lg group-hover:scale-110 transition-transform"><Boxes size={20} /></div>
                        {!isSuperAdmin && <div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); handleOpen(item); }} className="text-gray-400 hover:text-blue-600"><Edit size={18} /></button><button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: item.id, type: 'GROUP', name: item.name }); }} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button></div>}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{item.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">{item.description || 'Tidak ada deskripsi.'}</p>
                </div>
            ))}
          </div>
        </div>
      ) : (
          <div className="animate-in fade-in slide-in-from-right-8 duration-300 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <button onClick={() => setViewMode('LIST')} className="flex items-center gap-2 text-gray-500 hover:text-primary-600 transition font-medium"><ChevronLeft size={20} /> Kembali ke Daftar Kelompok</button>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition"><Printer size={16}/> Cetak Kartu Kelompok</button>
                </div>
              </div>
              
              <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedGroup?.name}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center border border-blue-100 dark:border-blue-800"><p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Anggota</p><p className="text-2xl font-black text-blue-900 dark:text-blue-100">{groupMembers.length}</p></div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center border border-green-100 dark:border-green-800"><p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Pria (L)</p><p className="text-2xl font-black text-green-900 dark:text-green-100">{groupMembers.filter(m => m.gender === 'L').length}</p></div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center border border-purple-100 dark:border-purple-800"><p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Wanita (P)</p><p className="text-2xl font-black text-purple-900 dark:text-purple-100">{groupMembers.filter(m => m.gender === 'P').length}</p></div>
                  </div>
              </div>
              <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center"><h3 className="font-bold text-gray-800 dark:text-white">Daftar Anggota Kelompok</h3><button onClick={() => setIsAddMemberOpen(true)} className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold shadow-sm transition"><UserPlus size={14}/> Tambah</button></div>
                  <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold"><tr><th className="px-6 py-3">Nama</th><th className="px-6 py-3">Tipe/Kelas</th><th className="px-6 py-3">QR Identitas</th><th className="px-6 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-dark-border">{groupMembers.map(m => (<tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"><td className="px-6 py-3 font-semibold text-gray-900 dark:text-white">{m.full_name}</td><td className="px-6 py-3"><div className="flex gap-1"><span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-100 dark:border-indigo-800">{m.member_type}</span> {m.grade && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getGradeColor(m.grade)}`}>{m.grade}</span>}</div></td><td className="px-6 py-3"><button onClick={() => setQrModal({isOpen: true, member: m})} className="text-primary-600 hover:bg-primary-50 p-1 rounded transition flex items-center gap-1 text-[10px] font-bold"><QrCode size={16}/> LIHAT QR</button></td><td className="px-6 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => openEditMember(m)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-1 rounded transition"><Edit size={18}/></button><button onClick={() => setDeleteConfirm({ isOpen: true, id: m.id, type: 'MEMBER', name: m.full_name })} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded transition"><XCircle size={18}/></button></div></td></tr>))}</tbody></table></div>
                  {groupMembers.length === 0 && <div className="py-12 text-center text-gray-400 text-sm">Belum ada anggota di kelompok ini.</div>}
              </div>
          </div>
      )}

      {/* POPUP QR PREVIEW */}
      <Modal isOpen={qrModal.isOpen} onClose={() => setQrModal({isOpen: false, member: null})} title="ID Anggota">
          {qrModal.member && (
              <div className="flex flex-col items-center gap-6 py-4">
                  <div className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center gap-4">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrModal.member.id}`} alt="QR" className="w-48 h-48" />
                      <div className="text-center">
                          <p className="font-black text-lg text-gray-900 uppercase">{qrModal.member.full_name}</p>
                          <p className="text-xs font-mono text-gray-500 tracking-widest">{qrModal.member.id.substring(0,12).toUpperCase()}</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${qrModal.member.id}`} target="_blank" rel="noreferrer" className="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold flex items-center gap-2"><Download size={18}/> Download</a>
                    <button onClick={() => setQrModal({isOpen: false, member: null})} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">Tutup</button>
                  </div>
              </div>
          )}
      </Modal>

      {/* POPUP GRUP */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Kelompok' : 'Tambah Kelompok'}>
          <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nama Kelompok</label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 bg-gray-50 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition" placeholder="Misal: Kelompok A" /></div>
              <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Organisasi</label><select required value={organizationId} onChange={e => setOrganizationId(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 bg-gray-50 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition">{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
              <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 bg-gray-50 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition" placeholder="Keterangan singkat kelompok..." /></div>
              <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">BATAL</button><button type="submit" className="px-8 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-md shadow-primary-600/20 transition">SIMPAN</button></div>
          </form>
      </Modal>

      {/* POPUP TAMBAH ANGGOTA */}
      <Modal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} title="Tambah Anggota Kelompok" size="lg">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6 shadow-inner">
            <button onClick={() => setAddMemberTab('SELECT')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${addMemberTab === 'SELECT' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500'}`}>PILIH DARI DATABASE</button>
            <button onClick={() => setAddMemberTab('CREATE')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${addMemberTab === 'CREATE' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500'}`}>BUAT ANGGOTA BARU</button>
          </div>
          
          {addMemberTab === 'SELECT' ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-3 text-gray-400"/>
                  <input type="text" placeholder="Cari nama anggota yang sudah terdaftar..." value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm" />
                </div>
                <div className="max-h-80 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 divide-y divide-gray-50 dark:divide-gray-800">
                  {availableCandidates.length > 0 ? availableCandidates.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-950 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">{m.full_name.charAt(0)}</div>
                        <div>
                          <p className="text-sm font-bold text-gray-800 dark:text-white">{m.full_name}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">{m.email || 'Tanpa email'}</p>
                        </div>
                      </div>
                      <button onClick={() => handleAddMemberToGroup(m.id)} className="p-2 bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-600 hover:text-white transition shadow-sm"><Plus size={20}/></button>
                    </div>
                  )) : (
                    <div className="py-12 text-center text-gray-400 text-sm italic">
                      {candidateSearch ? "Tidak ada anggota yang cocok." : "Ketik nama untuk mencari anggota."}
                    </div>
                  )}
                </div>
                <div className="pt-4 flex justify-end">
                   <button type="button" onClick={() => setIsAddMemberOpen(false)} className="px-6 py-2 font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">TUTUP</button>
                </div>
              </div>
          ) : (
              <form onSubmit={handleCreateNewMember} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Nama Lengkap</label>
                        <input type="text" required placeholder="Contoh: Ahmad Fauzi" value={newMemberForm.full_name} onChange={(e) => setNewMemberForm({...newMemberForm, full_name: e.target.value})} className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Tipe Anggota</label>
                        <select value={newMemberForm.member_type} onChange={(e) => setNewMemberForm({...newMemberForm, member_type: e.target.value})} className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm">
                          <option value="Generus">Generus (Siswa)</option>
                          <option value="Lima Unsur">Lima Unsur</option>
                          <option value="Scanner">Scanner</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Jenis Kelamin</label>
                        <select value={newMemberForm.gender} onChange={(e) => setNewMemberForm({...newMemberForm, gender: e.target.value as any})} className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm">
                          <option value="L">Pria (L)</option>
                          <option value="P">Wanita (P)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Email (Opsional)</label>
                        <input type="email" placeholder="email@contoh.com" value={newMemberForm.email} onChange={(e) => setNewMemberForm({...newMemberForm, email: e.target.value})} className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">No. WhatsApp</label>
                        <input type="text" placeholder="08..." value={newMemberForm.phone} onChange={(e) => setNewMemberForm({...newMemberForm, phone: e.target.value})} className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button type="button" onClick={() => setIsAddMemberOpen(false)} className="px-6 py-2.5 text-sm text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">BATAL</button>
                    <button type="submit" disabled={loading} className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-md shadow-primary-600/20 transition flex items-center gap-2">
                      {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16}/>}
                      {loading ? 'MEMPROSES...' : 'SIMPAN & MASUKKAN'}
                    </button>
                  </div>
              </form>
          )}
      </Modal>

      {/* POPUP KONFIRMASI HAPUS */}
      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null, type: 'GROUP'})} title="Konfirmasi Tindakan">
          <div className="text-center space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full w-fit mx-auto text-red-500"><AlertTriangle size={48}/></div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">Apakah Anda yakin ingin {deleteConfirm.type === 'GROUP' ? 'menghapus kelompok' : 'mengeluarkan anggota'} <strong className="text-red-600 dark:text-red-400">{deleteConfirm.name}</strong>?</p>
              <div className="flex justify-center gap-3 pt-2"><button onClick={() => setDeleteConfirm({isOpen: false, id: null, type: 'GROUP'})} className="px-6 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg font-bold text-gray-600 dark:text-gray-400">BATAL</button><button onClick={executeDelete} className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md shadow-red-600/20 transition">YA, LANJUTKAN</button></div>
          </div>
      </Modal>

      {/* POPUP EDIT ANGGOTA */}
      <Modal isOpen={isEditMemberOpen} onClose={() => setIsEditMemberOpen(false)} title="Edit Data Anggota">
          <form onSubmit={handleUpdateMember} className="space-y-4">
              <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Nama Lengkap</label>
                  <input type="text" required value={memForm.full_name} onChange={(e) => setMemForm({...memForm, full_name: e.target.value})} className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm" placeholder="Nama Lengkap" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Tipe</label>
                    <select value={memForm.member_type} onChange={(e) => setMemForm({...memForm, member_type: e.target.value})} className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm"><option value="Generus">Generus</option><option value="Lima Unsur">Lima Unsur</option><option value="Scanner">Scanner</option></select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Kelas/Jenjang</label>
                    <select value={memForm.grade} onChange={(e) => setMemForm({...memForm, grade: e.target.value})} className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm"><option value="">Pilih Kelas</option>{STUDENT_GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button type="button" onClick={() => setIsEditMemberOpen(false)} className="px-6 py-2.5 text-sm text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">BATAL</button>
                  <button type="submit" className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-md shadow-primary-600/20 transition">SIMPAN PERUBAHAN</button>
              </div>
          </form>
      </Modal>
    </div>
  );
};
