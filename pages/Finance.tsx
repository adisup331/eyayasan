import React, { useState, useMemo } from 'react';
import { Program, Division, Organization } from '../types';
import { FileText, Printer, Filter, Wallet, Building2, Calendar, CalendarDays } from '../components/ui/Icons';

interface FinanceProps {
  programs: Program[];
  divisions: Division[];
  organizations: Organization[];
}

type ReportItem = Program & { displayCost: number };

export const Finance: React.FC<FinanceProps> = ({ programs, divisions, organizations }) => {
  // Filter States
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // Empty means "All Months" (Yearly Report)
  const [selectedDivision, setSelectedDivision] = useState<string>(''); // Empty means "All Divisions"
  const [selectedOrg, setSelectedOrg] = useState<string>('');

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Helper: Parse JSON Months
  const parseMonths = (monthStr: string): string[] => {
    try {
      const parsed = JSON.parse(monthStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  // --- FILTER LOGIC ---
  const reportData = useMemo<ReportItem[]>(() => {
    return programs.filter(p => {
      // 1. Filter Year
      if ((p.year || 2024) !== selectedYear) return false;

      // 2. Filter Organization
      if (selectedOrg && p.organization_id !== selectedOrg) return false;

      // 3. Filter Division
      if (selectedDivision && p.division_id !== selectedDivision) return false;

      // 4. Filter Month (Crucial Logic)
      if (selectedMonth) {
        const programMonths = parseMonths(p.month);
        // Program must include the selected month
        return programMonths.includes(selectedMonth);
      }

      return true;
    }).map(p => {
        // Calculate Cost to Show
        const programMonths = parseMonths(p.month);
        const duration = programMonths.length || 1;
        
        // If a specific month is selected, we assume we only submit cost for THAT month (Unit Cost)
        // If no month selected (Yearly), we show Total Cost
        const displayCost = selectedMonth ? (p.cost / duration) : p.cost;

        return {
            ...p,
            displayCost
        };
    }).sort((a, b) => {
        // Sort by Division then Name
        const divA = divisions.find(d => d.id === a.division_id)?.name || '';
        const divB = divisions.find(d => d.id === b.division_id)?.name || '';
        if (divA < divB) return -1;
        if (divA > divB) return 1;
        return a.name.localeCompare(b.name);
    });
  }, [programs, selectedYear, selectedMonth, selectedDivision, selectedOrg, divisions]);

  // Group by Division for the Report
  const groupedData = useMemo(() => {
      const groups: Record<string, ReportItem[]> = {};
      reportData.forEach(item => {
          const divName = divisions.find(d => d.id === item.division_id)?.name || 'Lain-lain';
          if (!groups[divName]) groups[divName] = [];
          groups[divName].push(item);
      });
      return groups;
  }, [reportData, divisions]);

  const totalEstimate = reportData.reduce((acc, curr) => acc + curr.displayCost, 0);

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  // --- PRINT FUNCTION ---
  const handlePrint = () => {
    const orgName = organizations.find(o => o.id === selectedOrg)?.name || 'YAYASAN PENDIDIKAN';
    const titleTime = selectedMonth ? `BULAN ${selectedMonth.toUpperCase()} ${selectedYear}` : `TAHUN ${selectedYear}`;
    const divName = selectedDivision ? divisions.find(d => d.id === selectedDivision)?.name?.toUpperCase() : 'SEMUA BIDANG';

    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) return;

    const rowsHtml = Object.entries(groupedData).map(([divName, items], idx) => {
        const itemsHtml = items.map((item, i) => `
            <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td>${item.name}</td>
                <td>${item.description || '-'}</td>
                <td style="text-align: right;">${formatCurrency(item.displayCost)}</td>
            </tr>
        `).join('');

        const subTotal = items.reduce((acc, curr) => acc + curr.displayCost, 0);

        return `
            <tr style="background-color: #f3f4f6; font-weight: bold;">
                <td colspan="4" style="padding: 8px;">BIDANG: ${divName}</td>
            </tr>
            ${itemsHtml}
            <tr style="font-weight: bold;">
                <td colspan="3" style="text-align: right; padding-right: 10px;">Subtotal ${divName}</td>
                <td style="text-align: right;">${formatCurrency(subTotal)}</td>
            </tr>
        `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Pengajuan Keuangan</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid black; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 18pt; text-transform: uppercase; }
            .header h2 { margin: 5px 0; font-size: 14pt; font-weight: normal; }
            .header p { margin: 0; font-size: 10pt; font-style: italic; }
            
            .report-title { text-align: center; margin-bottom: 20px; text-decoration: underline; font-weight: bold; font-size: 12pt; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11pt; }
            th, td { border: 1px solid black; padding: 6px 8px; vertical-align: top; }
            th { background-color: #e5e7eb; }
            
            .signatures { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .sig-block { text-align: center; width: 30%; }
            .sig-line { margin-top: 60px; border-top: 1px solid black; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${orgName}</h1>
            <h2>PENGAJUAN ANGGARAN KEUANGAN</h2>
            <p>Laporan Generated System E-Yayasan</p>
          </div>

          <div class="report-title">
            RINCIAN PENGAJUAN ${divName}<br/>
            PERIODE: ${titleTime}
          </div>

          <table>
            <thead>
                <tr>
                    <th style="width: 5%;">No</th>
                    <th style="width: 40%;">Uraian Kegiatan</th>
                    <th style="width: 30%;">Keterangan</th>
                    <th style="width: 25%;">Jumlah Pengajuan</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
            <tfoot>
                <tr style="background-color: #d1fae5; font-weight: bold;">
                    <td colspan="3" style="text-align: right; font-size: 12pt;">TOTAL ESTIMASI PENGAJUAN</td>
                    <td style="text-align: right; font-size: 12pt;">${formatCurrency(totalEstimate)}</td>
                </tr>
            </tfoot>
          </table>

          <div class="signatures">
            <div class="sig-block">
                <div>Diajukan Oleh,<br/>Bendahara / Pemohon</div>
                <div class="sig-line">( ..................................... )</div>
            </div>
             <div class="sig-block">
                <div>Mengetahui,<br/>Ketua Bidang</div>
                <div class="sig-line">( ..................................... )</div>
            </div>
            <div class="sig-block">
                <div>Disetujui Oleh,<br/>Ketua Yayasan</div>
                <div class="sig-line">( ..................................... )</div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FileText className="text-primary-600 dark:text-primary-400" /> Pengajuan Keuangan
        </h2>
      </div>

      {/* --- FILTERS --- */}
      <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border shadow-sm">
         <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-100 dark:border-dark-border pb-2">
            <Filter size={18} /> Konfigurasi Laporan
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
                    <option value="">-- Laporan Satu Tahun --</option>
                    {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
               </div>
               <p className="text-[10px] text-gray-400 mt-1">*Pilih bulan untuk estimasi per bulan</p>
            </div>

            <div>
               <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Bidang / Divisi</label>
               <select 
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                  value={selectedDivision}
                  onChange={(e) => setSelectedDivision(e.target.value)}
               >
                  <option value="">Semua Bidang</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
               </select>
            </div>
         </div>
      </div>

      {/* --- PREVIEW & ACTION --- */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-lg border border-gray-200 dark:border-dark-border overflow-hidden min-h-[500px] flex flex-col">
         <div className="p-4 border-b border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
            <h3 className="font-bold text-gray-700 dark:text-gray-200">Preview Laporan</h3>
            <button 
                onClick={handlePrint}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow"
            >
                <Printer size={18} /> Cetak / Download PDF
            </button>
         </div>
         
         {/* A4 Paper Simulation */}
         <div className="flex-1 bg-gray-100 dark:bg-gray-900 p-8 overflow-auto flex justify-center">
            <div className="bg-white text-black shadow-lg p-10 w-[210mm] min-h-[297mm] box-border relative">
                {/* Header Kop */}
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                    <h1 className="text-xl font-bold uppercase">{organizations.find(o => o.id === selectedOrg)?.name || 'YAYASAN PENDIDIKAN'}</h1>
                    <h2 className="text-lg">PENGAJUAN ANGGARAN KEUANGAN</h2>
                    <p className="text-sm italic text-gray-600">Generated System E-Yayasan</p>
                </div>

                <div className="text-center mb-6">
                    <p className="font-bold underline">RINCIAN PENGAJUAN {selectedDivision ? divisions.find(d => d.id === selectedDivision)?.name?.toUpperCase() : 'SEMUA BIDANG'}</p>
                    <p className="font-bold">PERIODE: {selectedMonth ? `BULAN ${selectedMonth.toUpperCase()} ${selectedYear}` : `TAHUN ${selectedYear}`}</p>
                </div>

                <table className="w-full text-sm border-collapse border border-black mb-8">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-black p-2 text-center w-12">No</th>
                            <th className="border border-black p-2 text-left">Uraian Kegiatan</th>
                            <th className="border border-black p-2 text-left">Keterangan</th>
                            <th className="border border-black p-2 text-right">Jumlah Pengajuan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.keys(groupedData).length > 0 ? (
                            Object.entries(groupedData).map(([divName, items]) => {
                                const subTotal = items.reduce((acc, curr) => acc + curr.displayCost, 0);
                                return (
                                <React.Fragment key={divName}>
                                    <tr className="bg-gray-50">
                                        <td colSpan={4} className="border border-black p-2 font-bold text-xs uppercase bg-gray-100">Bidang: {divName}</td>
                                    </tr>
                                    {items.map((item, idx) => (
                                        <tr key={item.id}>
                                            <td className="border border-black p-2 text-center">{idx + 1}</td>
                                            <td className="border border-black p-2">{item.name}</td>
                                            <td className="border border-black p-2 text-gray-600 text-xs italic">{item.description || '-'}</td>
                                            <td className="border border-black p-2 text-right">{formatCurrency(item.displayCost)}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={3} className="border border-black p-2 text-right font-bold text-xs">Subtotal {divName}</td>
                                        <td className="border border-black p-2 text-right font-bold">{formatCurrency(subTotal)}</td>
                                    </tr>
                                </React.Fragment>
                            )})
                        ) : (
                            <tr>
                                <td colSpan={4} className="border border-black p-8 text-center italic text-gray-500">
                                    Tidak ada data pengajuan yang sesuai dengan filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="bg-emerald-50">
                            <td colSpan={3} className="border border-black p-3 text-right font-bold text-lg">TOTAL ESTIMASI</td>
                            <td className="border border-black p-3 text-right font-bold text-lg">{formatCurrency(totalEstimate)}</td>
                        </tr>
                    </tfoot>
                </table>

                {/* Signatures */}
                <div className="flex justify-between mt-12 px-4">
                     <div className="text-center w-1/3">
                        <p className="mb-16">Diajukan Oleh,<br/>Bendahara / Pemohon</p>
                        <div className="border-t border-black mx-4"></div>
                     </div>
                     <div className="text-center w-1/3">
                        <p className="mb-16">Mengetahui,<br/>Ketua Bidang</p>
                        <div className="border-t border-black mx-4"></div>
                     </div>
                     <div className="text-center w-1/3">
                        <p className="mb-16">Disetujui Oleh,<br/>Ketua Yayasan</p>
                        <div className="border-t border-black mx-4"></div>
                     </div>
                </div>

            </div>
         </div>
      </div>
    </div>
  );
};