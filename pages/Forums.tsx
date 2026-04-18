import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Forum, Member, Foundation, ForumMember, Organization, Group, Role, Division, Workplace } from '../types';
import DetailMemberModal from '../components/DetailMemberModal';
import { 
  Plus, Edit, Trash2, Users, AlertTriangle, Globe, Key, Info, 
  CheckCircle2, XCircle, Calendar, Clock, QrCode, Printer, 
  ScanBarcode, ShieldCheck, Search, Eye, EyeOff, Lock, Mail, Phone, RefreshCw, BadgeCheck,
  Download, Image as ImageIcon, MessageSquare, UserPlus, X, Save, ChevronRight, Boxes
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ForumsProps {
  data: Forum[];
  members: Member[];
  groups?: Group[];
  roles?: Role[];
  divisions?: Division[];
  organizations?: Organization[];
  foundations?: Foundation[];
  workplaces?: Workplace[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

export const Forums: React.FC<ForumsProps> = ({ 
    data, members, groups = [], 
    roles = [], divisions = [], organizations = [], foundations = [], workplaces = [],
    onRefresh, activeFoundation, isSuperAdmin 
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Forum | null>(null);
    const [selectedForum, setSelectedForum] = useState<Forum | null>(null);
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    
    const [search, setSearch] = useState('');
    const [forumMembers, setForumMembers] = useState<ForumMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [groupIdFilter, setGroupIdFilter] = useState('');
    const [detailModal, setDetailModal] = useState<{isOpen: boolean, member: Member | null}>({isOpen: false, member: null});
    
    const [isExitReasonOpen, setIsExitReasonOpen] = useState(false);
    const [exitReason, setExitReason] = useState('');
    const [memberToExit, setMemberToExit] = useState<ForumMember | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchForumMembers = async (forumId: string) => {
        setLoadingMembers(true);
        try {
            const { data: fmData, error } = await supabase
                .from('forum_members')
                .select('*, members(full_name, email, nickname)')
                .eq('forum_id', forumId);
            if (error) throw error;
            setForumMembers(fmData || []);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleOpenModal = (item?: Forum) => {
        if (item) {
            setEditingItem(item);
            setName(item.name);
            setDescription(item.description || '');
        } else {
            setEditingItem(null);
            setName('');
            setDescription('');
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const payload: any = { 
            name, 
            description,
            foundation_id: activeFoundation?.id
        };

        try {
            if (editingItem) {
                const { error } = await supabase.from('forums').update(payload).eq('id', editingItem.id);
                if (error) throw error;
                showToast("Forum berhasil diperbarui");
            } else {
                const { error } = await supabase.from('forums').insert([payload]);
                if (error) throw error;
                showToast("Forum berhasil dibuat");
            }
            onRefresh();
            setIsModalOpen(false);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus forum ini? Semua data anggota forum juga akan terhapus.')) return;
        try {
            const { error } = await supabase.from('forums').delete().eq('id', id);
            if (error) throw error;
            showToast("Forum berhasil dihapus");
            onRefresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleAddMember = async (memberId: string) => {
        if (!selectedForum) return;
        try {
            const { error } = await supabase.from('forum_members').insert([
                { forum_id: selectedForum.id, member_id: memberId }
            ]);
            if (error) {
                if (error.code === '23505') throw new Error("Anggota sudah ada di forum ini.");
                throw error;
            }
            fetchForumMembers(selectedForum.id);
            showToast("Anggota ditambahkan");
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleRemoveMember = (fm: ForumMember) => {
        setMemberToExit(fm);
        setExitReason('');
        setIsExitReasonOpen(true);
    };

    const handleConfirmExit = async () => {
        if (!memberToExit || !selectedForum) return;
        if (!exitReason.trim()) {
            showToast("Harap isi alasan keluar", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create mutation record
            const { error: mutError } = await supabase.from('member_mutations').insert([{
                member_id: memberToExit.member_id,
                type: 'KELUAR_FORUM',
                description: `Keluar dari forum "${selectedForum.name}". Alasan: ${exitReason}`,
                mutation_date: new Date().toISOString().split('T')[0],
                foundation_id: activeFoundation?.id
            }]);
            
            if (mutError) throw mutError;

            // 2. Remove from forum_members
            const { error } = await supabase.from('forum_members').delete().eq('id', memberToExit.id);
            if (error) throw error;

            showToast("Berhasil dikeluarkan dengan catatan");
            fetchForumMembers(selectedForum.id);
            setIsExitReasonOpen(false);
            setExitReason('');
            setMemberToExit(null);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const exportForumMembersPDF = () => {
        if (!selectedForum || forumMembers.length === 0) return;
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text(`DAFTAR ANGGOTA FORUM: ${selectedForum.name}`, 14, 20);
        doc.setFontSize(11);
        doc.text(`Yayasan: ${activeFoundation?.name || '-'}`, 14, 28);
        doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 34);

        const tableData = forumMembers.map((fm, index) => {
            const member = members.find(m => m.id === fm.member_id);
            const groupName = groups.find(g => g.id === member?.group_id)?.name || 'Tanpa Kelompok';
            return [
                (index + 1).toString(),
                (fm as any).members?.full_name || '-',
                (fm as any).members?.nickname || '-',
                groupName
            ];
        });

        autoTable(doc, {
            startY: 40,
            head: [['No', 'Nama Lengkap', 'Panggilan', 'Kelompok']],
            body: tableData,
            headStyles: { fillColor: [79, 70, 229] },
        });

        doc.save(`Anggota_Forum_${selectedForum.name.replace(/\s+/g, '_')}.pdf`);
    };

    const filteredData = useMemo(() => {
        return data.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    }, [data, search]);

    const availableMembers = useMemo(() => {
        if (!selectedForum) return [];
        const currentMemberIds = new Set(forumMembers.map(fm => fm.member_id));
        return members.filter(m => {
            const matchesSearch = !memberSearch || (
                m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) || 
                m.nickname?.toLowerCase().includes(memberSearch.toLowerCase())
            );
            const matchesGroup = !groupIdFilter || m.group_id === groupIdFilter;
            return !currentMemberIds.has(m.id) && matchesSearch && matchesGroup;
        }).slice(0, 10);
    }, [members, forumMembers, selectedForum, memberSearch, groupIdFilter]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <MessageSquare className="text-primary-600" size={28} /> Forum Khusus
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola forum khusus untuk acara lintas kelompok.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-primary-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg shadow-primary-600/20 active:scale-95 transition-all"
                >
                    <Plus size={20} /> Buat Forum Baru
                </button>
            </div>

            {/* Filter */}
            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Cari forum..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                />
            </div>

            {/* Forum Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.map(forum => (
                    <div key={forum.id} className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col">
                        <div className="p-8 pb-4">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <MessageSquare size={28} />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleOpenModal(forum)} className="p-2 text-gray-400 hover:text-primary-600 transition-colors"><Edit size={20} /></button>
                                    <button onClick={() => handleDelete(forum.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={20} /></button>
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2 line-clamp-1">{forum.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 h-10">{forum.description || 'Tidak ada deskripsi'}</p>
                        </div>
                        
                        <div className="mt-auto px-8 py-6 border-t dark:border-dark-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-gray-400" />
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Anggota Terdaftar</span>
                            </div>
                            <button 
                                onClick={() => { setSelectedForum(forum); fetchForumMembers(forum.id); setIsManageMembersOpen(true); }}
                                className="text-xs font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest flex items-center gap-1 group/btn"
                            >
                                Kelola <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                ))}
                
                {filteredData.length === 0 && (
                    <div className="col-span-full py-32 text-center">
                        <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <MessageSquare size={48} className="text-gray-200" />
                        </div>
                        <h3 className="text-lg font-black text-gray-400 uppercase tracking-[0.3em]">Forum Tidak Ditemukan</h3>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Forum' : 'Buat Forum Baru'}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nama Forum</label>
                            <input 
                                required
                                type="text" 
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white font-sans"
                                placeholder="Contoh: Forum Remaja Masjid"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Deskripsi</label>
                            <textarea 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white font-sans min-h-[120px]"
                                placeholder="Tuliskan tujuan atau keterangan forum ini..."
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition">Batal</button>
                        <button 
                            disabled={isSubmitting}
                            className="bg-primary-600 text-white px-10 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary-600/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Menyimpan...' : 'Simpan Forum'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Manage Members Modal */}
            <Modal isOpen={isManageMembersOpen} onClose={() => setIsManageMembersOpen(false)} title={`Anggota Forum: ${selectedForum?.name}`} size="lg">
                <div className="space-y-8">
                    {/* Add Member Section */}
                    <div className="space-y-4">
                        <label className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Tambah Anggota Baru</label>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input 
                                    type="text"
                                    placeholder="Cari nama atau panggilan..."
                                    value={memberSearch}
                                    onChange={e => setMemberSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                            
                            <div className="relative">
                                <Boxes className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select 
                                    value={groupIdFilter}
                                    onChange={e => setGroupIdFilter(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                                >
                                    <option value="">-- Semua Kelompok --</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        {(memberSearch || groupIdFilter) && (
                            <div className="bg-white dark:bg-dark-card border dark:border-gray-800 rounded-2xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-2">
                                {availableMembers.map(m => {
                                    const groupName = groups.find(g => g.id === m.group_id)?.name || 'Tanpa Kelompok';
                                    return (
                                        <div key={m.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors border-b last:border-none dark:border-gray-800">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                                                        {m.full_name} {m.nickname && <span className="text-primary-600 ml-1">({m.nickname})</span>}
                                                    </p>
                                                    <button 
                                                        onClick={() => setDetailModal({isOpen: true, member: m})}
                                                        className="p-1 text-gray-400 hover:text-primary-600 transition"
                                                    >
                                                        <Eye size={14}/>
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{m.email} • {groupName}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleAddMember(m.id)}
                                                className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
                                            >
                                                <UserPlus size={18} />
                                            </button>
                                        </div>
                                    );
                                })}
                                {availableMembers.length === 0 && (
                                    <div className="px-4 py-8 text-center text-gray-400 text-xs font-bold italic">Anggota tidak ditemukan atau sudah bergabung.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Current Members List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Anggota Forum ({forumMembers.length})</label>
                            {forumMembers.length > 0 && (
                                <button 
                                    onClick={exportForumMembersPDF}
                                    className="text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest flex items-center gap-1.5"
                                >
                                    <Download size={14} /> Export PDF
                                </button>
                            )}
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border dark:border-gray-800 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {loadingMembers ? (
                                <div className="py-20 text-center"><RefreshCw size={32} className="animate-spin text-primary-600 mx-auto" /></div>
                            ) : forumMembers.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest sticky top-0">
                                        <tr>
                                            <th className="px-5 py-4">Nama</th>
                                            <th className="px-5 py-4">Status/Panggilan</th>
                                            <th className="px-5 py-4 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-800">
                                        {forumMembers.map(fm => (
                                            <tr key={fm.id} className="hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                                <td className="px-5 py-4 font-bold text-sm text-gray-900 dark:text-white uppercase tracking-tight">
                                                    {(fm as any).members?.full_name}
                                                    {(fm as any).members?.nickname && (
                                                        <span className="block text-[10px] text-primary-600">Panggilan: {(fm as any).members?.nickname}</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-xs text-gray-500 font-bold uppercase">
                                                    {members.find(m => m.id === fm.member_id)?.groups?.name || 'Tanpa Kelompok'}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => setDetailModal({isOpen: true, member: members.find(m => m.id === fm.member_id) || null})}
                                                            className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                                                            title="Detail Lengkap"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRemoveMember(fm)}
                                                            className="p-2 text-gray-300 hover:text-red-600 transition-colors"
                                                            title="Hapus dari forum"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="py-20 text-center text-gray-400 text-xs font-bold italic uppercase tracking-[0.2em]">Belum ada anggota di forum ini.</div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Exit Reason Modal */}
            <Modal isOpen={isExitReasonOpen} onClose={() => setIsExitReasonOpen(false)} title="Alasan Keluar Forum">
                <div className="space-y-6">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                        <div className="flex gap-3">
                            <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                            <div>
                                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Konfirmasi Keluar Forum</p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    Anda akan mengeluarkan <span className="font-black uppercase">{(memberToExit as any)?.members?.full_name}</span> dari forum <span className="font-black">"{selectedForum?.name}"</span>.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Berikan Alasan / Catatan</label>
                        <textarea 
                            required
                            value={exitReason}
                            onChange={e => setExitReason(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-white font-sans min-h-[100px]"
                            placeholder="Contoh: Lulus, Pindah tugas, atau permintaan sendiri..."
                        />
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setIsExitReasonOpen(false)} className="px-6 py-3 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition">Batal</button>
                        <button 
                            onClick={handleConfirmExit}
                            disabled={isSubmitting || !exitReason.trim()}
                            className="bg-amber-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-amber-600/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Memproses...' : 'Keluarkan & Catat'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300 ${
                    toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                    <p className="text-sm font-black uppercase tracking-tight">{toast.message}</p>
                </div>
            )}
            {/* Detail Modal */}
            <DetailMemberModal 
              isOpen={detailModal.isOpen} 
              onClose={() => setDetailModal({isOpen: false, member: null})} 
              member={detailModal.member}
              roles={roles}
              divisions={divisions}
              organizations={organizations}
              foundations={foundations}
              workplaces={workplaces}
            />
        </div>
    );
};
