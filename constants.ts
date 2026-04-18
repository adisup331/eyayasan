export const WIDGETS: Record<string, string> = {
    STATS_MEMBERS: 'Total Anggota',
    STATS_EVENTS: 'Acara Mendatang',
    STATS_PROGRAMS: 'Program Aktif',
    STATS_BUDGET: 'Total Anggaran',
    STATS_EDUCATORS: 'Jumlah Tenaga Pendidik',
    
    TABLE_PROGRAMS: 'Program Kerja Bulan Ini',
    LIST_AGENDA: 'Agenda Terdekat',
    LIST_EXPIRY: 'Peringatan Masa Bakti (3 Bulan)',
    
    CHART_ATTENDANCE: 'Tren Kehadiran',
    CHART_STATUS: 'Status Program Kerja',
    CHART_BUDGET: 'Alokasi Anggaran'
};

export const DEFAULT_WIDGETS = [
    'STATS_MEMBERS', 'STATS_EVENTS', 'STATS_PROGRAMS', 'STATS_BUDGET',
    'LIST_EXPIRY', 
    'TABLE_PROGRAMS', 
    'CHART_BUDGET', 'LIST_AGENDA', 
    'CHART_ATTENDANCE', 'CHART_STATUS'
];
