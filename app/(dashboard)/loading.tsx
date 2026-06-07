// Skeleton instan saat berpindah route di dashboard. Next menampilkan ini
// segera setelah klik menu, sementara Server Component fetch data — jadi
// layar tidak "freeze" menunggu server selesai.
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Judul */}
      <div className="h-8 w-56 rounded-lg bg-gray-200 dark:bg-gray-700" />

      {/* Baris kartu statistik */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-100 dark:border-dark-border flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-12 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>

      {/* Tabel/daftar */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-100 dark:border-dark-border space-y-4">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="h-4 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
