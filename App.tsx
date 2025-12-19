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
import { Documentation } from './pages/Documentation'; 
import { MemberPortal } from './pages/MemberPortal';
import { Scanner } from './pages/Scanner'; 
import { MemberCards } from './pages/MemberCards';
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
  CalendarDays,
  Maximize2,
  Minimize2,
  GraduationCap,
  Globe,
  Boxes,
  User,
  Book, 
  AlertTriangle,
  ScanBarcode,
  RefreshCw,
  BadgeCheck,
  FileText,
  Menu,
  X
} from './components/ui/Icons';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hasSetInitialView, setHasSetInitialView] = useState(false);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [groups, setGroups] = useState<Group[]>([]); 
  const [programs, setPrograms] = useState<Program[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<EventAttendance[]>([]);
  const [foundations, setFoundations] = useState<Foundation[]>([]); 
  
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [activeFoundation, setActiveFoundation] = useState<Foundation | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [dbError, setDbError] = useState<any>(null); 

  const currentUser = useMemo(() => {
      if (!session || !members.length) return null;
      return members.find(m => m.email === session.user.email) || null;
  }, [session, members]);

  const hasManagementAccess = useMemo(() => userPermissions.length > 0, [userPermissions]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (!session) {
            setHasSetInitialView(false);
        }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!session) return;
    setDbError(null);
    setLoadingData(true);
    
    try {
      const userEmail = session.user.email;
      const { data: userData } = await supabase.from('members').select('*, roles(name, permissions)').eq('email', userEmail).single();

      let isSuper = userEmail === 'super@yayasan.org' || userData?.roles?.name?.toLowerCase().includes('super');
      setIsSuperAdmin(isSuper);

      const { data: allFoundations } = await supabase.from('foundations').select('*');
      setFoundations(allFoundations || []);

      let currentFoundationId = userData?.foundation_id;
      if (currentFoundationId) {
          setActiveFoundation(allFoundations?.find((f: any) => f.id === currentFoundationId) || null);
      }

      let membersQuery = supabase.from('members').select('*, divisions:divisions!members_division_id_fkey(name), roles(name, permissions), foundations(name), organizations(name), groups(name)'); 
      let rolesQuery = supabase.from('roles').select('*');
      let divisionsQuery = supabase.from('divisions').select('*').order('order_index', { ascending: true }); 
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

      setMembers(membersRes.data || []);
      setRoles(rolesRes.data || []);
      setDivisions(divisionsRes.data || []);
      setGroups(groupsRes.data || []); 
      setPrograms(programsRes.data || []);
      setOrganizations(orgsRes.data || []);
      setEvents(eventsRes.data || []);
      setAttendance(attendRes.data || []);

      let perms: string[] = [];
      if (isSuper) {
          perms = ['DASHBOARD', 'MEMBERS', 'DIVISIONS', 'ORGANIZATIONS', 'GROUPS', 'PROGRAMS', 'ROLES', 'EVENTS', 'FINANCE', 'EDUCATORS', 'MASTER_FOUNDATION', 'PROFILE', 'DOCUMENTATION', 'SCANNER', 'MEMBER_CARDS'];
      } else if (userData?.roles?.permissions) {
          perms = [...userData.roles.permissions];
          if (userData.member_type === 'Scanner') {
              if (!perms.includes('SCANNER')) perms.push('SCANNER');
          }
          if (!perms.includes('MEMBER_CARDS')) perms.push('MEMBER_CARDS');
      }
      setUserPermissions(perms);

      if (!hasSetInitialView) {
          if (isSuper) {
              setView('DASHBOARD');
          } else if (userData?.member_type === 'Scanner') {
              setView('SCANNER');
          } else if (perms.length > 0) {
              if (perms.includes('DASHBOARD')) setView('DASHBOARD');
              else setView(perms[0] as ViewState);
          } else {
              setView('MEMBER_PORTAL');
          }
          setHasSetInitialView(true);
      }
    } catch (error: any) {
      setDbError(error.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { if (session) fetchData(); }, [session]);

  if (!session) return <Auth onLogin={() => {}} />;

  if (currentUser && currentUser.member_type !== 'Scanner' && (!hasManagementAccess || currentUser.member_type === 'Generus')) {
      if (loadingData && !hasSetInitialView) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg"><RefreshCw size={40} className="animate-spin text-primary-600" /></div>;
      return <MemberPortal currentUser={currentUser} events={events} attendance={attendance} organizations={organizations} onLogout={() => supabase.auth.signOut()} onRefresh={fetchData} />;
  }

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleFullScreen = () => !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen();

  const NavItem = ({ id, label, icon: Icon }: { id: ViewState; label: string; icon: any }) => {
    if (id !== 'PROFILE' && id !== 'DOCUMENTATION' && id !== 'MEMBER_CARDS' && !userPermissions.includes(id) && (id !== 'MASTER_FOUNDATION' || !isSuperAdmin)) return null;
    
    const handleClick = () => {
        setView(id);
        setIsMobileMenuOpen(false);
    };

    return (
        <button onClick={handleClick} className={`w-full flex items-center ${isSidebarCollapsed ? 'md:justify-center md:px-2' : 'space-x-3 px-4'} py-3 rounded-lg transition text-sm font-medium ${view === id ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
        <Icon size={20} className="shrink-0" />
        <span className={`${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>{label}</span>
        </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
      
      {/* MOBILE TOP BAR */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border z-40 px-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
                <Menu size={24} />
            </button>
            <div className="flex items-center space-x-2 text-primary-600 font-bold text-lg">
                <Layers size={18} className="text-white bg-primary-600 p-0.5 rounded" />
                <span className="truncate max-w-[120px]">{activeFoundation?.name || 'E-Yayasan'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
              <button onClick={toggleTheme} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button>
              <button onClick={() => supabase.auth.signOut()} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition"><LogOut size={18}/></button>
          </div>
      </header>

      {/* MOBILE SIDEBAR BACKDROP */}
      <div 
        className={`fixed inset-0 bg-black/50 z-50 md:hidden transition-opacity duration-300 backdrop-blur-sm ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] md:z-30 bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
        w-64 shadow-2xl md:shadow-none
      `}>
        <div className={`p-6 border-b border-gray-100 dark:border-dark-border flex items-center ${isSidebarCollapsed ? 'md:justify-center' : 'justify-between'}`}>
          <div className="flex items-center space-x-2 text-primary-600 font-bold text-xl">
              <Layers size={20} className="text-white bg-primary-600 p-1 rounded" />
              <span className={`${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>E-Rapi</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto mt-2 custom-scrollbar">
          <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
          <div className="my-2 border-t border-gray-100 dark:border-gray-700 opacity-50"></div>
          <NavItem id="MEMBER_CARDS" label="Kartu Anggota" icon={BadgeCheck} />
          <NavItem id="SCANNER" label="Scanner Kehadiran" icon={ScanBarcode} />
          <NavItem id="EVENTS" label="Acara & Absensi" icon={CalendarDays} />
          <div className="my-2 border-t border-gray-100 dark:border-gray-700 opacity-50"></div>
          <NavItem id="EDUCATORS" label="Tenaga Pendidik" icon={GraduationCap} />
          <NavItem id="FINANCE" label="Keuangan" icon={FileText} />
          <NavItem id="ORGANIZATIONS" label="Organisasi" icon={Building2} />
          <NavItem id="GROUPS" label="Kelompok" icon={Boxes} />
          <NavItem id="MEMBERS" label="Anggota" icon={Users} />
          <NavItem id="ROLES" label="Role & Akses" icon={ShieldCheck} />
          <NavItem id="DIVISIONS" label="Bidang" icon={Layers} />
          <NavItem id="PROGRAMS" label="Program Kerja" icon={Briefcase} />
          <div className="my-2 border-t border-gray-100 dark:border-gray-700 opacity-50"></div>
          <NavItem id="DOCUMENTATION" label="Dokumentasi" icon={Book} />
          <NavItem id="PROFILE" label="Profil Saya" icon={User} />
          {isSuperAdmin && <NavItem id="MASTER_FOUNDATION" label="Master Yayasan" icon={Globe} />}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-dark-border space-y-1">
          <button onClick={toggleFullScreen} className="hidden md:flex w-full items-center space-x-3 px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition text-sm">
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />} 
              {!isSidebarCollapsed && <span>Full Screen</span>}
          </button>
          <button onClick={toggleTheme} className="hidden md:flex w-full items-center space-x-3 px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition text-sm">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />} 
              {!isSidebarCollapsed && <span>Mode {theme === 'light' ? 'Gelap' : 'Terang'}</span>}
          </button>
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center space-x-3 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-sm font-medium">
              <LogOut size={18} /> 
              {!isSidebarCollapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 p-4 md:p-8 transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} mt-14 md:mt-0`}>
        {loadingData && !hasSetInitialView ? <div className="h-full flex flex-col items-center justify-center"><RefreshCw size={40} className="animate-spin text-primary-600 mb-4" /><p className="text-gray-500 text-sm animate-pulse">Sinkronisasi data...</p></div> : 
         dbError ? <div className="h-full flex flex-col items-center justify-center p-8 bg-white dark:bg-dark-card rounded-2xl border border-red-100 shadow-xl max-w-2xl mx-auto my-12"><AlertTriangle size={64} className="text-red-500 mb-6" /><h3 className="text-2xl font-bold mb-4">Gagal Memuat Sistem</h3><p className="text-sm text-red-600 font-mono mb-8">{dbError}</p><button onClick={() => window.location.reload()} className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition">Coba Muat Ulang</button></div> :
         <div className="max-w-7xl mx-auto">
             {view === 'DASHBOARD' && <Dashboard members={members} programs={programs} divisions={divisions} events={events} attendance={attendance} organizations={organizations} isDarkMode={theme === 'dark'} activeFoundation={activeFoundation} />}
             {view === 'MEMBERS' && <Members data={members} roles={roles} divisions={divisions} organizations={organizations} foundations={foundations} onRefresh={fetchData} isSuperAdmin={isSuperAdmin} activeFoundation={activeFoundation} />}
             {view === 'DIVISIONS' && <Divisions data={divisions} members={members} programs={programs} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'ORGANIZATIONS' && <Organizations data={organizations} members={members} roles={roles} groups={groups} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'GROUPS' && <Groups data={groups} organizations={organizations} members={members} roles={roles} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'PROGRAMS' && <Programs data={programs} divisions={divisions} organizations={organizations} members={members} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'EVENTS' && <Events events={events} members={members} attendance={attendance} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'SCANNER' && <Scanner events={events} members={members} onRefresh={fetchData} />}
             {view === 'MEMBER_CARDS' && <MemberCards members={members} activeFoundation={activeFoundation} organizations={organizations} groups={groups} />}
             {view === 'FINANCE' && <Finance programs={programs} divisions={divisions} organizations={organizations} currentUser={currentUser} />}
             {view === 'EDUCATORS' && <Educators members={members} organizations={organizations} roles={roles} isSuperAdmin={isSuperAdmin} />}
             {view === 'ROLES' && <Roles data={roles} onRefresh={fetchData} activeFoundation={activeFoundation} isSuperAdmin={isSuperAdmin} />}
             {view === 'MASTER_FOUNDATION' && isSuperAdmin && <Foundations data={foundations} onRefresh={fetchData} />}
             {view === 'PROFILE' && <Profile currentUser={currentUser} isSuperAdmin={isSuperAdmin} />}
             {view === 'DOCUMENTATION' && <Documentation />}
         </div>}
      </main>
    </div>
  );
};

export default App;
