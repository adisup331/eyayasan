import React, { useState, useMemo } from 'react';
import { Member, Foundation, Organization, Group } from '../types';
import { Printer, Search, Filter, BadgeCheck, QrCode, Download, ChevronRight, Activity, Building2, Image as ImageIcon, RefreshCw } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface MemberCardsProps {
    members: Member[];
    activeFoundation: Foundation | null;
    organizations: Organization[];
    groups: Group[];
}

export const MemberCards: React.FC<MemberCardsProps> = ({ members, activeFoundation, organizations, groups }) => {
    const [search, setSearch] = useState('');
    const [selectedOrg, setSelectedOrg] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [isGenerating, setIsGenerating] = useState<string | null>(null);

    const filteredMembers = useMemo(() => {
        return members.filter(m => {
            const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase());
            const matchesOrg = !selectedOrg || m.organization_id === selectedOrg;
            const matchesGroup = !selectedGroup || m.group_id === selectedGroup;
            return matchesSearch && matchesOrg && matchesGroup;
        });
    }, [members, search, selectedOrg, selectedGroup]);

    const handlePrint = () => {
        window.print();
    };

    const downloadFullCard = (member: Member) => {
        setIsGenerating(member.id);
        const orgName = organizations.find(o => o.id === member.organization_id)?.name || activeFoundation?.name || 'YAYASAN';
        const groupName = groups.find(g => g.id === member.group_id)?.name || '-';
        const isLimaUnsur = member.member_type === 'Lima Unsur';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Dimensi kartu standard (85.6mm x 53.98mm) dikali faktor untuk high-res
        canvas.width = 1012;
        canvas.height = 638;

        // 1. Background Gradient
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        if (isLimaUnsur) {
            grad.addColorStop(0, '#d97706'); // amber-600
            grad.addColorStop(1, '#0f172a'); // slate-900
        } else {
            grad.addColorStop(0, '#2563eb'); // primary-600
            grad.addColorStop(1, '#1e1b4b'); // indigo-950
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Dekorasi (Lingkaran halus)
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(canvas.width * 0.9, 0, 400, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(100, canvas.height, 250, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // 3. Header Text
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.globalAlpha = 0.7;
        ctx.fillText('KARTU ANGGOTA DIGITAL', 50, 50);
        ctx.globalAlpha = 1.0;
        
        ctx.font = '900 32px Arial, sans-serif';
        ctx.fillText(orgName.toUpperCase(), 50, 85);

        // 4. Badge Tipe
        const badgeText = (member.member_type || 'Generus').toUpperCase();
        ctx.font = 'bold 20px Arial, sans-serif';
        const textWidth = ctx.measureText(badgeText).width;
        const badgeW = textWidth + 30;
        const badgeH = 40;
        const badgeX = canvas.width - badgeW - 50;
        const badgeY = 50;
        
        ctx.fillStyle = isLimaUnsur ? '#f59e0b' : '#3b82f6';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 20);
        ctx.fill();
        ctx.fillStyle = isLimaUnsur ? '#0f172a' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, badgeX + badgeW/2, badgeY + 10);
        ctx.textAlign = 'left';

        // 5. Nama & ID (Bawah)
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 48px Arial, sans-serif';
        ctx.fillText(member.full_name.toUpperCase(), 50, canvas.height - 130);
        
        ctx.font = 'bold 22px Courier New, monospace';
        ctx.globalAlpha = 0.6;
        ctx.fillText(`ID: ${member.id.substring(0, 14).toUpperCase()}`, 50, canvas.height - 75);
        ctx.globalAlpha = 1.0;
        
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText(`KELOMPOK: ${groupName}`, 50, canvas.height - 45);

        // 6. Draw QR Code (Async)
        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${member.id}`;
        qrImg.onload = () => {
            const qrSize = 230;
            const qrX = canvas.width / 2 - qrSize / 2;
            const qrY = canvas.height / 2 - qrSize / 2 - 20;

            // Background putih untuk QR agar terbaca
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30, 25);
            ctx.fill();
            
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            // Trigger Download
            const link = document.createElement('a');
            link.download = `ID_CARD_${member.full_name.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            setIsGenerating(null);
        };
        qrImg.onerror = () => {
            alert("Gagal memuat QR Code. Coba lagi nanti.");
            setIsGenerating(null);
        };
    };

    // Added type React.FC to support React intrinsic props like 'key' in map functions
    const IDCard: React.FC<{ member: Member, size?: 'normal' | 'small' | 'print' }> = ({ member, size = 'normal' }) => {
        const orgName = organizations.find(o => o.id === member.organization_id)?.name || activeFoundation?.name || 'YAYASAN';
        const groupName = groups.find(g => g.id === member.group_id)?.name || '-';
        const isLimaUnsur = member.member_type === 'Lima Unsur';

        return (
            <div className={`relative rounded-2xl overflow-hidden shadow-xl bg-slate-900 text-white select-none transition-transform hover:scale-[1.01] ${
                size === 'print' ? 'w-[85.6mm] h-[53.98mm] shadow-none border border-slate-200 print-card' : 
                size === 'small' ? 'w-full aspect-[1.58/1]' : 'w-full max-w-md aspect-[1.58/1]'
            }`}>
                {/* Desain Latar Belakang */}
                <div className={`absolute inset-0 opacity-100 ${isLimaUnsur ? 'bg-gradient-to-br from-amber-600 via-slate-900 to-amber-900' : 'bg-gradient-to-br from-primary-600 via-slate-900 to-indigo-900'}`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3"></div>
                </div>

                <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-lg border border-white/20">
                                <Activity size={16} className={isLimaUnsur ? 'text-amber-400' : 'text-primary-400'} />
                            </div>
                            <div className="text-left">
                                <h2 className="text-[10px] font-black uppercase tracking-widest leading-none opacity-80 mb-0.5">KARTU ANGGOTA</h2>
                                <p className="text-xs font-bold leading-tight truncate max-w-[180px]">{orgName}</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <div className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${isLimaUnsur ? 'bg-amber-500 text-slate-900' : 'bg-primary-500 text-white'}`}>
                                {member.member_type || 'Generus'}
                             </div>
                        </div>
                    </div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] flex flex-col items-center gap-2">
                        <div className="bg-white p-1.5 rounded-xl shadow-2xl border-4 border-white/20">
                            <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${member.id}`} 
                                alt="QR" 
                                className="w-20 h-20 object-contain"
                            />
                        </div>
                    </div>

                    <div className="w-full flex justify-between items-end">
                        <div className="flex flex-col">
                            <p className="text-sm font-black tracking-tight leading-tight mb-0.5 drop-shadow-md">{member.full_name.toUpperCase()}</p>
                            <div className="flex items-center gap-2 opacity-80">
                                <span className="text-[9px] font-mono tracking-widest">{member.id.substring(0,8).toUpperCase()}</span>
                                <span className="text-[10px] font-bold border-l border-white/20 pl-2">{groupName}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <style>{`
                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 10mm; 
                    }
                    body { 
                        background: white !important; 
                        margin: 0; 
                        padding: 0;
                    }
                    nav, aside, header, .no-print, footer { 
                        display: none !important; 
                    }
                    main {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-layout { 
                        display: grid !important; 
                        grid-template-columns: repeat(2, 1fr) !important; 
                        gap: 8mm !important;
                        width: 100% !important;
                    }
                    .print-card { 
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <BadgeCheck className="text-primary-600" /> Digital ID & Kartu Anggota
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Kelola, cetak, dan bagikan kartu identitas digital anggota.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handlePrint} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-indigo-600/20 transition active:scale-95">
                        <Printer size={18} /> Cetak Masal (A4)
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center no-print">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Cari nama anggota..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                    />
                </div>
                <select 
                    value={selectedOrg} 
                    onChange={e => setSelectedOrg(e.target.value)}
                    className="w-full md:w-48 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                >
                    <option value="">Semua Unit</option>
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <select 
                    value={selectedGroup} 
                    onChange={e => setSelectedGroup(e.target.value)}
                    className="w-full md:w-48 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                >
                    <option value="">Semua Kelompok</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 no-print">
                {filteredMembers.map(member => (
                    <div key={member.id} className="flex flex-col gap-3 group">
                        <IDCard member={member} />
                        <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button 
                                onClick={() => setSelectedMember(member)}
                                className="flex-1 py-2 bg-white dark:bg-gray-800 text-slate-700 dark:text-white text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-1"
                            >
                                Detail
                            </button>
                            <button 
                                onClick={() => downloadFullCard(member)}
                                disabled={isGenerating === member.id}
                                className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition"
                                title="Download Full Kartu"
                            >
                                {isGenerating === member.id ? <RefreshCw size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                            </button>
                            <a 
                                href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${member.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-100 transition"
                                title="Download QR Saja"
                            >
                                <QrCode size={16} />
                            </a>
                        </div>
                    </div>
                ))}
                {filteredMembers.length === 0 && (
                    <div className="col-span-full py-20 text-center text-gray-400 italic">
                        Tidak ada data anggota ditemukan.
                    </div>
                )}
            </div>

            {/* AREA KHUSUS CETAK - Hanya muncul saat diprint */}
            <div className="hidden print:grid print-layout">
                {filteredMembers.map(member => (
                    <IDCard key={member.id} member={member} size="print" />
                ))}
            </div>

            {selectedMember && (
                <Modal isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} title="Manajemen Identitas" size="lg">
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="w-full md:w-1/2">
                            <IDCard member={selectedMember} />
                            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Opsi Unduh</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => downloadFullCard(selectedMember)}
                                        className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition text-indigo-600"
                                    >
                                        {isGenerating === selectedMember.id ? <RefreshCw className="animate-spin" /> : <ImageIcon />}
                                        <span className="text-[10px] font-bold">Kartu Lengkap</span>
                                    </button>
                                    <a 
                                        href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${selectedMember.id}`}
                                        download={`QR_${selectedMember.full_name}.png`}
                                        className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition text-green-600"
                                    >
                                        <QrCode />
                                        <span className="text-[10px] font-bold">Hanya QR</span>
                                    </a>
                                </div>
                                <button onClick={handlePrint} className="w-full mt-3 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                    <Printer size={14}/> Cetak / PDF
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 space-y-6">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white">{selectedMember.full_name}</h3>
                                <p className="text-primary-600 font-bold">{selectedMember.member_type}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Login</p>
                                    <p className="text-sm font-medium truncate">{selectedMember.email}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Unit</p>
                                    <p className="text-sm font-medium">{organizations.find(o => o.id === selectedMember.organization_id)?.name || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Kelompok</p>
                                    <p className="text-sm font-medium">{groups.find(g => g.id === selectedMember.group_id)?.name || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">WhatsApp</p>
                                    <p className="text-sm font-medium">{selectedMember.phone || '-'}</p>
                                </div>
                            </div>
                            <div className="pt-6 border-t dark:border-gray-700">
                                <button onClick={() => setSelectedMember(null)} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold transition active:scale-95">Tutup</button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};