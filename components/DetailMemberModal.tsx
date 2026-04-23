import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Member, Role, Division, Organization, Foundation, MemberMutation, Group } from '../types';
import { 
  CheckCircle2, XCircle, Calendar, Clock, QrCode, Printer, 
  ScanBarcode, ShieldCheck, Mail, Phone, RefreshCw, BadgeCheck,
  Download, Image as ImageIcon, History, FileText, ChevronRight, User, Layers, Boxes, Briefcase, Building2, MessageSquare, AlertTriangle, X, MapPin
} from './ui/Icons';
import { Modal } from './Modal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable'; // Keep this for (doc as any).autoTable compatibility if needed 

interface DetailMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: Member | null;
    roles: Role[];
    divisions: Division[];
    organizations: Organization[];
    foundations: Foundation[];
    workplaces: any[];
}

const DetailMemberModal: React.FC<DetailMemberModalProps> = ({ 
    isOpen, onClose, member, roles, divisions, organizations, foundations, workplaces 
}) => {
    const [mutations, setMutations] = useState<MemberMutation[]>([]);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [forums, setForums] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && member) {
            fetchMemberDetails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, member]);

    const fetchMemberDetails = async () => {
        if (!member) return;
        setLoading(true);
        try {
            const [mutRes, attRes, forRes, grpRes] = await Promise.all([
                supabase.from('member_mutations').select('*').eq('member_id', member.id).order('mutation_date', { ascending: false }),
                supabase.from('event_attendance').select('*, events(name, date)').eq('member_id', member.id).order('id', { ascending: false }).limit(20),
                supabase.from('forum_members').select('*, forums(name)').eq('member_id', member.id),
                supabase.from('members').select('group_id, groups(name, organizations(name))').eq('id', member.id).single()
            ]);

            setMutations(mutRes.data || []);
            setAttendance(attRes.data || []);
            setForums(forRes.data || []);
            setGroups(grpRes.data && grpRes.data.groups ? [grpRes.data.groups] : []);
        } catch (error) {
            console.error("Error fetching member details:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        if (!member) return;
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(37, 99, 235); // primary-600
        doc.text('PROFIL ANGGOTA YAYASAN', 105, 20, { align: 'center' });
        
        doc.setDrawColor(229, 231, 235);
        doc.line(20, 25, 190, 25);

        // Basic Info
        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text('Informasi Pribadi', 20, 35);
        
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        const basicData = [
            ['Nama Lengkap', member.full_name],
            ['Nama Panggilan', member.nickname || '-'],
            ['Email', member.email],
            ['No. WhatsApp', member.phone || '-'],
            ['Tgl Lahir', member.birth_date || '-'],
            ['Jenis Kelamin', member.gender === 'L' ? 'Pria' : member.gender === 'P' ? 'Wanita' : '-'],
        ];

        (doc as any).autoTable({
            startY: 40,
            head: [],
            body: basicData,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
        });

        // Organization Info
        const nextY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text('Penempatan Organisasi', 20, nextY);

        const orgData = [
            ['Role', roles.find(r => r.id === member.role_id)?.name || '-'],
            ['Bidang', divisions.find(d => d.id === member.division_id)?.name || '-'],
            ['Kelompok', groups[0]?.name || '-'],
            ['Organisasi', organizations.find(o => o.id === member.organization_id)?.name || '-'],
            ['Status Kerja', member.employment_status || '-'],
            ['Tempat Kerja', member.workplace || '-'],
        ];

        (doc as any).autoTable({
            startY: nextY + 5,
            head: [],
            body: orgData,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
        });

        // Mutations Table
        const mutY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.text('Riwayat Mutasi (Track Record)', 20, mutY);

        (doc as any).autoTable({
            startY: mutY + 5,
            head: [['Tanggal', 'Tipe', 'Keterangan']],
            body: mutations.map(m => [
                new Date(m.mutation_date).toLocaleDateString('id-ID'),
                m.type,
                m.description || '-'
            ]),
            headStyles: { fillColor: [79, 70, 229] },
        });

        // Attendance Table
        let lastY = (doc as any).lastAutoTable.finalY + 10;
        if (lastY < 250) {
            doc.setFontSize(14);
            doc.text('Kehadiran Terakhir', 20, lastY);

            (doc as any).autoTable({
                startY: lastY + 5,
                head: [['Acara', 'Tanggal', 'Status']],
                body: attendance.map(a => [
                    a.events?.name || '-',
                    a.events ? new Date(a.events.date).toLocaleDateString('id-ID') : '-',
                    a.status
                ]),
                headStyles: { fillColor: [16, 185, 129] },
            });
            lastY = (doc as any).lastAutoTable.finalY + 10;
        }

        // Forums Table
        if (lastY < 250 && forums.length > 0) {
            doc.setFontSize(14);
            doc.text('Forum yang Diikuti', 20, lastY);

            (doc as any).autoTable({
                startY: lastY + 5,
                head: [['No', 'Nama Forum', 'Status']],
                body: forums.map((f, i) => [
                    (i + 1).toString(),
                    f.forums?.name || '-',
                    'Aktif'
                ]),
                headStyles: { fillColor: [99, 102, 241] },
            });
        }

        doc.save(`PROFIL_${member.full_name.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Detail Lengkap Anggota" size="xl">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <RefreshCw className="animate-spin text-primary-600" size={40} />
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Memuat Data Lengkap...</p>
                </div>
            ) : member && (
                <div className="space-y-8 py-2">
                    {/* Header Profile */}
                    <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-gradient-to-br from-primary-600 to-indigo-700 rounded-3xl text-white shadow-xl shadow-primary-600/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                        <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl font-black border border-white/30 shadow-2xl z-10 shrink-0">
                            {member.full_name.charAt(0)}
                        </div>
                        <div className="text-center md:text-left z-10 flex-1">
                            <h3 className="text-2xl font-black truncate">{member.full_name}</h3>
                            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase border border-white/20">{member.member_type || 'Generus'}</span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${member.status === 'Active' ? 'bg-green-500/20 border-green-400 text-green-100' : 'bg-red-500/20 border-red-400 text-red-100'}`}>{member.status || 'Active'}</span>
                                {member.grade && <span className="px-3 py-1 bg-amber-500/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase border border-amber-400 text-amber-100">{member.grade}</span>}
                            </div>
                        </div>
                        <button onClick={handleExportPDF} className="bg-white text-primary-700 px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-2xl hover:bg-gray-50 active:scale-95 transition-all uppercase tracking-widest z-10">
                            <FileText size={18} /> Export PDF Detail
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Basic Info */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={16}/> Informasi Pribadi</h4>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-primary-600"><Mail size={16}/></div>
                                    <div><p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Email</p><p className="text-sm font-bold text-gray-700 dark:text-gray-200">{member.email}</p></div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-primary-600"><Phone size={16}/></div>
                                    <div><p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">WhatsApp</p><p className="text-sm font-bold text-gray-700 dark:text-gray-200">{member.phone || '-'}</p></div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-primary-600"><Calendar size={16}/></div>
                                    <div><p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Tanggal Lahir</p><p className="text-sm font-bold text-gray-700 dark:text-gray-200">{member.birth_date ? new Date(member.birth_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p></div>
                                </div>
                            </div>
                        </div>

                        {/* Org Info */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Layers size={16}/> Detail Organisasi</h4>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-indigo-600"><ShieldCheck size={16}/></div>
                                    <div><p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Role / Jabatan</p><p className="text-sm font-bold text-gray-700 dark:text-gray-200">{roles.find(r => r.id === member.role_id)?.name || '-'}</p></div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-indigo-600"><Boxes size={16}/></div>
                                    <div><p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Kelompok</p><p className="text-sm font-bold text-gray-700 dark:text-gray-200">{groups[0]?.name || '-'}</p></div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-indigo-600"><Briefcase size={16}/></div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Pekerjaan</p>
                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{member.employment_status || '-'}</p>
                                        {member.employment_status === 'Karyawan' && (
                                            <div className="mt-2 space-y-1 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                                {(() => {
                                                    const currentWp = workplaces.find(w => w.id === member.workplace_id);
                                                    const parentWp = currentWp?.parent_workplace_id ? workplaces.find(w => w.id === currentWp.parent_workplace_id) : currentWp;
                                                    const branchWp = currentWp?.parent_workplace_id ? currentWp : null;
                                                    
                                                    return (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                <Building2 size={12} className="text-primary-500" />
                                                                <p className="text-[10px] text-gray-500 font-bold uppercase"><span className="text-gray-400">Pusat:</span> {parentWp?.name || member.workplace || '-'}</p>
                                                            </div>
                                                            {branchWp && (
                                                                <div className="flex items-center gap-2">
                                                                    <MapPin size={12} className="text-emerald-500" />
                                                                    <p className="text-[10px] text-gray-500 font-bold uppercase"><span className="text-gray-400">Cabang:</span> {branchWp.name}</p>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs for detailed lists */}
                    <div className="space-y-6">
                        {/* Mutations */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><History size={18}/> Track Record (Mutasi)</h4>
                            <div className="space-y-3">
                                {mutations.length === 0 ? (
                                    <div className="p-6 text-center bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-xs font-bold uppercase">Belum ada catatan mutasi</div>
                                ) : (
                                    mutations.map(m => (
                                        <div key={m.id} className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black uppercase bg-primary-50 dark:bg-primary-900/40 text-primary-600 px-2 py-0.5 rounded-full">{m.type}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold">{new Date(m.mutation_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                                </div>
                                                <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{m.description || '-'}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Attendance */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Clock size={18}/> Kehadiran Terakhir</h4>
                                <div className="space-y-2">
                                    {attendance.length === 0 ? (
                                        <div className="p-6 text-center bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-xs font-bold uppercase">Belum ada riwayat hadir</div>
                                    ) : (
                                        attendance.map(a => (
                                            <div key={a.id} className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                                                <div>
                                                    <p className="text-xs font-black text-gray-800 dark:text-white truncate max-w-[150px]">{a.events?.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold">{a.events ? new Date(a.events.date).toLocaleDateString('id-ID') : '-'}</p>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${a.status === 'Present' ? 'bg-green-100 text-green-700 shadow-sm border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>{a.status}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Forums */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={18}/> Forum Diikuti</h4>
                                <div className="space-y-2">
                                    {forums.length === 0 ? (
                                        <div className="p-6 text-center bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-xs font-bold uppercase">Belum mengikuti forum</div>
                                    ) : (
                                        forums.map(f => (
                                            <div key={f.id} className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 shadow-inner"><MessageSquare size={14}/></div>
                                                <p className="text-xs font-black text-gray-800 dark:text-white">{f.forums?.name}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }
        </Modal>
    );
};

export default DetailMemberModal;
