import React, { useState, useMemo } from 'react';
import { Member, Foundation, Organization, Group } from '../types';
import { Printer, Search, Filter, BadgeCheck, QrCode, Download, ChevronRight, Activity, Building2, Image as ImageIcon, RefreshCw, X, AlertTriangle, Users } from '../components/ui/Icons';
import { Modal } from '../components/Modal';
import { jsPDF } from 'jspdf';

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
    const [selectedType, setSelectedType] = useState(''); 
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const [isMassPreviewOpen, setIsMassPreviewOpen] = useState(false);
    const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

    const filteredMembers = useMemo(() => {
        return members.filter(m => {
            const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase());
            const matchesOrg = !selectedOrg || m.organization_id === selectedOrg;
            const matchesGroup = !selectedGroup || m.group_id === selectedGroup;
            const matchesType = !selectedType || m.member_type === selectedType;
            return matchesSearch && matchesOrg && matchesGroup && matchesType;
        });
    }, [members, search, selectedOrg, selectedGroup, selectedType]);

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

        canvas.width = 1012;
        canvas.height = 638;

        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        if (isLimaUnsur) { grad.addColorStop(0, '#d97706'); grad.addColorStop(1, '#0f172a'); } 
        else { grad.addColorStop(0, '#2563eb'); grad.addColorStop(1, '#1e1b4b'); }
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalAlpha = 0.15; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(canvas.width * 0.9, 0, 400, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'top'; ctx.font = 'bold 22px Arial'; ctx.globalAlpha = 0.7;
        ctx.fillText('KARTU ANGGOTA DIGITAL', 50, 50); ctx.globalAlpha = 1.0;
        ctx.font = '900 32px Arial'; ctx.fillText(orgName.toUpperCase(), 50, 85);

        ctx.fillStyle = '#ffffff'; ctx.font = '900 48px Arial';
        ctx.fillText(member.full_name.toUpperCase(), 50, canvas.height - 130);
        
        ctx.font = 'bold 22px Courier New'; ctx.globalAlpha = 0.6;
        ctx.fillText(`ID: ${member.id.substring(0, 14).toUpperCase()}`, 50, canvas.height - 75); ctx.globalAlpha = 1.0;
        ctx.font = 'bold 24px Arial'; ctx.fillText(`KELOMPOK: ${groupName}`, 50, canvas.height - 45);

        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${member.id}`;
        qrImg.onload = () => {
            const qrSize = 230;
            const qrX = canvas.width / 2 - qrSize / 2;
            const qrY = canvas.height / 2 - qrSize / 2 - 20;
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30, 25); ctx.fill();
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
            const link = document.createElement('a');
            link.download = `ID_CARD_${member.full_name.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            setIsGenerating(null);
        };
    };

    const downloadMassPDF = async () => {
        if (filteredMembers.length === 0) return;
        setIsDownloadingPDF(true);
        
        try {
            const doc = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
            });

            const cardWidth = 85.6;
            const cardHeight = 53.98;
            const margin = 10;
            const gap = 8;
            const cardsPerPage = 8; // UPDATED: MAX 8 CARDS
            
            for (let i = 0; i < filteredMembers.length; i++) {
                if (i > 0 && i % cardsPerPage === 0) {
                    doc.addPage();
                }

                const member = filteredMembers[i];
                const orgName = organizations.find(o => o.id === member.organization_id)?.name || activeFoundation?.name || 'YAYASAN';
                const groupName = groups.find(g => g.id === member.group_id)?.name || '-';
                const isLimaUnsur = member.member_type === 'Lima Unsur';
                
                const posInPage = i % cardsPerPage;
                const col = posInPage % 2;
                const row = Math.floor(posInPage / 2);
                const x = margin + col * (cardWidth + gap);
                const y = margin + row * (cardHeight + gap);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) continue;

                canvas.width = 1012;
                canvas.height = 638;

                const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                if (isLimaUnsur) { grad.addColorStop(0, '#d97706'); grad.addColorStop(1, '#0f172a'); } 
                else { grad.addColorStop(0, '#2563eb'); grad.addColorStop(1, '#1e1b4b'); }
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.roundRect(0, 0, canvas.width, canvas.height, 40); ctx.fill();

                ctx.globalAlpha = 0.1; ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(canvas.width * 0.9, 0, 400, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1.0;

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 22px Arial'; ctx.globalAlpha = 0.6;
                ctx.fillText('KARTU ANGGOTA', 50, 60); ctx.globalAlpha = 1.0;
                ctx.font = '900 32px Arial'; ctx.fillText(orgName.toUpperCase(), 50, 100);
                ctx.font = '900 52px Arial'; ctx.fillText(member.full_name.toUpperCase(), 50, canvas.height - 130);
                ctx.font = 'bold 24px Courier New'; ctx.globalAlpha = 0.6;
                ctx.fillText(`ID: ${member.id.substring(0,14).toUpperCase()}`, 50, canvas.height - 75);
                ctx.globalAlpha = 1.0;
                ctx.font = 'bold 24px Arial'; ctx.fillText(`KELOMPOK: ${groupName.toUpperCase()}`, 50, canvas.height - 45);

                const qrImg = new Image();
                qrImg.crossOrigin = "anonymous";
                qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${member.id}`;
                
                await new Promise((resolve) => {
                    qrImg.onload = () => {
                        const qrSize = 240;
                        const qrX = canvas.width / 2 - qrSize / 2;
                        const qrY = canvas.height / 2 - qrSize / 2 - 20;
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath(); ctx.roundRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30, 30); ctx.fill();
                        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
                        resolve(null);
                    };
                    qrImg.onerror = () => resolve(null);
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                doc.addImage(imgData, 'JPEG', x, y, cardWidth, cardHeight);
            }

            doc.save(`KARTU_MASAL_${selectedType || 'SEMUA'}.pdf`);
        } catch (err: any) {
            console.error(err);
            alert("Gagal mengunduh PDF: " + err.message);
        } finally {
            setIsDownloadingPDF(false);
        }
    };

    const IDCardRenderer: React.FC<{ member: Member, mode?: 'ui' | 'print' }> = ({ member, mode = 'ui' }) => {
        const orgName = organizations.find(o => o.id === member.organization_id)?.name || activeFoundation?.name || 'YAYASAN';
        const groupName = groups.find(g => g.id === member.group_id)?.name || '-';
        const isLimaUnsur = member.member_type === 'Lima Unsur';

        return (
            <div className={`relative rounded-2xl overflow-hidden shadow-xl bg-slate-900 text-white select-none transition-transform hover:scale-[1.01] ${
                mode === 'print' ? 'w-[85.6mm] h-[53.98mm] shadow-none border border-slate-300 mass-print-card' : 'w-full aspect-[1.58/1]'
            }`}>
                <div className={`absolute inset-0 ${isLimaUnsur ? 'bg-gradient-to-br from-amber-600 via-slate-900 to-amber-900' : 'bg-gradient-to-br from-primary-600 via-slate-900 to-indigo-900'}`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                </div>

                <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-lg border border-white/20"><Activity size={16} className={isLimaUnsur ? 'text-amber-400' : 'text-primary-400'} /></div>
                            <div className="text-left">
                                <h2 className="text-[10px] font-black uppercase tracking-widest leading-none opacity-80 mb-0.5">KARTU ANGGOTA</h2>
                                <p className="text-xs font-bold leading-tight truncate max-w-[180px]">{orgName}</p>
                            </div>
                        </div>
                        <div className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${isLimaUnsur ? 'bg-amber-500 text-slate-900' : 'bg-primary-500 text-white'}`}>{member.member_type || 'Generus'}</div>
                    </div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] flex flex-col items-center gap-2">
                        <div className="bg-white p-1.5 rounded-xl shadow-2xl border-4 border-white/20">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${member.id}`} alt="QR" className="w-16 h-16 object-contain" />
                        </div>
                    </div>

                    <div className="w-full flex flex-col">
                        <p className="text-sm font-black tracking-tight leading-tight uppercase truncate">{member.full_name}</p>
                        <div className="flex items-center gap-2 opacity-80">
                            <span className="text-[9px] font-mono tracking-widest">{member.id.substring(0,8).toUpperCase()}</span>
                            <span className="text-[10px] font-bold border-l border-white/20 pl-2">{groupName}</span>
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
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white !important; margin: 0; padding: 0; }
                    nav, aside, header, .no-print, .modal-header, .modal-overlay { display: none !important; }
                    #root { padding: 0 !important; margin: 0 !important; }
                    main { margin: 0 !important; padding: 0 !important; width: 100% !important; }
                    .mass-print-container { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 99999; background: white; }
                    .mass-print-grid { 
                        display: grid !important; 
                        grid-template-columns: repeat(2, 1fr) !important; 
                        gap: 8mm !important; 
                        padding: 10mm !important;
                    }
                }
            `}</style>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><BadgeCheck className="text-primary-600" /> Cetak Masal Kartu</h2>
                    <p className="text-xs text-gray-500 mt-1">Gunakan filter untuk mencetak kategori tertentu di kertas A4.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => setIsMassPreviewOpen(true)} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-indigo-600/20 transition active:scale-95"><Printer size={20} /> Preview Cetak (A4)</button>
                </div>
            </div>

            <div className="bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center no-print">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Cari nama anggota..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"/>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={14} className="text-gray-400 hidden md:block" />
                    <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="w-full md:w-40 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500 dark:text-white">
                        <option value="">SEMUA TIPE</option>
                        <option value="Generus">GENERUS</option>
                        <option value="Lima Unsur">LIMA UNSUR</option>
                        <option value="Scanner">SCANNER</option>
                    </select>
                </div>

                <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)} className="w-full md:w-40 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500 dark:text-white">
                    <option value="">SEMUA UNIT</option>
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="w-full md:w-40 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500 dark:text-white">
                    <option value="">SEMUA KELOMPOK</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
            </div>

            <div className="flex justify-between items-center no-print px-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={14}/> Menampilkan {filteredMembers.length} Anggota
                </p>
                {selectedType && <span className="text-[10px] font-black bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">FILTER: {selectedType.toUpperCase()}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 no-print">
                {filteredMembers.map(member => (
                    <div key={member.id} className="flex flex-col gap-3 group">
                        <IDCardRenderer member={member} />
                        <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button onClick={() => setSelectedMember(member)} className="flex-1 py-2 bg-white dark:bg-gray-800 text-slate-700 dark:text-white text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition">Detail</button>
                            <button onClick={() => downloadFullCard(member)} disabled={isGenerating === member.id} className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition">{isGenerating === member.id ? <RefreshCw size={16} className="animate-spin" /> : <ImageIcon size={16} />}</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL MASS PREVIEW */}
            <Modal isOpen={isMassPreviewOpen} onClose={() => setIsMassPreviewOpen(false)} title="Simpan Kartu ke PDF (A4)" size="4xl">
                 <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                        <AlertTriangle className="text-blue-600 shrink-0" size={20}/>
                        <div className="text-xs text-blue-800 dark:text-blue-300">
                            <p className="font-bold mb-1">Panduan Simpan ke PDF:</p>
                            <ul className="list-disc ml-4 space-y-0.5">
                                <li>Satu lembar A4 berisi <strong>maksimal 8 kartu</strong> (2 kolom x 4 baris).</li>
                                <li>Klik tombol "Download PDF Sekarang" untuk mendapatkan file secara langsung.</li>
                                <li>Pastikan <strong>Margins</strong> diatur ke <strong>"None"</strong> agar ukuran kartu 85.6mm x 53.98mm.</li>
                            </ul>
                        </div>
                    </div>
                    <div className="flex justify-center gap-3">
                        <button 
                            onClick={downloadMassPDF} 
                            disabled={isDownloadingPDF}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition disabled:opacity-50"
                        >
                            {isDownloadingPDF ? <RefreshCw className="animate-spin" size={18}/> : <Download size={18}/>}
                            {isDownloadingPDF ? 'Sedang Memproses...' : 'Download PDF Sekarang'}
                        </button>
                        <button onClick={() => window.print()} className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition"><Printer size={18}/> Simpan ke PDF (Sistem)</button>
                    </div>
                    <div className="mx-auto w-[210mm] min-h-[297mm] bg-white shadow-2xl p-[10mm] border border-gray-200 overflow-hidden">
                        <div className="text-center border-b pb-4 mb-6 text-black">
                            <h2 className="text-lg font-black uppercase">PREVIEW KERTAS A4 (MAKS 8 KARTU)</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            {filteredMembers.slice(0, 8).map(m => <IDCardRenderer key={m.id} member={m} mode="print" />)}
                        </div>
                    </div>
                 </div>
            </Modal>

            {/* AREA KHUSUS CETAK MASAL */}
            <div className="hidden mass-print-container">
                <div className="mass-print-grid">
                    {filteredMembers.map(member => <IDCardRenderer key={member.id} member={member} mode="print" />)}
                </div>
            </div>

            {/* DETAIL MODAL */}
            {selectedMember && (
                <Modal isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} title="Detail Anggota" size="lg">
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="w-full md:w-1/2">
                            <IDCardRenderer member={selectedMember} />
                        </div>
                        <div className="flex-1 space-y-4">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{selectedMember.full_name}</h3>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"><p className="text-[10px] font-bold text-gray-400 uppercase">Tipe</p><p className="text-sm font-bold text-primary-600 uppercase">{selectedMember.member_type || '-'}</p></div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"><p className="text-[10px] font-bold text-gray-400 uppercase">Organisasi</p><p className="text-sm font-medium">{organizations.find(o => o.id === selectedMember.organization_id)?.name || '-'}</p></div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"><p className="text-[10px] font-bold text-gray-400 uppercase">WhatsApp</p><p className="text-sm font-medium">{selectedMember.phone || '-'}</p></div>
                            </div>
                            <button onClick={() => setSelectedMember(null)} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold transition">Tutup</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
