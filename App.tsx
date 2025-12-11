
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
// import { Attendance } from './pages/Attendance'; // MERGED INTO EVENTS
import { Finance } from './pages/Finance'; 
import { Educators } from './pages/Educators'; 
import { Roles } from './pages/Roles';
import { Foundations } from './pages/Foundations'; 
import { Profile } from './pages/Profile'; 
import { Documentation } from './pages/Documentation'; 
import { MemberPortal } from './pages/MemberPortal';
import { Scanner } from './pages/Scanner'; 
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
  Book, 
  AlertTriangle,
  ScanBarcode,
  ClipboardCheck
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
  const [dbError, setDbError] = useState<any>(null); // Store full error object

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
    setDbError(null);
    
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

      // Explicitly specify 'divisions' relationship to avoid ambiguity with 'head_member_id'
      let membersQuery = supabase.from('members').select('*, divisions:divisions!members_division_id_fkey(name), roles(name, permissions), foundations(name), organizations(name), groups(name)'); 
      
      let rolesQuery = supabase.from('roles').select('*');
      let divisionsQuery = supabase.from('divisions').select('*').order('order_index', { ascending: true }); // SORT BY ORDER
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

      const errors = [];
      if (membersRes.error) errors.push({ table: 'members', error: membersRes.error });
      if (rolesRes.error) errors.push({ table: 'roles', error: rolesRes.error });
      if (divisionsRes.error) errors.push({ table: 'divisions', error: divisionsRes.error });
      if (programsRes.error) errors.push({ table: 'programs', error: programsRes.error });
      if (orgsRes.error) errors.push({ table: 'organizations', error: orgsRes.error });
      if (eventsRes.error) errors.push({ table: 'events', error: eventsRes.error });
      if (attendRes.error) errors.push({ table: 'event_attendance', error: attendRes.error });

      if (groupsRes.error) {
          console.warn("Table 'groups' error (likely missing or permission):", groupsRes.error);
      }

      if (errors.length > 0) {
        setDbError(errors); 
        console.error("Critical Database Errors:", JSON.stringify(errors, null, 2));
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
          setUserPermissions(['DASHBOARD', 'MEMBERS', 'DIVISIONS', 'ORGANIZATIONS', 'GROUPS', 'PROGRAMS', 'ROLES', 'EVENTS', 'FINANCE', 'EDUCATORS', 'MASTER_FOUNDATION', 'PROFILE', 'DOCUMENTATION', 'SCANNER']);
      } else {
          setUserPermissions([]); 
          setView('MEMBER_PORTAL'); 
      }

    } catch (error: any) {
      console.error('Error fetching data process:', error);
      if (!dbError) setDbError({ message: error.message });
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

  if (currentUser && (!userPermissions.length || !userPermissions.includes('DASHBOARD') || currentUser.member_type === 'Generus')) {
      if (loadingData) return <div className="h-screen flex items-center justify-center">Loading...</div>;
      
      return (
          <MemberPortal 
            currentUser={currentUser} 
            events={events} 
            attendance={attendance} 
            organizations={organizations}
            programs={programs} 
            divisions={divisions} 
            onLogout={handleLogout}
            onRefresh={fetchData}
          />
      );
  }

  const canAccess = (viewId: ViewState) => {
      if (viewId === 'PROFILE') return true; 
      if (viewId === 'DOCUMENTATION') return true; 
      if (userPermissions.length > 0) {
          if (!userPermissions.includes(viewId)) return false;
      } else {
          return false;
      }
      if (viewId === 'MASTER_FOUNDATION') return isSuperAdmin;
      if (activeFoundation && activeFoundation.features) {
          if (viewId === 'DASHBOARD') return true;
          // Note: Features might be using old keys, assuming basic access for now or update foundation features logic
          return true; 
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
          
          <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>
          {/* SEPARATED MENUS */}
          <NavItem id="EVENTS" label="Acara & Absensi" icon={CalendarDays} />
          <NavItem id="SCANNER" label="Scanner" icon={ScanBarcode} />
          
          <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>

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

        {/* ... (Footer section remains the same) ... */}
        <div className="p-4 border-t border-gray-100 dark:border-dark-border space-y-2">
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
        </div>
      </div>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-dark-card border-t border-gray-200 dark:border-dark-border z-20 flex justify-around p-2">
        <button onClick={() => setView('DASHBOARD')} className={`p-2 rounded-lg ${view === 'DASHBOARD' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30' : 'text-gray-500 dark:text-gray-400'}`}>
          <LayoutDashboard size={24} />
        </button>
        <button onClick={() => setView('EVENTS')} className={`p-2 rounded-lg ${view === 'EVENTS' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30' : 'text-gray-500 dark:text-gray-400'}`}>
          <CalendarDays size={24} />
        </button>
        {canAccess('SCANNER') && (
            <button onClick={() => setView('SCANNER')} className={`p-2 rounded-lg ${view === 'SCANNER' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30' : 'text-gray-500 dark:text-gray-400'}`}>
            <ScanBarcode size={24} />
            </button>
        )}
        <button onClick={handleLogout} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600">
          <LogOut size={24} />
        </button>
      </nav>

      {/* Main Content */}
      <main className={`flex-1 p-4 md:p-8 transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} mt-14 md:mt-0 mb-16 md:mb-0`}>
        {loadingData ? (
           <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <p className="mt-2 text-gray-500 text-sm">Memuat data...</p>
              </div>
           </div>
        ) : dbError ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <AlertTriangle size={48} className="text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Gagal Memuat Data</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mt-2">
                    Terjadi kesalahan saat menghubungkan ke database Supabase. 
                    Pastikan Anda telah menjalankan setup script database.
                </p>
                <div className="mt-4 w-full max-w-2xl bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-left overflow-auto max-h-48 border border-red-100 dark:border-red-800">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">Error Details:</p>
                    <pre className="text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap font-mono">
                        {JSON.stringify(dbError, null, 2)}
                    </pre>
                </div>
                <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md">
                    Coba Lagi
                </button>
                <div className="mt-8 text-left w-full max-w-2xl">
                     <Help />
                </div>
            </div>
        ) : (
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
             {view === 'DASHBOARD' && <Dashboard members={members} programs={programs} divisions={divisions} events={events} attendance={attendance} organizations={organizations} isDarkMode={theme === 'dark'} activeFoundation={activeFoundation} />}
             {view === 'MEMBERS' && <Members data={members} roles={roles} divisions={divisions} organizations={organizations} foundations={foundations} onRefresh={fetchData} currentUserEmail={session.user.email} isSuperAdmin={isSuperAdmin} activeFoundation={activeFoundation} />}
             {view === 'DIVISIONS' && <Divisions data={divisions} members={members} programs={programs} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'ORGANIZATIONS' && <Organizations data={organizations} members={members} roles={roles} groups={groups} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'GROUPS' && <Groups data={groups} organizations={organizations} members={members} roles={roles} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'PROGRAMS' && <Programs data={programs} divisions={divisions} organizations={organizations} members={members} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             
             {/* EVENTS NOW HANDLES ATTENDANCE */}
             {view === 'EVENTS' && <Events events={events} members={members} attendance={attendance} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             
             {view === 'SCANNER' && <Scanner events={events} members={members} onRefresh={fetchData} />}
             
             {view === 'FINANCE' && <Finance programs={programs} divisions={divisions} organizations={organizations} currentUser={currentUser} />}
             {view === 'EDUCATORS' && <Educators members={members} organizations={organizations} roles={roles} isSuperAdmin={isSuperAdmin} />}
             {view === 'ROLES' && <Roles data={roles} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'MASTER_FOUNDATION' && <Foundations data={foundations} onRefresh={fetchData} />}
             {view === 'PROFILE' && <Profile currentUser={currentUser} isSuperAdmin={isSuperAdmin} />}
             {view === 'DOCUMENTATION' && <Documentation />}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
