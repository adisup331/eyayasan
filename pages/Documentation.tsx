
import React, { useState } from 'react';
import { 
  Book, ChevronRight, Search, FileText, Users, Layers, 
  Briefcase, CalendarDays, Building2, GraduationCap, 
  Boxes, ScanBarcode, Wallet, CheckCircle2, Maximize2,
  // Added BadgeCheck and HelpCircle to imports
  BadgeCheck, HelpCircle
} from '../components/ui/Icons';

interface Topic {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export const Documentation: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeTopic, setActiveTopic] = useState<string | null>('intro');

  const toggleTopic = (id: string) => {
      setActiveTopic(activeTopic === id ? null : id);
  };

  const topics: Topic[] = [
      {
          id: 'intro',
          title: 'Pendahuluan',
          icon: <Book size={18}/>,
          content: (
              <div className="space-y-3">
                  <p>Selamat datang di <strong>E-Rapi (Sistem Manajemen Yayasan)</strong>. Aplikasi ini dirancang untuk transformasi digital tata kelola yayasan, mulai dari administrasi SDM hingga monitoring program kerja dan keuangan.</p>
                  <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-xl border border-primary-100 dark:border-primary-800 text-sm">
                      <strong>Navigasi Cepat:</strong> Gunakan menu di samping untuk berpindah modul. Jika Anda menggunakan perangkat mobile, klik ikon menu di pojok kiri atas.
                  </div>
              </div>
          )
      },
      {
          id: 'programs',
          title: 'Program Kerja & Matriks (Sheet)',
          icon: <Briefcase size={18}/>,
          content: (
              <div className="space-y-4">
                  <p>Modul Program Kerja adalah jantung dari perencanaan yayasan. Tersedia dalam 4 mode tampilan:</p>
                  <ul className="list-disc pl-5 space-y-2">
                      <li><strong>Mode List:</strong> Tampilan standar untuk melihat detail anggaran per item.</li>
                      <li><strong>Mode Sheet (Matriks):</strong> Tampilan seperti Excel yang menampilkan jadwal setahun penuh.
                          <ul className="list-circle pl-5 mt-1 text-xs opacity-80">
                              <li>Klik <strong>Nama Program</strong> di kolom kiri untuk edit cepat.</li>
                              <li>Klik ikon <strong>Evaluasi (Ceklis)</strong> untuk melihat laporan bulan tersebut.</li>
                              <li>Gunakan tombol <strong>Full Screen</strong> untuk pengalaman input data yang lebih luas.</li>
                          </ul>
                      </li>
                      <li><strong>Mode Docs:</strong> Format laporan resmi yang siap dicetak untuk ditandatangani pimpinan.</li>
                      <li><strong>Mode Calendar:</strong> Menampilkan agenda kegiatan per bulan secara visual.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'evaluation',
          title: 'Monitoring & Evaluasi',
          icon: <CheckCircle2 size={18}/>,
          content: (
              <div className="space-y-2">
                  <p>Setiap program kerja dapat dipantau progresnya secara berkala.</p>
                  <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Target Jadwal:</strong> Saat menginput evaluasi, Anda wajib memilih bulan mana yang sedang dilaporkan (berdasarkan jadwal yang sudah dibuat).</li>
                      <li><strong>Status Capaian:</strong> Gunakan status <em>Normal, Warning, Failed,</em> atau <em>Pending</em> untuk menandai kesehatan sebuah proyek.</li>
                      <li><strong>Indikator Visual:</strong> Di tampilan Sheet, titik hijau pada jadwal menandakan bahwa kegiatan bulan tersebut sudah memiliki laporan evaluasi.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'attendance',
          title: 'Scanner & Absensi Real-time',
          icon: <ScanBarcode size={18}/>,
          content: (
              <div className="space-y-3">
                  <p>Fitur Scanner memudahkan pencatatan kehadiran tanpa kertas menggunakan QR Code pada kartu anggota.</p>
                  <ul className="list-disc pl-5 space-y-2">
                      <li><strong>Toleransi Telat:</strong> Admin dapat mengatur batas toleransi (misal 15 menit). Jika peserta scan melebihi batas tersebut, sistem akan otomatis mencatat sebagai "Hadir Telat".</li>
                      <li><strong>Sesi Beragam:</strong> Satu acara bisa memiliki banyak sesi (misal: Sesi Pagi, Sesi Siang). Anda dapat memilih sesi mana yang sedang aktif di layar Scanner.</li>
                      <li><strong>Izin Telat:</strong> Jika peserta telat namun memberikan alasan yang valid, petugas scanner dapat memilih opsi "Izin Telat" secara manual di layar hasil scan.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'cards',
          title: 'Kartu Anggota Digital',
          icon: <BadgeCheck size={18}/>,
          content: (
              <div className="space-y-2">
                  <p>Kelola identitas digital seluruh anggota yayasan.</p>
                  <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Cetak Masal:</strong> Anda dapat mencetak banyak kartu sekaligus dalam satu lembar kertas A4 (kapasitas 8 kartu).</li>
                      <li><strong>Filter Cetak:</strong> Gunakan filter Kelompok atau Tipe Anggota untuk mencetak kartu per kategori.</li>
                      <li><strong>E-Card:</strong> Anggota dapat melihat kartu digital mereka sendiri melalui portal masing-masing untuk discan saat kegiatan.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'finance',
          title: 'Laporan Keuangan',
          icon: <Wallet size={18}/>,
          content: (
              <div className="space-y-2">
                  <p>Otomasi pembuatan surat permohonan dana dan laporan realisasi.</p>
                  <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Generator Surat:</strong> Gabungkan program kerja terpilih dengan biaya tambahan manual untuk membuat Surat Permohonan Dana resmi.</li>
                      <li><strong>Format WA:</strong> Gunakan fitur "Salin Teks" untuk mengirim rincian anggaran ke grup pimpinan melalui WhatsApp dengan format yang rapi.</li>
                      <li><strong>Filter Akurat:</strong> Laporan dapat disaring per Unit Organisasi agar keuangan antar unit (misal: Sekolah vs Masjid) tidak tercampur.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'orgs',
          title: 'Organisasi & Pendidik',
          icon: <Building2 size={18}/>,
          content: (
              <div className="space-y-2">
                  <p>Manajemen unit operasional dan tenaga pengajar.</p>
                  <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Tipe TPQ:</strong> Khusus tipe ini, tersedia fitur Masa Bakti yang akan memberikan peringatan di Dashboard jika ada ustadz yang masa tugasnya hampir habis (3 bulan sebelum expired).</li>
                      <li><strong>Kelompok:</strong> Gunakan modul Kelompok untuk membagi anggota ke dalam kelas atau tim kerja kecil guna mempermudah absensi.</li>
                  </ul>
              </div>
          )
      }
  ];

  const filteredTopics = topics.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    (typeof t.content === 'string' && t.content.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Book className="text-primary-600 dark:text-primary-400" /> Dokumentasi Pusat
            </h2>
            <p className="text-xs text-gray-500 mt-1">Panduan lengkap operasional sistem E-Rapi CMS.</p>
          </div>
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                  type="text" 
                  placeholder="Cari fitur atau panduan..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-card dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
              />
          </div>
       </div>

       <div className="space-y-4">
           {filteredTopics.map((topic) => (
               <div key={topic.id} className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden shadow-sm transition-all hover:shadow-md">
                   <button 
                      onClick={() => toggleTopic(topic.id)}
                      className={`w-full flex items-center justify-between p-5 text-left transition ${activeTopic === topic.id ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                   >
                       <div className="flex items-center gap-4">
                           <div className={`p-2.5 rounded-xl transition ${activeTopic === topic.id ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                               {topic.icon}
                           </div>
                           <span className="font-bold text-gray-900 dark:text-white tracking-tight">{topic.title}</span>
                       </div>
                       <ChevronRight size={20} className={`text-gray-400 transition-transform duration-300 ${activeTopic === topic.id ? 'rotate-90 text-primary-600' : ''}`} />
                   </button>
                   
                   {activeTopic === topic.id && (
                       <div className="p-6 pt-0 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-50 dark:border-gray-800 leading-relaxed animate-in fade-in slide-in-from-top-2">
                           <div className="mt-5 prose prose-sm dark:prose-invert max-w-none">
                               {topic.content}
                           </div>
                       </div>
                   )}
               </div>
           ))}

           {filteredTopics.length === 0 && (
               <div className="text-center py-20 bg-white dark:bg-dark-card rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                   <Search size={48} className="mx-auto text-gray-200 mb-4"/>
                   <p className="text-gray-500 font-medium">Topik bantuan tidak ditemukan.</p>
               </div>
           )}
       </div>

       <div className="p-6 bg-slate-900 rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
           <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl"><HelpCircle size={32} className="text-primary-400"/></div>
                <div>
                    <h4 className="font-bold text-lg">Butuh Bantuan Lanjutan?</h4>
                    <p className="text-xs text-slate-400">Hubungi tim pengembang atau Super Admin yayasan Anda.</p>
                </div>
           </div>
           <button className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 rounded-xl font-bold text-sm transition shadow-lg shadow-primary-600/20 active:scale-95">
               KIRIM TIKET BANTUAN
           </button>
       </div>
    </div>
  );
};
