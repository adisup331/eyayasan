import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { ViewState, Member, Role, Division, Program, Organization, Event, EventAttendance, Foundation, Group } from './types';
import { Auth } from './components/Auth';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Divisions } from './pages/Divisions';
import { Organizations } from './pages/Organizations';
import { Groups } from './pages/Groups'; 
import { Programs } from './pages/Programs';
import { Events } from './pages/Events';
import { Finance } from './pages/Finance'; 
import { Educators } from './pages/Educators'; 
import { Roles } from './pages/Roles';
import { Foundations } from './pages/Foundations'; 
import { Profile } from './pages/Profile'; 
import { Documentation } from './pages/Documentation'; // Import Documentation
import { Help } from './components/Help';
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  Briefcase, 
  LogOut, 
  Sun, 
  Moon, 
  Building2, 
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileText,
  Maximize2,
  Minimize2,
  GraduationCap,
  Lock,
  Globe,
  Boxes,
  User,
  Book // Import Book Icon
} from './components/ui/Icons';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });

  // Data State
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [groups, setGroups] = useState<Group[]>([]); 
  const [programs, setPrograms] = useState<Program[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<EventAttendance[]>([]);
  const [foundations, setFoundations] = useState<Foundation[]>([]); 
  
  // Context State
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [activeFoundation, setActiveFoundation] = useState<Foundation | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  const [loadingData, setLoadingData] = useState(false);
  const [dbError, setDbError] = useState(false);

  // Derived State: Current Logged In User Member Data
  const currentUser = useMemo(() => {
      if (!session || !members.length) return null;
      return members.find(m => m.email === session.user.email) || null;
  }, [session, members]);

  // Theme Effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Full Screen Effect
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- FETCH DATA & DETERMINE PERMISSIONS ---
  const fetchData = async () => {
    if (!session) return;
    setDbError(false);
    
    try {
      const userEmail = session.user.email;
      const { data: userData, error: userError } = await supabase
        .from('members')
        .select('*, roles(name, permissions)')
        .eq('email', userEmail)
        .single();

      let isSuper = false;
      if (userEmail === 'super@yayasan.org') isSuper = true;
      if (userData && userData.roles?.name?.toLowerCase().includes('super')) isSuper = true;
      setIsSuperAdmin(isSuper);

      const { data: allFoundations } = await supabase.from('foundations').select('*');
      const fData = allFoundations || [];
      setFoundations(fData);

      let currentFoundationId: string | null = null;
      
      if (isSuper) {
          // Super Admin Logic
      } else if (userData && userData.foundation_id) {
          currentFoundationId = userData.foundation_id;
          const myF = fData.find((f: any) => f.id === currentFoundationId);
          setActiveFoundation(myF || null);
      } else {
          setActiveFoundation(null);
      }

      let membersQuery = supabase.from('members').select('*, divisions(name), roles(name, permissions), foundations(name), organizations(name)'); // Added organizations(name) for detail
      let rolesQuery = supabase.from('roles').select('*');
      let divisionsQuery = supabase.from('divisions').select('*');
      let groupsQuery = supabase.from('groups').select('*, foundations(name)'); 
      let programsQuery = supabase.from('programs').select('*');
      let orgsQuery = supabase.from('organizations').select('*, foundations(name)'); 
      let eventsQuery = supabase.from('events').select('*');
      let attendQuery = supabase.from('event_attendance').select('*');

      if (!isSuper && currentFoundationId) {
          membersQuery = membersQuery.eq('foundation_id', currentFoundationId);
          rolesQuery = rolesQuery.or(`foundation_id.eq.${currentFoundationId},foundation_id.is.null`);
          divisionsQuery = divisionsQuery.eq('foundation_id', currentFoundationId);
          groupsQuery = groupsQuery.eq('foundation_id', currentFoundationId); 
          programsQuery = programsQuery.eq('foundation_id', currentFoundationId);
          orgsQuery = orgsQuery.eq('foundation_id', currentFoundationId);
          eventsQuery = eventsQuery.eq('foundation_id', currentFoundationId);
      }

      const [membersRes, rolesRes, divisionsRes, programsRes, orgsRes, eventsRes, attendRes, groupsRes] = await Promise.all([
        membersQuery, rolesQuery, divisionsQuery, programsQuery, orgsQuery, eventsQuery, attendQuery, groupsQuery
      ]);

      if (membersRes.error || rolesRes.error || divisionsRes.error || programsRes.error || orgsRes.error) {
        throw new Error('Database Error');
      }

      setMembers(membersRes.data || []);
      setRoles(rolesRes.data || []);
      setDivisions(divisionsRes.data || []);
      setGroups(groupsRes.data || []); 
      setPrograms(programsRes.data || []);
      setOrganizations(orgsRes.data || []);
      setEvents(eventsRes.data || []);
      
      const loadedEventIds = (eventsRes.data || []).map((e: any) => e.id);
      const filteredAttendance = (attendRes.data || []).filter((a: any) => loadedEventIds.includes(a.event_id));
      setAttendance(filteredAttendance);

      if (userData && userData.roles && userData.roles.permissions) {
          setUserPermissions(userData.roles.permissions);
      } else if (isSuper) {
          setUserPermissions(['DASHBOARD', 'MEMBERS', 'DIVISIONS', 'ORGANIZATIONS', 'GROUPS', 'PROGRAMS', 'ROLES', 'EVENTS', 'FINANCE', 'EDUCATORS', 'MASTER_FOUNDATION', 'PROFILE', 'DOCUMENTATION']);
      } else {
          setUserPermissions(['DASHBOARD', 'PROFILE', 'DOCUMENTATION']); // Default minimal including Docs
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      setDbError(true); 
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (session) {
      setLoadingData(true); 
      fetchData();
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setMembers([]);
    setRoles([]);
    setDivisions([]);
    setOrganizations([]);
    setGroups([]);
    setPrograms([]);
    setEvents([]);
    setAttendance([]);
    setFoundations([]);
    setUserPermissions([]);
    setActiveFoundation(null);
    setIsSuperAdmin(false);
    setView('DASHBOARD');
  };

  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  const canAccess = (viewId: ViewState) => {
      if (viewId === 'PROFILE') return true; 
      if (viewId === 'DOCUMENTATION') return true; // Usually docs are public to auth users, but we can check permission too
      
      // If user has specific permission list, check it
      if (userPermissions.length > 0) {
          // Fallback check if strict
          if (!userPermissions.includes(viewId)) return false;
      } else {
          // If no permissions loaded yet, deny sensitive stuff
          return false;
      }

      if (viewId === 'MASTER_FOUNDATION') return isSuperAdmin;
      
      if (activeFoundation && activeFoundation.features) {
          if (viewId === 'DASHBOARD') return true;
          // Feature check for Foundation level
          return activeFoundation.features.includes(viewId);
      }

      return true; 
  }

  const NavItem = ({ id, label, icon: Icon }: { id: ViewState; label: string; icon: any }) => {
    if (!canAccess(id)) return null;

    return (
        <button
        onClick={() => setView(id)}
        title={isSidebarCollapsed ? label : ''}
        className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-lg transition text-sm font-medium ${
            view === id 
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
        >
        <Icon size={20} className="shrink-0" />
        {!isSidebarCollapsed && <span>{label}</span>}
        </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
      {/* Sidebar (Desktop) */}
      <aside 
        className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border fixed inset-y-0 left-0 z-20 hidden md:flex flex-col transition-all duration-300 ease-in-out`}
      >
        <div className={`p-6 border-b border-gray-100 dark:border-dark-border flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 animate-in fade-in duration-300">
              <div className="bg-primary-600 dark:bg-primary-500 p-1.5 rounded-lg text-white">
                <Layers size={20} />
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">E-Rapi</span>
            </div>
          )}
          {isSidebarCollapsed && (
             <div className="bg-primary-600 dark:bg-primary-500 p-1.5 rounded-lg text-white">
                <Layers size={20} />
             </div>
          )}
        </div>
        
        {/* Toggle Button */}
        <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-20 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full p-1 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300"
        >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden mt-4">
          {!isSidebarCollapsed && (
            <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-4 transition-opacity duration-300">
              Menu Utama
            </div>
          )}
          <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
          
          <NavItem id="EVENTS" label="Acara & Absensi" icon={CalendarDays} />
          <NavItem id="EDUCATORS" label="Tenaga Pendidik" icon={GraduationCap} />
          <NavItem id="FINANCE" label="Pengajuan Keuangan" icon={FileText} />
          <NavItem id="ORGANIZATIONS" label="Organisasi" icon={Building2} />
          <NavItem id="GROUPS" label="Kelompok" icon={Boxes} />
          <NavItem id="MEMBERS" label="Anggota" icon={Users} />
          <NavItem id="ROLES" label="Role & Akses" icon={ShieldCheck} />
          <NavItem id="DIVISIONS" label="Bidang" icon={Layers} />
          <NavItem id="PROGRAMS" label="Program Kerja" icon={Briefcase} />

          <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>
          <NavItem id="DOCUMENTATION" label="Dokumentasi" icon={Book} />
          <NavItem id="PROFILE" label="Profil Saya" icon={User} />

          {canAccess('MASTER_FOUNDATION') && (
              <>
                 <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>
                 <NavItem id="MASTER_FOUNDATION" label="Master Yayasan" icon={Globe} />
              </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-dark-border space-y-2">
          {activeFoundation && !isSidebarCollapsed && (
             <div className="mb-2 px-2 text-xs text-gray-400 text-center border-b border-gray-100 dark:border-gray-700 pb-2">
                 Yayasan Aktif:<br/>
                 <strong className="text-gray-600 dark:text-gray-300">{activeFoundation.name}</strong>
             </div>
          )}
           {!activeFoundation && isSuperAdmin && !isSidebarCollapsed && (
             <div className="mb-2 px-2 text-xs text-gray-400 text-center border-b border-gray-100 dark:border-gray-700 pb-2">
                 Mode:<br/>
                 <strong className="text-red-600 dark:text-red-400">Super Admin (Global)</strong>
             </div>
          )}

          <button
            onClick={toggleFullScreen}
            title={isSidebarCollapsed ? (isFullScreen ? 'Keluar Full Screen' : 'Full Screen') : ''}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition text-sm font-medium`}
          >
            {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            {!isSidebarCollapsed && <span>{isFullScreen ? 'Exit Full Screen' : 'Full Screen'}</span>}
          </button>

          <button
            onClick={toggleTheme}
            title={isSidebarCollapsed ? (theme === 'light' ? 'Mode Gelap' : 'Mode Terang') : ''}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition text-sm font-medium`}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            {!isSidebarCollapsed && <span>{theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}</span>}
          </button>
          
          <button
            onClick={handleLogout}
            title={isSidebarCollapsed ? 'Keluar' : ''}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-sm font-medium`}
          >
            <LogOut size={20} />
            {!isSidebarCollapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border z-20 px-4 py-3 flex justify-between items-center transition-colors duration-200">
        <span className="font-bold text-gray-900 dark:text-white">E-Rapi</span>
        <div className="flex gap-2">
           <button onClick={toggleFullScreen} className="text-gray-500 dark:text-gray-400">
             {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
           </button>
           <button onClick={toggleTheme} className="text-gray-500 dark:text-gray-400">
             {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
           </button>
           <button onClick={handleLogout} className="text-gray-500 dark:text-gray-400">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className={`flex-1 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} p-4 md:p-8 mt-12 md:mt-0 overflow-y-auto transition-all duration-300 ease-in-out`}>
        {dbError && (
           <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
             <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold">Koneksi Database Gagal</p>
                    <p className="text-sm">Gagal mengambil data dari Supabase. Pastikan tabel telah dibuat.</p>
                </div>
                <button 
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-3 py-1.5 rounded text-xs hover:bg-red-700 transition flex items-center gap-1"
                >
                    <LogOut size={12} /> Force Logout
                </button>
             </div>
             <Help />
           </div>
        )}

        {!dbError && loadingData ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            Memuat data...
          </div>
        ) : (
          <div className="max-w-7xl mx-auto animate-in fade-in duration-300 relative">
            {view === 'DASHBOARD' && canAccess('DASHBOARD') && (
              <Dashboard 
                members={members} 
                programs={programs} 
                divisions={divisions} 
                events={events}
                attendance={attendance}
                organizations={organizations} 
                isDarkMode={theme === 'dark'} 
                activeFoundation={activeFoundation}
              />
            )}
            
            {view === 'PROFILE' && (
                <Profile currentUser={currentUser} isSuperAdmin={isSuperAdmin} />
            )}

            {view === 'DOCUMENTATION' && canAccess('DOCUMENTATION') && (
                <Documentation />
            )}

            {view === 'EVENTS' && canAccess('EVENTS') && (
              <Events 
                events={events}
                members={members}
                attendance={attendance}
                onRefresh={fetchData}
                activeFoundation={activeFoundation} 
                isSuperAdmin={isSuperAdmin} 
              />
            )}
            {view === 'EDUCATORS' && canAccess('EDUCATORS') && (
              <Educators 
                members={members}
                organizations={organizations}
                roles={roles}
                isSuperAdmin={isSuperAdmin} 
              />
            )}
            {view === 'FINANCE' && canAccess('FINANCE') && (
              <Finance 
                programs={programs}
                divisions={divisions}
                organizations={organizations}
                currentUser={currentUser} // Pass Current User
              />
            )}
            {view === 'ORGANIZATIONS' && canAccess('ORGANIZATIONS') && (
              <Organizations 
                data={organizations} 
                members={members}
                roles={roles}
                groups={groups}
                onRefresh={fetchData} 
                activeFoundation={activeFoundation}
                isSuperAdmin={isSuperAdmin} 
              />
            )}
            {view === 'GROUPS' && canAccess('GROUPS') && (
              <Groups 
                data={groups} 
                organizations={organizations}
                members={members}
                onRefresh={fetchData} 
                activeFoundation={activeFoundation}
                isSuperAdmin={isSuperAdmin} 
              />
            )}
            {view === 'MEMBERS' && canAccess('MEMBERS') && (
              <Members 
                data={members} 
                roles={roles} 
                divisions={divisions} 
                organizations={organizations}
                foundations={foundations}
                onRefresh={fetchData} 
                currentUserEmail={session?.user?.email}
                isSuperAdmin={isSuperAdmin}
                activeFoundation={activeFoundation} 
              />
            )}
            {view === 'ROLES' && canAccess('ROLES') && (
              <Roles 
                data={roles} 
                onRefresh={fetchData} 
                activeFoundation={activeFoundation} 
                isSuperAdmin={isSuperAdmin} 
              />
            )}
            {view === 'DIVISIONS' && canAccess('DIVISIONS') && (
              <Divisions 
                data={divisions} 
                members={members}
                programs={programs}
                onRefresh={fetchData} 
                activeFoundation={activeFoundation} 
                isSuperAdmin={isSuperAdmin} 
              />
            )}
            {view === 'PROGRAMS' && canAccess('PROGRAMS') && (
              <Programs 
                data={programs} 
                divisions={divisions} 
                organizations={organizations}
                members={members}
                onRefresh={fetchData} 
                activeFoundation={activeFoundation} 
                isSuperAdmin={isSuperAdmin} 
              />
            )}
            {view === 'MASTER_FOUNDATION' && canAccess('MASTER_FOUNDATION') && (
              <Foundations 
                data={foundations} 
                onRefresh={fetchData} 
              />
            )}

            {!canAccess(view) && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <Lock size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
                    <h2 className="text-lg font-bold text-gray-600 dark:text-gray-300">Akses Ditolak / Fitur Nonaktif</h2>
                    <p className="text-center text-sm">
                        Anda tidak memiliki izin untuk melihat halaman ini.<br/>
                        Hubungi Super Admin jika ini kesalahan.
                    </p>
                </div>
            )}
          </div>
        )}
      </main>
      
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 w-full bg-white dark:bg-dark-card border-t border-gray-200 dark:border-dark-border z-20 flex justify-around p-2 transition-colors duration-200 overflow-x-auto">
        {canAccess('DASHBOARD') && <button onClick={() => setView('DASHBOARD')} className={`p-2 rounded ${view === 'DASHBOARD' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}><LayoutDashboard size={20}/></button>}
        {canAccess('EVENTS') && <button onClick={() => setView('EVENTS')} className={`p-2 rounded ${view === 'EVENTS' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}><CalendarDays size={20}/></button>}
        {canAccess('FINANCE') && <button onClick={() => setView('FINANCE')} className={`p-2 rounded ${view === 'FINANCE' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}><FileText size={20}/></button>}
        <button onClick={() => setView('PROFILE')} className={`p-2 rounded ${view === 'PROFILE' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}><User size={20}/></button>
      </div>
    </div>
  );
};

export default App;