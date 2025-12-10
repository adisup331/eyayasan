import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Group, Organization, Member, Foundation, Role } from '../types';
import { Plus, Edit, Trash2, Boxes, Users, Building2, AlertTriangle, Globe, ChevronLeft, Calendar, Clock, User, UserPlus, Search, XCircle, ShieldCheck, Save, Mail, Phone, List, CheckCircle2, GraduationCap } from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface GroupsProps {
  data: Group[];
  organizations: Organization[];
  members: Member[];
  roles: Role[]; // Added Roles prop
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; 
}

const STUDENT_GRADES = ['Caberawit', 'Praremaja', 'Remaja', 'Usia Nikah'];

export const Groups: React.FC<GroupsProps> = ({ data, organizations, members, roles, onRefresh, activeFoundation, isSuperAdmin }) => {
  // View State
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // CRUD States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Group | null>(null);
  
  // Unified Delete/Remove Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{
      isOpen: boolean; 
      id: string | null; 
      type: 'GROUP' | 'MEMBER'; 
      name?: string; // For display purposes
  }>({ isOpen: false, id: null, type: 'GROUP' });
  
  // Member Management States
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberTab, setAddMemberTab] = useState<'SELECT' | 'CREATE'>('SELECT');
  const [candidateSearch, setCandidateSearch] = useState('');

  // Create New Member State
  const [newMemberForm, setNewMemberForm] = useState({
      full_name: '',
      email: '',
      phone: '',
      role_id: '',
      gender: 'L',
      birth_date: '',
      grade: '',
      member_type: 'Generus' // Default
  });
  
  // Service Period State for New Member (Group Context)
  const [serviceStart, setServiceStart] = useState('');
  const [serviceDuration, setServiceDuration] = useState<number>(1);

  // Member EDIT State (Directly in Group)
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memForm, setMemForm] = useState({ full_name: '', email: '', phone: '', gender: 'L', birth_date: '', grade: '', member_type: 'Generus' });
  
  // Form State (Group)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper: Calculate Age
  const calculateAge = (dobString?: string) => {
      if (!dobString) return null;
      const today = new Date();
      const birthDate = new Date(dobString);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
      }
      return age;
  };

  // Helper: Check Role Requirement
  const isServiceRequired = useMemo(() => {
      if (!newMemberForm.role_id) return false;
      const r = roles.find(role => role.id === newMemberForm.role_id);
      return r?.requires_service_period || false;
  }, [newMemberForm.role_id, roles]);

  // Helper: Grade Color
  const getGradeColor = (grade?: string) => {
      switch(grade) {
          case 'Caberawit': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
          case 'Praremaja': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
          case 'Remaja': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
          case 'Usia Nikah': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300';
          default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
      }
  };

  // --- LOGIC: EXPIRING MEMBERS (3 MONTHS) ---
  const expiringMembers = useMemo(() => {
      const today = new Date();
      const ninetyDaysLater = new Date();
      ninetyDaysLater.setDate(today.getDate() + 90);

      return members.filter(m => {
          if (!m.service_end_date) return false;
          const endDate = new Date(m.service_end_date);
          return endDate <= ninetyDaysLater;
      }).map(m => {
          const endDate = new Date(m.service_end_date!);
          const diffTime = endDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return { ...m, daysLeft: diffDays };
      }).sort((a,b) => a.daysLeft - b.daysLeft);
  }, [members]);

  // --- MEMBER MANAGEMENT LOGIC ---
  const groupMembers = useMemo(() => {
      if (!selectedGroup) return [];
      return members.filter(m => m.group_id === selectedGroup.id);
  }, [selectedGroup, members]);

  const roleSummary = useMemo(() => {
      const summary: Record<string, number> = {};
      groupMembers.forEach(m => {
          const roleName = m.roles?.name || 'Tanpa Role';
          summary[roleName] = (summary[roleName] || 0) + 1;
      });
      return summary;
  }, [groupMembers]);

  const availableCandidates = useMemo(() => {
      if (!selectedGroup) return [];
      // Candidates are members of the SAME Organization, who are NOT in this group currently.
      return members.filter(m => 
          m.organization_id === selectedGroup.organization_id && 
          m.group_id !== selectedGroup.id &&
          m.full_name.toLowerCase().includes(candidateSearch.toLowerCase())
      );
  }, [members, selectedGroup, candidateSearch]);

  const handleAddMemberToGroup = async (memberId: string) => {
      if (!selectedGroup) return;
      try {
          const { error } = await supabase.from('members').update({ group_id: selectedGroup.id }).eq('id', memberId);
          if (error) throw error;
          onRefresh();
          // Keep modal open to add more
      } catch (err: any) {
          alert("Gagal menambahkan anggota: " + err.message);
      }
  };

  const handleCreateNewMember = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedGroup) return;
      setLoading(true);

      // Validate Service Period if Required
      let servicePeriodString = null;
      let serviceEndDateIso = null;

      if (isServiceRequired) {
          if (!serviceStart) {
              alert("Untuk role ini, Tanggal Mulai Penugasan wajib diisi.");
              setLoading(false);
              return;
          }
          const startDate = new Date(serviceStart);
          const formatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
          const startStr = formatter.format(startDate);

          const endDate = new Date(startDate);
          endDate.setFullYear(startDate.getFullYear() + serviceDuration);
          
          servicePeriodString = `${startStr} - ${formatter.format(endDate)}`;
          serviceEndDateIso = endDate.toISOString();
      }

      const payload = {
          full_name: newMemberForm.full_name,
          email: newMemberForm.email,
          phone: newMemberForm.phone,
          role_id: newMemberForm.role_id || null,
          gender: newMemberForm.gender,
          birth_date: newMemberForm.birth_date || null,
          grade: newMemberForm.grade || null,
          member_type: newMemberForm.member_type, // New Field
          organization_id: selectedGroup.organization_id,
          foundation_id: activeFoundation?.id || null,
          group_id: selectedGroup.id, // Directly assign to group
          service_period: servicePeriodString,
          service_end_date: serviceEndDateIso
      };

      try {
          const { error } = await supabase.from('members').insert([payload]);
          if (error) throw error;
          onRefresh();
          setIsAddMemberOpen(false); // Close modal on success
      } catch (err: any) {
          alert("Gagal membuat anggota baru: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  // --- CRUD HANDLERS ---
  const handleOpen = (group?: Group) => {
    if (group) {
      setEditingItem(group);
      setName(group.name);
      setDescription(group.description || '');
      setOrganizationId(group.organization_id);
    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
      setOrganizationId(organizations[0]?.id || '');
    }
    setIsModalOpen(true);
  };

  // OPEN EDIT MEMBER MODAL
  const openEditMember = (member: Member) => {
      setEditingMember(member);
      setMemForm({
          full_name: member.full_name,
          email: member.email,
          phone: member.phone || '',
          gender: (member.gender as any) || 'L',
          birth_date: member.birth_date || '',
          grade: member.grade || '',
          member_type: member.member_type || 'Generus'
      });
      setIsEditMemberOpen(true);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingMember) return;
      setLoading(true);
      try {
          const { error } = await supabase.from('members').update({
              full_name: memForm.full_name,
              email: memForm.email,
              phone: memForm.phone,
              gender: memForm.gender,
              birth_date: memForm.birth_date || null,
              grade: memForm.grade || null,
              member_type: memForm.member_type
          }).eq('id', editingMember.id);

          if (error) throw error;
          onRefresh();
          setIsEditMemberOpen(false);
      } catch (err: any) {
          alert("Gagal update data anggota: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const openDetail = (group: Group) => {
      setSelectedGroup(group);
      setViewMode('DETAIL');
      window.scrollTo(0,0);
  };

  const closeDetail = () => {
      setSelectedGroup(null);
      setViewMode('LIST');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!organizationId) {
        alert("Pilih organisasi terlebih dahulu.");
        setLoading(false);
        return;
    }

    const selectedOrg = organizations.find(o => o.id === organizationId);
    const targetFoundationId = selectedOrg?.foundation_id || activeFoundation?.id || null;

    const payload: any = { 
        name, 
        description, 
        organization_id: organizationId,
        foundation_id: targetFoundationId
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from('groups').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('groups').insert([payload]);
        if (error) throw error;
      }
      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Delete Group Popup
  const confirmDeleteGroup = (id: string, groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, id, type: 'GROUP', name: groupName });
  };

  // Trigger Remove Member Popup
  const confirmRemoveMember = (memberId: string, memberName: string) => {
      setDeleteConfirm({ isOpen: true, id: memberId, type: 'MEMBER', name: memberName });
  }

  // Execute Action based on Type
  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    
    try {
      if (deleteConfirm.type === 'GROUP') {
          const { error } = await supabase.from('groups').delete().eq('id', deleteConfirm.id);
          if (error) throw error;
          
          if (selectedGroup?.id === deleteConfirm.id) {
              closeDetail();
          }
      } else if (deleteConfirm.type === 'MEMBER') {
          const { error } = await supabase.from('members').update({ group_id: null }).eq('id', deleteConfirm.id);
          if (error) throw error;
      }

      onRefresh();
      setDeleteConfirm({ isOpen: false, id: null, type: 'GROUP' });
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  // --- RENDERERS ---

  const renderDetailView = () => {
      if (!selectedGroup) return null;
      const org = organizations.find(o => o.id === selectedGroup.organization_id);

      return (
          <div className="animate-in fade-in slide-in-from-right-8 duration-300 space-y-6">
              {/* Header Navigation */}
              <button 
                  onClick={closeDetail}
                  className="flex items-center gap-2 text-gray-500 hover:text-primary-600 transition mb-2"
              >
                  <ChevronLeft size={20} /> Kembali ke Daftar Kelompok
              </button>

              {/* Header Card */}
              <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                          <div className="flex items-center gap-2 mb-2">
                              <div className="p-2 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg">
                                  <Boxes size={24} />
                              </div>
                              <div>
                                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedGroup.name}</h2>
                                  <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                      <Building2 size={12}/> {org?.name}
                                  </span>
                              </div>
                          </div>
                          <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-2xl">
                              {selectedGroup.description || 'Tidak ada deskripsi.'}
                          </p>
                      </div>
                      <div className="flex gap-3">
                          <button 
                              onClick={() => handleOpen(selectedGroup)}
                              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center gap-2"
                          >
                              <Edit size={16} /> Edit Info
                          </button>
                      </div>
                  </div>
                  
                  {/* Stats & Role Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-100 dark:border-dark-border">
                      {/* Gender Stats */}
                      <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <span className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold">Total</span>
                              <span className="text-lg font-bold text-blue-800 dark:text-blue-300">{groupMembers.length}</span>
                          </div>
                          <div className="flex flex-col items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <span className="text-xs text-green-600 dark:text-green-400 uppercase font-bold">Pria (L)</span>
                              <span className="text-lg font-bold text-green-800 dark:text-green-300">{groupMembers.filter(m => m.gender === 'L').length}</span>
                          </div>
                          <div className="flex flex-col items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <span className="text-xs text-purple-600 dark:text-purple-400 uppercase font-bold">Wanita (P)</span>
                              <span className="text-lg font-bold text-purple-800 dark:text-purple-300">{groupMembers.filter(m => m.gender === 'P').length}</span>
                          </div>
                      </div>

                      {/* Role Summary */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-1">
                              <ShieldCheck size={12}/> Struktur Kelompok
                          </h4>
                          <div className="flex flex-wrap gap-2">
                              {Object.entries(roleSummary).map(([role, count]) => (
                                  <span key={role} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 shadow-sm">
                                      {role}: <strong>{count}</strong>
                                  </span>
                              ))}
                              {Object.keys(roleSummary).length === 0 && <span className="text-xs text-gray-400 italic">Belum ada anggota</span>}
                          </div>
                      </div>
                  </div>
              </div>

              {/* Members Table */}
              <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 dark:text-white">Daftar Anggota / Santri</h3>
                      <button 
                        onClick={() => { 
                            setCandidateSearch(''); 
                            setAddMemberTab('SELECT'); 
                            setIsAddMemberOpen(true); 
                            setNewMemberForm({ full_name: '', email: '', phone: '', role_id: '', gender: 'L', birth_date: '', grade: '', member_type: 'Generus' });
                            setServiceStart(new Date().toISOString().split('T')[0]);
                            setServiceDuration(1);
                        }}
                        className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                      >
                          <UserPlus size={14}/> Tambah Anggota
                      </button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase text-xs font-semibold">
                              <tr>
                                  <th className="px-6 py-3">Nama Lengkap</th>
                                  <th className="px-6 py-3">Tipe & Kelas</th>
                                  <th className="px-6 py-3">Kontak</th>
                                  <th className="px-6 py-3">Role</th>
                                  <th className="px-6 py-3 text-right">Aksi</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                              {groupMembers.map(m => {
                                  const age = calculateAge(m.birth_date);
                                  return (
                                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                                          {m.full_name}
                                          {m.gender && <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded">{m.gender}</span>}
                                      </td>
                                      <td className="px-6 py-3">
                                          <div className="flex flex-col gap-1 items-start">
                                              <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                                  {m.member_type || 'Generus'}
                                              </span>
                                              {m.grade && (
                                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getGradeColor(m.grade)}`}>
                                                      {m.grade}
                                                  </span>
                                              )}
                                              {age !== null && (
                                                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                      <Calendar size={10} /> {age} Thn
                                                  </span>
                                              )}
                                          </div>
                                      </td>
                                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                                          {m.email || m.phone || '-'}
                                      </td>
                                      <td className="px-6 py-3">
                                          <div className="flex flex-col items-start gap-1">
                                            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs">
                                                {m.roles?.name || '-'}
                                            </span>
                                            {m.service_period && (
                                                <span className="text-[9px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 rounded border border-orange-100 dark:border-orange-800">
                                                    {m.service_period}
                                                </span>
                                            )}
                                          </div>
                                      </td>
                                      <td className="px-6 py-3 text-right">
                                          <div className="flex justify-end gap-2">
                                              <button 
                                                onClick={() => openEditMember(m)}
                                                className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                                                title="Edit Data Anggota"
                                              >
                                                  <Edit size={18} />
                                              </button>
                                              <button 
                                                onClick={() => confirmRemoveMember(m.id, m.full_name)}
                                                className="text-red-400 hover:text-red-600 transition"
                                                title="Keluarkan dari kelompok"
                                              >
                                                  <XCircle size={18} />
                                              </button>
                                          </div>
                                      </td>
                                  </tr>
                              )})}
                              {groupMembers.length === 0 && (
                                  <tr>
                                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">
                                          Belum ada anggota yang ditambahkan ke kelompok ini.
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };

  const renderListView = () => {
      return (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Boxes className="text-primary-600 dark:text-primary-400" /> Manajemen Kelompok
            </h2>
            {!isSuperAdmin && (
                <button
                onClick={() => handleOpen()}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                >
                <Plus size={18} /> Tambah Kelompok
                </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((item) => {
               const memberCount = members.filter(m => m.group_id === item.id).length;
               const orgName = organizations.find(o => o.id === item.organization_id)?.name || '-';
               
               return (
                <div 
                    key={item.id} 
                    onClick={() => openDetail(item)}
                    className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition cursor-pointer group flex flex-col relative"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Boxes size={20} />
                        </div>
                        {!isSuperAdmin && (
                            <div className="flex gap-2">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleOpen(item); }} 
                                    className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 z-10"
                                >
                                <Edit size={18} />
                                </button>
                                <button 
                                    onClick={(e) => confirmDeleteGroup(item.id, item.name, e)} 
                                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 z-10"
                                >
                                <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{item.name}</h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1">
                        <Building2 size={12}/> {orgName}
                    </div>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-1">
                    {item.description || 'Tidak ada deskripsi.'}
                    </p>
                    
                    <div className="mt-auto pt-4 border-t border-gray-100 dark:border-dark-border flex justify-between items-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Users size={14} /> {memberCount} Anggota
                        </div>
                        <span className="text-xs text-primary-600 dark:text-primary-400 font-medium group-hover:underline">Lihat Detail &rarr;</span>
                    </div>
                </div>
            )})}
            {data.length === 0 && (
              <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
                Belum ada kelompok yang dibuat{activeFoundation ? ` untuk ${activeFoundation.name}` : ''}.
              </div>
            )}
          </div>
        </div>
      );
  };

  return (
    <div>
      {/* Conditional Rendering based on View Mode */}
      {viewMode === 'LIST' ? renderListView() : renderDetailView()}

      {/* --- FORM MODAL (Available in both views) --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Kelompok' : 'Tambah Kelompok'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Kelompok</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
              placeholder="Contoh: Kelompok A, Kelas 1B"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organisasi</label>
            <select
                required
                value={organizationId}
                onChange={e => setOrganizationId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
            >
                <option value="">Pilih Organisasi</option>
                {organizations.map(o => (
                    <option key={o.id} value={o.id}>
                        {o.name} ({o.type}) {isSuperAdmin && o.foundations?.name ? `- ${o.foundations.name}` : ''}
                    </option>
                ))}
            </select>
            {isSuperAdmin && (
                <p className="text-[10px] text-gray-500 mt-1">
                    *Kelompok akan otomatis terdaftar di Yayasan milik Organisasi yang dipilih.
                </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 focus:border-primary-500 focus:ring-primary-500 outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- ADD MEMBER MODAL (UPDATED WITH CREATE OPTION) --- */}
      <Modal 
        isOpen={isAddMemberOpen} 
        onClose={() => setIsAddMemberOpen(false)} 
        title={`Tambah Anggota ke ${selectedGroup?.name}`}
      >
          {/* TAB TOGGLE */}
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-4">
              <button 
                onClick={() => setAddMemberTab('SELECT')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${addMemberTab === 'SELECT' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                  <List size={16} className="inline mr-1 mb-0.5"/> Pilih dari Daftar
              </button>
              <button 
                onClick={() => setAddMemberTab('CREATE')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${addMemberTab === 'CREATE' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                  <Plus size={16} className="inline mr-1 mb-0.5"/> Buat Baru
              </button>
          </div>

          {addMemberTab === 'SELECT' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="relative">
                      <Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                      <input 
                        type="text"
                        placeholder="Cari anggota organisasi..."
                        value={candidateSearch}
                        onChange={(e) => setCandidateSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                      />
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg">
                      {availableCandidates.length > 0 ? (
                          availableCandidates.map(m => (
                              <div key={m.id} className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0 transition">
                                  <div>
                                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{m.full_name}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{m.roles?.name || '-'}</p>
                                  </div>
                                  <button 
                                    onClick={() => handleAddMemberToGroup(m.id)}
                                    className="text-primary-600 hover:text-primary-700 p-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-full transition"
                                  >
                                      <Plus size={16}/>
                                  </button>
                              </div>
                          ))
                      ) : (
                          <p className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
                              {candidateSearch ? 'Tidak ditemukan.' : 'Semua anggota organisasi sudah masuk kelompok.'}
                          </p>
                      )}
                  </div>
                  <div className="flex justify-end">
                      <button onClick={() => setIsAddMemberOpen(false)} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200">Selesai</button>
                  </div>
              </div>
          ) : (
              // CREATE NEW MEMBER FORM
              <form onSubmit={handleCreateNewMember} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                      <input 
                        type="text" 
                        required
                        value={newMemberForm.full_name}
                        onChange={(e) => setNewMemberForm({...newMemberForm, full_name: e.target.value})}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Lahir</label>
                          <input 
                            type="date" 
                            value={newMemberForm.birth_date}
                            onChange={(e) => setNewMemberForm({...newMemberForm, birth_date: e.target.value})}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                      </div>
                      {/* NEW: Tipe Anggota & Grade */}
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipe Anggota</label>
                          <select
                            value={newMemberForm.member_type}
                            onChange={(e) => setNewMemberForm({...newMemberForm, member_type: e.target.value})}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          >
                              <option value="Generus">Generus</option>
                              <option value="Lima Unsur">Lima Unsur</option>
                          </select>
                      </div>
                  </div>

                  {newMemberForm.member_type === 'Generus' && (
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kelas / Jenjang</label>
                          <select
                            value={newMemberForm.grade}
                            onChange={(e) => setNewMemberForm({...newMemberForm, grade: e.target.value})}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          >
                              <option value="">Pilih Kelas</option>
                              {STUDENT_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                      </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email (Opsional)</label>
                          <input 
                            type="email" 
                            value={newMemberForm.email}
                            onChange={(e) => setNewMemberForm({...newMemberForm, email: e.target.value})}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            placeholder="user@example.com"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">No. Telepon (Opsional)</label>
                          <input 
                            type="text" 
                            value={newMemberForm.phone}
                            onChange={(e) => setNewMemberForm({...newMemberForm, phone: e.target.value})}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Jenis Kelamin</label>
                          <select
                            value={newMemberForm.gender}
                            onChange={(e) => setNewMemberForm({...newMemberForm, gender: e.target.value})}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          >
                              <option value="L">Laki-laki</option>
                              <option value="P">Perempuan</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                          <select
                            value={newMemberForm.role_id}
                            onChange={(e) => setNewMemberForm({...newMemberForm, role_id: e.target.value})}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          >
                              <option value="">Pilih Role</option>
                              {roles.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                          </select>
                      </div>
                  </div>

                  {/* DYNAMIC SERVICE PERIOD INPUT */}
                  {isServiceRequired && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                          <label className="block text-xs font-bold text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-1">
                              <Clock size={12}/> Masa Bakti / Penugasan (Wajib)
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Tanggal Mulai</label>
                                  <input 
                                      type="date" 
                                      required
                                      value={serviceStart} 
                                      onChange={e => setServiceStart(e.target.value)} 
                                      className="w-full rounded-md border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 dark:text-white px-2 py-1.5 text-sm focus:ring-orange-500 outline-none"
                                  />
                              </div>
                              <div>
                                  <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Durasi</label>
                                  <select
                                      value={serviceDuration}
                                      onChange={e => setServiceDuration(Number(e.target.value))}
                                      className="w-full rounded-md border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 dark:text-white px-2 py-1.5 text-sm focus:ring-orange-500 outline-none"
                                  >
                                      <option value={1}>1 Tahun</option>
                                      <option value={2}>2 Tahun</option>
                                      <option value={3}>3 Tahun</option>
                                      <option value={4}>4 Tahun</option>
                                      <option value={5}>5 Tahun</option>
                                  </select>
                              </div>
                          </div>
                      </div>
                  )}
                  
                  <div className="flex justify-end gap-2 pt-2">
                      <button 
                        type="button" 
                        onClick={() => setIsAddMemberOpen(false)} 
                        className="px-4 py-2 text-sm border rounded-md text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                          Batal
                      </button>
                      <button 
                        type="submit" 
                        disabled={loading} 
                        className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50"
                      >
                          <Save size={16}/> {loading ? 'Menyimpan...' : 'Simpan & Masukkan'}
                      </button>
                  </div>
              </form>
          )}
      </Modal>

      {/* ... (Existing Edit Member Modal & Delete Modal remains the same) ... */}
      <Modal
        isOpen={isEditMemberOpen}
        onClose={() => setIsEditMemberOpen(false)}
        title="Edit Data Anggota/Santri"
      >
          <form onSubmit={handleUpdateMember} className="space-y-4">
              {/* ... (Existing form content for edit) ... */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                  <div className="relative mt-1">
                      <User size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                      <input 
                        type="text"
                        required
                        value={memForm.full_name}
                        onChange={(e) => setMemForm({...memForm, full_name: e.target.value})}
                        className="w-full pl-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                      />
                  </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Lahir</label>
                      <div className="relative mt-1">
                          <Calendar size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                          <input 
                            type="date"
                            value={memForm.birth_date}
                            onChange={(e) => setMemForm({...memForm, birth_date: e.target.value})}
                            className="w-full pl-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                      </div>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipe Anggota</label>
                      <select
                        value={memForm.member_type}
                        onChange={(e) => setMemForm({...memForm, member_type: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                          <option value="Generus">Generus</option>
                          <option value="Lima Unsur">Lima Unsur</option>
                      </select>
                  </div>
              </div>

              {memForm.member_type === 'Generus' && (
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kelas / Jenjang</label>
                      <div className="relative mt-1">
                          <GraduationCap size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                          <select
                            value={memForm.grade}
                            onChange={(e) => setMemForm({...memForm, grade: e.target.value})}
                            className="w-full pl-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          >
                              <option value="">Pilih Kelas</option>
                              {STUDENT_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                      <div className="relative mt-1">
                          <Mail size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                          <input 
                            type="email"
                            value={memForm.email}
                            onChange={(e) => setMemForm({...memForm, email: e.target.value})}
                            className="w-full pl-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                      </div>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">No. Telepon</label>
                      <div className="relative mt-1">
                          <Phone size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                          <input 
                            type="text"
                            value={memForm.phone}
                            onChange={(e) => setMemForm({...memForm, phone: e.target.value})}
                            className="w-full pl-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                      </div>
                  </div>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Jenis Kelamin</label>
                  <div className="mt-1 flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="gender" 
                            value="L"
                            checked={memForm.gender === 'L'}
                            onChange={(e) => setMemForm({...memForm, gender: e.target.value})}
                            className="text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Laki-laki</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="gender" 
                            value="P"
                            checked={memForm.gender === 'P'}
                            onChange={(e) => setMemForm({...memForm, gender: e.target.value})}
                            className="text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Perempuan</span>
                      </label>
                  </div>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsEditMemberOpen(false)} className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 text-sm">Batal</button>
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm flex items-center gap-1">
                      <Save size={16}/> {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
              </div>
          </form>
      </Modal>

      <Modal 
        isOpen={deleteConfirm.isOpen} 
        onClose={() => setDeleteConfirm({isOpen: false, id: null, type: 'GROUP'})} 
        title={deleteConfirm.type === 'GROUP' ? "Hapus Kelompok" : "Keluarkan Anggota"}
      >
        <div className="text-center sm:text-left">
          <div className="flex flex-col items-center gap-4 mb-4">
             <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
               <AlertTriangle size={32} />
             </div>
             <div>
                <p className="text-gray-700 dark:text-gray-300">
                  {deleteConfirm.type === 'GROUP' 
                    ? <>Apakah Anda yakin ingin menghapus kelompok <strong>{deleteConfirm.name}</strong>?</>
                    : <>Apakah Anda yakin ingin mengeluarkan <strong>{deleteConfirm.name}</strong> dari kelompok ini?</>
                  }
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {deleteConfirm.type === 'GROUP' 
                    ? "Anggota di dalam kelompok ini akan kehilangan status kelompok mereka."
                    : "Anggota tersebut akan tetap ada di sistem, hanya dihapus dari kelompok ini."
                  }
                </p>
             </div>
          </div>
          <div className="flex justify-center sm:justify-end gap-3 mt-6">
            <button
              onClick={() => setDeleteConfirm({isOpen: false, id: null, type: 'GROUP'})}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Batal
            </button>
            <button
              onClick={executeDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              {deleteConfirm.type === 'GROUP' ? "Ya, Hapus" : "Ya, Keluarkan"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};