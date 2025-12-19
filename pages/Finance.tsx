
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Program, Division, Organization, Member } from '../types';
import { FileText, Printer, Filter, Wallet, Building2, Calendar, CalendarDays, User, Edit, Copy, CheckCircle2, AlertTriangle, Check, List, Plus, Trash2, Download } from '../components/ui/Icons';

interface FinanceProps {
  programs: Program[];
  divisions: Division[];
  organizations: Organization[];
  currentUser?: Member | null;
}

type ReportItem = Program & { displayCost: number; duration: number };

// NEW: Manual Item Interface
interface ManualItem {
    id: string;
    name: string;
    description: string;
    cost: number;
}

export const Finance: React.FC<FinanceProps> = ({ programs, divisions, organizations, currentUser }) => {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'REPORT' | 'GENERATOR'>('REPORT');
  
  // Filter States
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(''); 
  const [selectedDivision, setSelectedDivision] = useState<string>(''); 
  const [selectedOrg, setSelectedOrg] = useState<string>('');

  // Signature States
  const [signerName1, setSignerName1] = useState(''); 
  const [signerName2, setSignerName2] = useState(''); 
  const [signerName3, setSignerName3] = useState(''); 
  const [signerTitle1, setSignerTitle1] = useState('Bendahara / Pemohon');
  const [signerTitle2, setSignerTitle2] = useState('Ketua Bidang');
  const [signerTitle3, setSignerTitle3] = useState('Ketua Yayasan');

  // Generator State
  const [letterNumber, setLetterNumber] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0]);
  
  // NEW: Manual Item States
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCost, setNewItemCost] = useState<string>('');

  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
      if (currentUser) {
          setSignerName1(currentUser.full_name);
      }
  }, [currentUser]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const parseMonths = (monthStr: string | null | undefined): string[] => {
    if (!monthStr) return [];
    try {
      const parsed = JSON.parse(monthStr);
      return Array.isArray(parsed) ? parsed : [monthStr];
    } catch (e) {
      return [monthStr];
    }
  };

  // --- DATA LOGIC ---
  const reportData = useMemo<ReportItem[]>(() => {
    return programs.filter(p => {
      if ((p.year || 2024) !== selectedYear) return false;
      if (selectedOrg && p.organization_id !== selectedOrg) return false;
      if (selectedDivision && p.division_id !== selectedDivision) return false;
      if (selectedMonth) {
        const programMonths = parseMonths(p.month);
        // If p.date exists, we check the specific month of the date
        if (p.date) {
             const d = new Date(p.date);
             const mName = allMonths[d.getMonth()];
             // Check if selected month matches either the date's month OR the array (recurring)
             return mName === selectedMonth || programMonths.includes(selectedMonth);
        }
        return programMonths.includes(selectedMonth);
      }
      return true;
    }).map(p => {
        const programMonths = parseMonths(p.month);
        
        // Calculate Duration / Frequency
        let duration = programMonths.length;
        
        // Check for Custom Schedules
        if (p.schedules) {
             try {
                 const s = typeof p.schedules === 'string' ? JSON.parse(p.schedules) : p.schedules;
                 if (Array.isArray(s)) duration = s.length;
             } catch(e) {}
        } else if (p.date && duration <= 1) {
             // Specific single date
             duration = 1;
        }
        
        if (duration === 0) duration = 1; // Fallback

        // Calculate Display Cost
        // p.cost is "Biaya Satuan / Per Bulan"
        let displayCost = p.cost;

        if (selectedMonth) {
            // If viewing a specific month, the cost is just the Monthly Unit Cost
            displayCost = p.cost;
        } else {
            // If viewing Annual Report (No month selected), the cost is Unit * Duration
            displayCost = p.cost * duration;
        }

        return { ...p, displayCost, duration };
    }).sort((a, b) => {
        const divA = divisions.find(d => d.id === a.division_id)?.name || '';
        const divB = divisions.find(d => d.id === b.division_id)?.name || '';
        if (divA < divB) return -1;
        if (divA > divB) return 1;
        return a.name.localeCompare(b.name);
    });
  }, [programs, selectedYear, selectedMonth, selectedDivision, selectedOrg, divisions]);

  const groupedData = useMemo<Record<string, ReportItem[]>>(() => {
      const groups: Record<string, ReportItem[]> = {};
      reportData.forEach(item => {
          const divName = divisions.find(d => d.id === item.division_id)?.name || 'Lain-lain';
          if (!groups[divName]) groups[divName] = [];
          groups[divName].push(item);
      });
      return groups;
  }, [reportData, divisions]);

  const totalEstimate = reportData.reduce((acc, curr) => acc + curr.displayCost, 0);
  const totalManualCost = manualItems.reduce((acc, curr) => acc + curr.cost, 0);
  const grandTotal = totalEstimate + totalManualCost;

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  // --- MANUAL ITEM HANDLERS ---
  const addManualItem = () => {
      if (!newItemName || !newItemCost) {
          showToast("Nama dan Nominal harus diisi", "error");
          return;
      }
      const cost = parseFloat(newItemCost);
      if (isNaN(cost)) {
          showToast("Nominal harus berupa angka", "error");
          return;
      }

      setManualItems([...manualItems, {
          id: Date.now().toString(),
          name: newItemName,
          description: 'Input Manual',
          cost: cost
      }]);
      setNewItemName('');
      setNewItemCost('');
  };

  const removeManualItem = (id: string) => {
      setManualItems(manualItems.filter(item => item.id !== id));
  };

  // --- PRINT LOGIC (REPORT TAB) ---
  const handlePrintReport = () => {
    const orgName = organizations.find(o => o.id === selectedOrg)?.name || 'YAYASAN PENDIDIKAN';
    const titleTime = selectedMonth ? `BULAN ${selectedMonth.toUpperCase()} ${selectedYear}` : `TAHUN ${selectedYear}`;
    const divName = selectedDivision ? divisions.find(d => d.id === selectedDivision)?.name?.toUpperCase() : 'SEMUA BIDANG';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up diblokir.");
        return;
    }

    const rowsHtml = Object.entries(groupedData).map(([divName, items]: [string, ReportItem[]]) => {
        const itemsHtml = items.map((item, i) => {
            const monthsList = parseMonths(item.month).map(m => m.substring(0,3)).join(', ');
            return `
            <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td>
                    <strong>${item.name}</strong>
                    <div style="font-size: 10px; color: #666; margin-top: 2px;">Waktu: ${monthsList}</div>
                </td>
                <td>${item.description || '-'}</td>
                <td style="text-align: right;">${formatCurrency(item.displayCost)}</td>
            </tr>
        `}).join('');

        const subTotal = items.reduce((acc, curr) => acc + curr.displayCost, 0);
        return `
            <tr style="background-color: #f3f4f6; font-weight: bold;">
                <td colspan="4" style="padding: 8px;">BIDANG: ${divName}</td>
            </tr>
            ${itemsHtml}
            <tr style="font-weight: bold; background-color: #fff;">
                <td colspan="3" style="text-align: right; padding-right: 10px;">Subtotal ${divName}</td>
                <td style="text-align: right;">${formatCurrency(subTotal)}</td>
            </tr>
        `;
    }).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Laporan Pengajuan Keuangan</title>
          <style>
            @page { size: A4; margin: 2cm; }
            body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid black; padding-bottom: 15px; color: black; }
            .header h1 { margin: 0; font-size: 16pt; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; }
            .header h2 { margin: 5px 0; font-size: 14pt; font-weight: normal; }
            .header p { margin: 0; font-size: 10pt; font-style: italic; }
            .report-title { text-align: center; margin-bottom: 20px; text-decoration: underline; font-weight: bold; font-size: 12pt; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11pt; }
            th, td { border: 1px solid black; padding: 8px; vertical-align: top; }
            th { background-color: #e5e7eb; font-weight: bold; text-align: center; }
            .signatures { margin-top: 60px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .sig-block { text-align: center; width: 30%; }
            .sig-title { margin-bottom: 70px; font-weight: normal; }
            .sig-line { border-top: 1px solid black; padding-top: 5px; font-weight: bold; margin: 0 10px; }
            .footer-info { margin-top: 40px; font-size: 9pt; border-top: 1px solid black; padding-top: 5px; color: black; }
            @media print { body { padding: 0; } .header { border-bottom: 2px solid black !important; color: black !important; } th { background-color: #e5e7eb !important; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${orgName}</h1>
            <h2>PENGAJUAN ANGGARAN KEUANGAN</h2>
            <p>Sistem Informasi Manajemen E-Yayasan</p>
          </div>
          <div class="report-title">RINCIAN PENGAJUAN DANA ${divName}<br/>PERIODE: ${titleTime}</div>
          <table>
            <thead><tr><th style="width: 5%;">No</th><th style="width: 35%;">Uraian Kegiatan</th><th style="width: 35%;">Keterangan</th><th style="width: 25%;">Nominal</th></tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="4" style="text-align:center;">Tidak ada data.</td></tr>'}</tbody>
            <tfoot><tr style="background-color: #d1fae5; font-weight: bold;"><td colspan="3" style="text-align: right; padding-right: 10px;">TOTAL PENGAJUAN</td><td style="text-align: right;">${formatCurrency(totalEstimate)}</td></tr></tfoot>
          </table>
          <div class="signatures">
            <div class="sig-block"><div class="sig-title">Diajukan Oleh,<br/>${signerTitle1}</div><div class="sig-line">${signerName1}</div></div>
            <div class="sig-block"><div class="sig-title">Mengetahui,<br/>${signerTitle2}</div><div class="sig-line">${signerName2}</div></div>
            <div class="sig-block"><div class="sig-title">Disetujui Oleh,<br/>${signerTitle3}</div><div class="sig-line">${signerName3}</div></div>
          </div>
          <div class="footer-info">
             Dicetak pada: ${new Date().toLocaleString('id-ID')}
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => { if (printWindow) { printWindow.focus(); printWindow.print(); } }, 500);
    showToast("Membuka dialog cetak...", "success");
  };

  // --- COPY TEXT LOGIC (REPORT TAB) ---
  const copyReportText = () => {
      const orgName = organizations.find(o => o.id === selectedOrg)?.name || 'YAYASAN';
      const titleTime = selectedMonth ? `BULAN ${selectedMonth.toUpperCase()} ${selectedYear}` : `TAHUN ${selectedYear}`;
      
      let text = `*PENGAJUAN ANGGARAN KEUANGAN*\n`;
      text += `*${orgName.toUpperCase()}*\n`;
      text += `PERIODE: ${titleTime}\n\n`;

      Object.entries(groupedData).forEach(([divName, items]: [string, ReportItem[]]) => {
          text += `*BIDANG: ${divName.toUpperCase()}*\n`;
          let subTotal = 0;
          items.forEach((item, i) => {
              text += `${i+1}. ${item.name} - ${formatCurrency(item.displayCost)}\n`;
              if(item.description) text += `   _(${item.description})_\n`;
              subTotal += item.displayCost;
          });
          text += `*Subtotal: ${formatCurrency(subTotal)}*\n\n`;
      });

      text += `--------------------------------\n`;
      text += `*TOTAL PENGAJUAN: ${formatCurrency(totalEstimate)}*\n`;
      
      navigator.clipboard.writeText(text);
      showToast("Teks laporan berhasil disalin (Format WA)!", "success");
  };

  // --- PRINT PDF LOGIC (GENERATOR TAB) ---
  const handlePrintGenerator = () => {
    const orgName = organizations.find(o => o.id === selectedOrg)?.name || 'YAYASAN PENDIDIKAN';
    const dateStr = new Date(letterDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Combine Data
    const allItems = [
        ...reportData.map(p => ({ name: p.name, desc: p.description, cost: p.displayCost, type: 'Program' })),
        ...manualItems.map(m => ({ name: m.name, desc: m.description, cost: m.cost, type: 'Manual' }))
    ];

    const rowsHtml = allItems.map((item, i) => `
        <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td>
                <strong>${item.name}</strong>
                ${item.type === 'Manual' ? '<span style="font-size: 10px; color: #666; margin-left: 5px;">(Tambahan)</span>' : ''}
            </td>
            <td>${item.desc || '-'}</td>
            <td style="text-align: right;">${formatCurrency(item.cost)}</td>
        </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up diblokir.");
        return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Surat Permohonan Pencairan Dana</title>
          <style>
            @page { size: A4; margin: 2.5cm; }
            body { font-family: 'Times New Roman', serif; color: #000; line-height: 1.5; font-size: 12pt; }
            .header { text-align: center; border-bottom: 3px double black; padding-bottom: 10px; margin-bottom: 20px; color: black; }
            .header h1 { margin: 0; font-size: 16pt; text-transform: uppercase; font-weight: bold; }
            .header p { margin: 0; font-size: 11pt; }
            
            .meta-table { width: 100%; margin-bottom: 20px; border: none; }
            .meta-table td { padding: 2px; vertical-align: top; border: none; }
            
            .content { text-align: justify; margin-bottom: 15px; }
            
            .data-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11pt; }
            .data-table th, .data-table td { border: 1px solid black; padding: 6px; vertical-align: top; }
            .data-table th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
            
            .signatures { margin-top: 50px; display: flex; justify-content: flex-end; }
            .sig-block { text-align: center; width: 200px; }
            .sig-name { margin-top: 70px; font-weight: bold; text-decoration: underline; }
            
            .footer-info { margin-top: 40px; font-size: 9pt; border-top: 1px solid black; padding-top: 5px; color: black; }

            @media print { body { padding: 0; } .header { border-bottom: 3px double black !important; color: black !important; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${orgName}</h1>
            <p>Sekretariat: Jl. Pendidikan No. 123, Kota, Indonesia</p>
          </div>

          <table class="meta-table">
            <tr><td width="130">Nomor</td><td width="10">:</td><td>${letterNumber || '.../...'}</td></tr>
            <tr><td>Lampiran</td><td>:</td><td>1 Berkas</td></tr>
            <tr><td>Perihal</td><td>:</td><td><strong>Permohonan Pencairan Dana</strong></td></tr>
            <tr><td>Nomor Pengajuan</td><td>:</td><td>REQ-${Date.now().toString().slice(-6)}</td></tr>
          </table>

          <br/>
          
          <div>
            Kepada Yth,<br/>
            <strong>Ketua / Bendahara Umum Yayasan</strong><br/>
            Di Tempat
          </div>

          <br/>

          <div class="content">
            <p>Assalamu’alaikum Warahmatullahi Wabarakatuh,</p>
            <p>Puji syukur kita panjatkan kehadirat Allah SWT. Sholawat serta salam semoga senantiasa tercurah kepada Nabi Muhammad SAW.</p>
            <p>Sehubungan dengan pelaksanaan program kerja, bersama ini kami mengajukan permohonan pencairan dana anggaran dengan rincian sebagai berikut:</p>
          </div>

          <table class="data-table">
            <thead>
                <tr>
                    <th width="5%">No</th>
                    <th>Uraian Kegiatan</th>
                    <th>Keterangan</th>
                    <th width="20%">Nominal</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="4" style="text-align:center;">Tidak ada item pengajuan.</td></tr>'}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="text-align: right; font-weight: bold;">TOTAL PENGAJUAN</td>
                    <td style="text-align: right; font-weight: bold;">${formatCurrency(grandTotal)}</td>
                </tr>
            </tfoot>
          </table>

          <div class="content">
            <p>Demikian surat permohonan ini kami sampaikan. Atas perhatian dan persetujuannya kami ucapkan terima kasih.</p>
            <p>Wassalamu’alaikum Warahmatullahi Wabarakatuh.</p>
          </div>

          <div style="margin-top: 20px;">
             ${dateStr}
          </div>

          <div class="signatures">
             <div class="sig-block">
                <div>Hormat Kami,<br/>${signerTitle1}</div>
                <div class="sig-name">${signerName1}</div>
             </div>
          </div>

          <div class="footer-info">
             Dicetak pada: ${new Date().toLocaleString('id-ID')} | No. Ref: REQ-${Date.now().toString().slice(-6)}
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => { if (printWindow) { printWindow.focus(); printWindow.print(); } }, 500);
  };

  const copyGeneratorText = () => {
      const orgName = organizations.find(o => o.id === selectedOrg)?.name || 'Yayasan';
      const dateStr = new Date(letterDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      
      let text = `Nomor: ${letterNumber || '.../...'}\n`;
      text += `Perihal: Permohonan Pencairan Dana\n\n`;
      text += `Kepada Yth,\nKetua/Bendahara Umum\n${orgName}\nDi Tempat\n\n`;
      text += `Assalamu’alaikum Warahmatullahi Wabarakatuh\n\n`;
      text += `Bersama surat ini, kami mengajukan permohonan pencairan dana untuk kegiatan/program kerja sebagai berikut:\n\n`;
      
      // Add Program Items
      let counter = 1;
      reportData.forEach((item) => {
          text += `${counter}. ${item.name} - ${formatCurrency(item.displayCost)}\n   (${item.description || 'Operasional'})\n`;
          counter++;
      });

      // Add Manual Items
      manualItems.forEach((item) => {
          text += `${counter}. ${item.name} (Manual) - ${formatCurrency(item.cost)}\n   (${item.description})\n`;
          counter++;
      });

      text += `\nTotal Pengajuan: ${formatCurrency(grandTotal)}\n\n`;
      text += `Demikian permohonan ini kami sampaikan. Atas perhatian dan persetujuannya kami ucapkan terima kasih.\n\n`;
      text += `Wassalamu’alaikum Warahmatullahi Wabarakatuh\n\n`;
      text += `${orgName}, ${dateStr}\n\n`;
      text += `Hormat Kami,\n\n`;
      text += `( ${signerName1 || 'Nama Pemohon'} )`;

      navigator.clipboard.writeText(text);
      showToast("Teks surat berhasil disalin!", "success");
  };

  return (
    <div className="space-y-6">
       {/* TOAST */}
       {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="text-sm font-medium">{toast.message}</span>
          </div>
       )}

       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FileText className="text-primary-600 dark:text-primary-400" /> Pengajuan Keuangan
        </h2>
      </div>

      {/* --- FILTERS --- */}
      <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border shadow-sm">
         <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-100 dark:border-dark-border pb-2">
            <Filter size={18} /> Filter Laporan
         </div>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
               <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Organisasi</label>
               <div className="relative">
                 <Building2 size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                 <select 
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                 >
                    <option value="">Semua Organisasi</option>
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                 </select>
               </div>
            </div>
            <div>
               <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Tahun Anggaran</label>
               <div className="relative">
                 <Calendar size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                 <input 
                    type="number"
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                 />
               </div>
            </div>
            <div>
               <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Bulan Pengajuan</label>
               <div className="relative">
                 <CalendarDays size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                 <select 
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                 >
                    <option value="">Semua Bulan (Tahunan)</option>
                    {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
               </div>
            </div>
            <div>
               <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Bidang (Divisi)</label>
               <div className="relative">
                 <Filter size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                 <select 
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    value={selectedDivision}
                    onChange={(e) => setSelectedDivision(e.target.value)}
                 >
                    <option value="">Semua Bidang</option>
                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                 </select>
               </div>
            </div>
         </div>
      </div>

      {/* --- SIGNATURE SETTINGS (MOVED UP) --- */}
      <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border shadow-sm">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-dark-border pb-2">
              <Edit size={16} /> Konfigurasi Tanda Tangan
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                  <input type="text" value={signerTitle1} onChange={e => setSignerTitle1(e.target.value)} className="w-full text-xs font-bold text-gray-500 bg-transparent border-b border-dashed border-gray-300 outline-none text-center" placeholder="Jabatan 1"/>
                  <div className="relative"><User size={14} className="absolute left-3 top-2.5 text-gray-400"/><input type="text" value={signerName1} onChange={e => setSignerName1(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 outline-none" placeholder="Nama 1"/></div>
              </div>
              <div className="space-y-2">
                  <input type="text" value={signerTitle2} onChange={e => setSignerTitle2(e.target.value)} className="w-full text-xs font-bold text-gray-500 bg-transparent border-b border-dashed border-gray-300 outline-none text-center" placeholder="Jabatan 2"/>
                  <div className="relative"><User size={14} className="absolute left-3 top-2.5 text-gray-400"/><input type="text" value={signerName2} onChange={e => setSignerName2(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 outline-none" placeholder="Nama 2"/></div>
              </div>
              <div className="space-y-2">
                  <input type="text" value={signerTitle3} onChange={e => setSignerTitle3(e.target.value)} className="w-full text-xs font-bold text-gray-500 bg-transparent border-b border-dashed border-gray-300 outline-none text-center" placeholder="Jabatan 3"/>
                  <div className="relative"><User size={14} className="absolute left-3 top-2.5 text-gray-400"/><input type="text" value={signerName3} onChange={e => setSignerName3(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 outline-none" placeholder="Nama 3"/></div>
              </div>
          </div>
      </div>

      {/* --- TABS --- */}
      <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-fit">
          <button 
            onClick={() => setActiveTab('REPORT')}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition ${activeTab === 'REPORT' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
          >
              <FileText size={16} /> Laporan Realisasi
          </button>
          <button 
            onClick={() => setActiveTab('GENERATOR')}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition ${activeTab === 'GENERATOR' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
          >
              <List size={16} /> Pengajuan Generator
          </button>
      </div>
      
      {/* --- TAB CONTENT: REPORT PREVIEW (DOCUMENT STYLE) --- */}
      {activeTab === 'REPORT' && (
          <div className="bg-gray-100 dark:bg-dark-bg p-4 md:p-8 flex justify-center overflow-auto rounded-xl border border-gray-200 dark:border-dark-border">
              <div className="bg-white shadow-lg w-full max-w-[21cm] p-[2cm] min-h-[29.7cm] text-black">
                  {/* Document Header */}
                  <div className="text-center mb-8 border-b-2 border-black pb-4">
                      <h1 className="text-xl font-bold uppercase tracking-wider">{organizations.find(o => o.id === selectedOrg)?.name || 'YAYASAN PENDIDIKAN'}</h1>
                      <h2 className="text-lg font-medium">PENGAJUAN ANGGARAN KEUANGAN</h2>
                      <p className="text-sm italic">Sistem Informasi Manajemen E-Yayasan</p>
                  </div>

                  <div className="text-center mb-6">
                      <h3 className="underline font-bold uppercase">RINCIAN PENGAJUAN DANA {selectedDivision ? divisions.find(d => d.id === selectedDivision)?.name : 'SEMUA BIDANG'}</h3>
                      <p className="uppercase text-sm">PERIODE: {selectedMonth ? `BULAN ${selectedMonth} ${selectedYear}` : `TAHUN ${selectedYear}`}</p>
                  </div>

                  {/* Document Table */}
                  <table className="w-full border-collapse border border-black text-sm">
                      <thead>
                          <tr className="bg-gray-200">
                              <th className="border border-black px-2 py-1 text-center w-10">No</th>
                              <th className="border border-black px-2 py-1 text-left">Uraian Kegiatan</th>
                              <th className="border border-black px-2 py-1 text-left">Keterangan</th>
                              <th className="border border-black px-2 py-1 text-right">Nominal (Rp)</th>
                          </tr>
                      </thead>
                      <tbody>
                          {Object.entries(groupedData).map(([divName, items]: [string, ReportItem[]]) => {
                              const subTotal = items.reduce((acc, curr) => acc + curr.displayCost, 0);
                              return (
                                  <React.Fragment key={divName}>
                                      <tr className="bg-gray-100">
                                          <td colSpan={4} className="border border-black px-2 py-1 font-bold uppercase text-xs">BIDANG: {divName}</td>
                                      </tr>
                                      {items.map((item, idx) => (
                                          <tr key={item.id}>
                                              <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                                              <td className="border border-black px-2 py-1">
                                                  {item.name}
                                                  <div className="text-[10px] text-gray-500 italic">Waktu: {parseMonths(item.month).join(', ')}</div>
                                              </td>
                                              <td className="border border-black px-2 py-1 italic">{item.description}</td>
                                              <td className="border border-black px-2 py-1 text-right">{formatCurrency(item.displayCost)}</td>
                                          </tr>
                                      ))}
                                      <tr>
                                          <td colSpan={3} className="border border-black px-2 py-1 text-right font-bold text-xs">Subtotal {divName}</td>
                                          <td className="border border-black px-2 py-1 text-right font-bold">{formatCurrency(subTotal)}</td>
                                      </tr>
                                  </React.Fragment>
                              )
                          })}
                          {reportData.length === 0 && <tr><td colSpan={4} className="border border-black p-4 text-center italic">Tidak ada data.</td></tr>}
                      </tbody>
                      <tfoot>
                          <tr className="bg-green-100">
                              <td colSpan={3} className="border border-black px-2 py-2 text-right font-bold">TOTAL PENGAJUAN</td>
                              <td className="border border-black px-2 py-2 text-right font-bold text-lg">{formatCurrency(totalEstimate)}</td>
                          </tr>
                      </tfoot>
                  </table>

                  <div className="signatures">
                      <div className="sig-block">
                          <div className="sig-title">Diajukan Oleh,<br/>{signerTitle1}</div>
                          <br/><br/><br/>
                          <div className="sig-line">{signerName1}</div>
                      </div>
                      <div className="sig-block">
                          <div className="sig-title">Mengetahui,<br/>{signerTitle2}</div>
                          <br/><br/><br/>
                          <div className="sig-line">{signerName2}</div>
                      </div>
                      <div className="sig-block">
                          <div className="sig-title">Disetujui Oleh,<br/>{signerTitle3}</div>
                          <br/><br/><br/>
                          <div className="sig-line">{signerName3}</div>
                      </div>
                  </div>
              </div>
              
              {/* Actions */}
              <div className="fixed bottom-6 right-6 flex flex-col gap-2 no-print">
                  <button onClick={handlePrintReport} className="bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-full shadow-lg transition" title="Cetak / PDF">
                      <Printer size={24} />
                  </button>
                  <button onClick={copyReportText} className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full shadow-lg transition" title="Salin Text (WA)">
                      <Copy size={24} />
                  </button>
              </div>
          </div>
      )}

      {/* --- TAB CONTENT: GENERATOR (FORM STYLE) --- */}
      {activeTab === 'GENERATOR' && (
          <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                      <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><FileText size={16}/> Informasi Surat</h4>
                      {/* ROW LAYOUT FOR DATE & NUMBER */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nomor Surat</label>
                              <input 
                                type="text" 
                                value={letterNumber}
                                onChange={(e) => setLetterNumber(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="001/PENG/X/2024"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tanggal Surat</label>
                              <input 
                                type="date" 
                                value={letterDate}
                                onChange={(e) => setLetterDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary-500"
                              />
                          </div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><List size={16}/> Item Tambahan (Manual)</h4>
                      <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Nama Item..." 
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <input 
                            type="number" 
                            placeholder="Nominal..." 
                            value={newItemCost}
                            onChange={(e) => setNewItemCost(e.target.value)}
                            className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <button onClick={addManualItem} className="bg-primary-600 text-white p-2 rounded hover:bg-primary-700 transition">
                              <Plus size={18} />
                          </button>
                      </div>
                      
                      {manualItems.length > 0 && (
                          <ul className="space-y-2 max-h-40 overflow-y-auto">
                              {manualItems.map(item => (
                                  <li key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm">
                                      <span>{item.name} - <strong>{formatCurrency(item.cost)}</strong></span>
                                      <button onClick={() => removeManualItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                  </li>
                              ))}
                          </ul>
                      )}
                  </div>
              </div>

              {/* PREVIEW TOTAL */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center mb-6">
                  <div>
                      <p className="text-xs text-blue-600 dark:text-blue-300 font-bold uppercase">Total Pengajuan (Program + Manual)</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-100">{formatCurrency(grandTotal)}</p>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={handlePrintGenerator} className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2">
                          <Printer size={16}/> Cetak Surat
                      </button>
                      <button onClick={copyGeneratorText} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
                          <Copy size={16}/> Salin Teks
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
