
import React, { useState } from 'react';
import { Book, ChevronRight, Search, FileText, Users, Layers, Briefcase, CalendarDays, Building2, GraduationCap, Boxes } from '../components/ui/Icons';

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
                  <p>Selamat datang di <strong>E-Rapi (Sistem Manajemen Yayasan)</strong>. Aplikasi ini dirancang untuk membantu pengurus yayasan dalam mengelola administrasi, keuangan, program kerja, dan keanggotaan secara terintegrasi.</p>
                  <p>Dokumentasi ini mencakup panduan penggunaan fitur-fitur utama aplikasi.</p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 text-sm">
                      <strong>Tips:</strong> Gunakan kotak pencarian di atas untuk menemukan topik spesifik dengan cepat.
                  </div>
              </div>
          )
      },
      {
          id: 'account',
          title: 'Akun & Login',
          icon: <Users size={18}/>,
          content: (
              <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Aktivasi Akun:</strong> Anggota baru harus didaftarkan emailnya oleh Admin terlebih dahulu. Setelah itu, anggota dapat melakukan "Aktivasi Akun" di halaman login dengan memasukkan Email dan <strong>PIN Yayasan</strong>.</li>
                  <li><strong>Login:</strong> Gunakan email dan password yang telah dibuat saat aktivasi.</li>
                  <li><strong>Lupa Password:</strong> Hubungi Super Admin untuk mereset password Anda.</li>
                  <li><strong>Ganti Password:</strong> Anda dapat mengganti password secara mandiri di menu <em>Profil Saya</em>.</li>
              </ul>
          )
      },
      {
          id: 'members',
          title: 'Manajemen Anggota',
          icon: <Users size={18}/>,
          content: (
              <div className="space-y-2">
                  <p>Menu ini digunakan untuk mengelola data seluruh SDM di yayasan.</p>
                  <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Tambah Anggota:</strong> Klik tombol "Tambah Anggota", isi Nama, Email (wajib untuk login), No HP, Role, dan Bidang.</li>
                      <li><strong>Role (Peran):</strong> Menentukan hak akses anggota (misal: Admin bisa edit, Anggota biasa hanya lihat).</li>
                      <li><strong>Koordinator (Super Admin):</strong> Akun spesial yang bisa mengelola data yayasan tertentu.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'programs',
          title: 'Program Kerja & Anggaran',
          icon: <Briefcase size={18}/>,
          content: (
              <div className="space-y-2">
                  <p>Fitur inti untuk perencanaan kegiatan yayasan.</p>
                  <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Buat Program:</strong> Tentukan Nama Program, Estimasi Biaya (per bulan), dan pilih bulan pelaksanaan.</li>
                      <li><strong>Mode Sheet:</strong> Gunakan tampilan "Sheet" untuk melihat matriks program kerja selama satu tahun penuh dalam format tabel yang mudah dibaca.</li>
                      <li><strong>Filter:</strong> Anda dapat menyaring program berdasarkan Bidang, Organisasi, atau Bulan tertentu.</li>
                  </ul>
              </div>
          )
      },
      {
          id: 'finance',
          title: 'Laporan & Pengajuan Keuangan',
          icon: <FileText size={18}/>,
          content: (
              <div className="space-y-2">
                  <p>Hasilkan laporan pengajuan dana otomatis siap cetak.</p>
                  <ol className="list-decimal pl-5 space-y-1">
                      <li>Masuk ke menu <strong>Pengajuan Keuangan</strong>.</li>
                      <li>Pilih filter (Tahun, Bulan, Organisasi, Bidang) sesuai kebutuhan laporan.</li>
                      <li>Isi nama penanda tangan (Pemohon, Ketua Bidang, Ketua Yayasan).</li>
                      <li>Klik <strong>Cetak</strong> untuk membuka format laporan resmi (A4) yang siap diprint atau disimpan sebagai PDF.</li>
                  </ol>
              </div>
          )
      },
      {
          id: 'events',
          title: 'Acara & Absensi',
          icon: <CalendarDays size={18}/>,
          content: (
              <div className="space-y-2">
                  <p>Kelola agenda kegiatan dan rekap kehadiran anggota.</p>
                  <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Buat Acara:</strong> Tentukan Tanggal, Jam, Lokasi, dan peserta yang diundang (Semua atau Terpilih).</li>
                      <li><strong>Absensi:</strong> Buka acara, lalu tandai status kehadiran anggota (Hadir/Izin/Alpha).</li>
                      <li><strong>Rekapitulasi:</strong> Klik tombol "Rekap & Evaluasi" untuk melihat persentase keaktifan anggota secara keseluruhan. Sistem memberikan label otomatis (Sangat Aktif, Kurang Aktif, dll).</li>
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
                  <p>Manajemen unit-unit di bawah yayasan (Sekolah, TPQ, Masjid).</p>
                  <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Tipe Organisasi:</strong> Pilih 'Pendidikan' atau 'TPQ' untuk membuka fitur khusus Tenaga Pendidik.</li>
                      <li><strong>Manajemen Pendidik:</strong> Tambahkan Guru/Ustadz pada organisasi tersebut. Untuk TPQ, tersedia fitur masa bakti (Expired Date).</li>
                      <li><strong>Kelompok:</strong> Gunakan menu Kelompok untuk membagi anggota ke dalam kelas, halaqah, atau tim kecil.</li>
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Book className="text-primary-600 dark:text-primary-400" /> Dokumentasi & Panduan
          </h2>
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                  type="text" 
                  placeholder="Cari topik..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-card dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
          </div>
       </div>

       <div className="space-y-4">
           {filteredTopics.map((topic) => (
               <div key={topic.id} className="bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-dark-border overflow-hidden">
                   <button 
                      onClick={() => toggleTopic(topic.id)}
                      className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${activeTopic === topic.id ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}
                   >
                       <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-lg ${activeTopic === topic.id ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                               {topic.icon}
                           </div>
                           <span className="font-semibold text-gray-800 dark:text-white">{topic.title}</span>
                       </div>
                       <ChevronRight size={20} className={`text-gray-400 transition-transform duration-200 ${activeTopic === topic.id ? 'rotate-90' : ''}`} />
                   </button>
                   
                   {activeTopic === topic.id && (
                       <div className="p-4 pt-0 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 leading-relaxed bg-gray-50/30 dark:bg-gray-900/20">
                           <div className="mt-4">
                               {topic.content}
                           </div>
                       </div>
                   )}
               </div>
           ))}

           {filteredTopics.length === 0 && (
               <div className="text-center py-12 text-gray-500">
                   Topik tidak ditemukan.
               </div>
           )}
       </div>
    </div>
  );
};
