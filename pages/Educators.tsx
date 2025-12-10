
import React, { useMemo, useState } from 'react';
import { Member, Organization, Role } from '../types';
import { GraduationCap, Users, Building2, UserPlus, Search, AlertTriangle, School, BookOpen, Clock } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface EducatorsProps {
  members: Member[];
  organizations: Organization[];
  roles: Role[];
  isSuperAdmin?: boolean; // Added prop
}

export const Educators: React.FC<EducatorsProps> = ({ members, organizations, roles, isSuperAdmin }) => {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Only get Education Organizations and TPQ
  const educationOrgs = useMemo(() => {
      return organizations.filter(org => org.type === 'Education' || org.type === 'TPQ');
  }, [organizations]);

  // 2. Filter Members to only get Educators (Role Name contains 'Guru', 'Kepala', 'Ustadz')
  const educatorMembers = useMemo(() => {
      return members.filter(m => {
          const roleName = m.roles?.name?.toLowerCase() || '';
          return roleName.includes('guru') || roleName.includes('kepala') || roleName.includes('ustadz') || roleName.includes('pengajar');
      });
  }, [members]);

  // 3. Group Educators by Organization
  const orgStats = useMemo(() => {
      return educationOrgs.map(org => {
          const orgEducators = educatorMembers.filter(m => m.organization_id === org.id);
          // Adjust logic for Principal based on org type (Kepala Sekolah vs Kepala TPQ/Mudir)
          const principal = orgEducators.find(m => {
              const r = m.roles?.name?.toLowerCase() || '';
              return r.includes('kepala') || r.includes('mudir') || r.includes('direktur');
          });
          
          return {
              org,
              principal,
              teacherCount: orgEducators.length,
              allEducators: orgEducators
          };
      });
  }, [educationOrgs, educatorMembers]);

  // 4. Detail List Logic
  const detailList = useMemo(() => {
      if (!selectedOrg) return [];
      const orgData = orgStats.find(s => s.org.id === selectedOrg.id);
      if (!orgData) return [];
      
      return orgData.allEducators.filter(m => 
        m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [selectedOrg, orgStats, searchQuery]);

  const openDetail = (org: Organization) => {
      // Super Admins don't need to manage this level of detail usually, or read only
      setSelectedOrg(org);
      setSearchQuery('');
      setIsDetailOpen(true);
  }

  const getTypeIcon = (type: string) => {
      return type === 'TPQ' ? <BookOpen size={24}/> : <School size={24}/>;
  }

  const getTypeColor = (type: string) => {
      return type === 'TPQ' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-blue-600 bg-blue-50 dark:bg-blue-900/30';
  }

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <GraduationCap className="text-primary-600 dark:text-primary-400" /> Data Tenaga Pendidik
            </h2>
        </div>

        {educationOrgs.length === 0 ? (
             <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 text-center">
                 <School className="mx-auto text-blue-500 mb-2" size={32} />
                 <h3 className="font-semibold text-blue-800 dark:text-blue-300">Belum Ada Organisasi Pendidikan/TPQ</h3>
                 <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                     Silakan buat organisasi dengan tipe "Pendidikan" atau "TPQ" di menu Organisasi untuk melihat data tenaga pendidik.
                 </p>
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {orgStats.map(({ org, principal, teacherCount }) => (
                    <div 
                        key={org.id} 
                        onClick={() => openDetail(org)}
                        className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border p-6 hover:shadow-md transition cursor-pointer group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-lg transition ${getTypeColor(org.type)}`}>
                                {getTypeIcon(org.type)}
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total {org.type === 'TPQ' ? 'Ustadz' : 'Guru'}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{teacherCount}</p>
                            </div>
                        </div>
                        
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3 line-clamp-1" title={org.name}>
                            {org.name}
                        </h3>

                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase font-semibold">
                                {org.type === 'TPQ' ? 'Kepala TPQ' : 'Kepala Sekolah'}
                            </p>
                            {principal ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 flex items-center justify-center text-xs font-bold">
                                        {principal.full_name.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{principal.full_name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{principal.phone || principal.email}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic flex items-center gap-1">
                                    <AlertTriangle size={12} /> Belum ada data
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- DETAIL MODAL --- */}
        {selectedOrg && (
            <Modal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                title={`Tenaga Pendidik: ${selectedOrg.name}`}
            >
                <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Cari nama..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Nama Lengkap</th>
                                    <th className="px-4 py-3">L/P & Asal</th>
                                    <th className="px-4 py-3">Jabatan</th>
                                    {selectedOrg.type === 'TPQ' && <th className="px-4 py-3">Masa Bakti</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                                {detailList.map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900 dark:text-white">{m.full_name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{m.phone || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs font-semibold">{m.gender || '-'}</div>
                                            <div className="text-xs text-gray-500">{m.origin || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                m.roles?.name?.toLowerCase().includes('kepala') 
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            }`}>
                                                {m.roles?.name || 'Staf'}
                                            </span>
                                        </td>
                                        {selectedOrg.type === 'TPQ' && (
                                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                                                {m.service_period ? (
                                                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100">
                                                        <Clock size={10} /> {m.service_period}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {detailList.length === 0 && (
                                    <tr>
                                        <td colSpan={selectedOrg.type === 'TPQ' ? 4 : 3} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 italic">
                                            Tidak ada data ditemukan.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button 
                            onClick={() => setIsDetailOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};
