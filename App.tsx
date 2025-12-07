import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { ViewState, Member, Role, Division, Program, Organization, Event, EventAttendance } from './types';
import { Auth } from './components/Auth';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Divisions } from './pages/Divisions';
import { Organizations } from './pages/Organizations';
import { Programs } from './pages/Programs';
import { Events } from './pages/Events';
import { Finance } from './pages/Finance'; 
import { Educators } from './pages/Educators'; // Import Educators
import { Roles } from './pages/Roles';
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
  Lock
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
  const [programs, setPrograms] = useState<Program[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<EventAttendance[]>([]);
  
  // Permission State
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  
  const [loadingData, setLoadingData] = useState(false);
  const [dbError, setDbError] = useState(false);

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
      const [membersRes, rolesRes, divisionsRes, programsRes, orgsRes, eventsRes, attendRes] = await Promise.all([
        supabase.from('members').select('*, divisions(name), roles(name, permissions)'), 
        supabase.from('roles').select('*'),
        supabase.from('divisions').select('*'),
        supabase.from('programs').select('*'),
        supabase.from('organizations').select('*'),
        supabase.from('events').select('*'),
        supabase.from('event_attendance').select('*')
      ]);

      if (membersRes.error || rolesRes.error || divisionsRes.error || programsRes.error || orgsRes.error) {
        throw new Error('Database Error');
      }

      setMembers(membersRes.data || []);
      setRoles(rolesRes.data || []);
      setDivisions(divisionsRes.data || []);
      setPrograms(programsRes.data || []);
      setOrganizations(orgsRes.data || []);
      setEvents(eventsRes.data || []);
      setAttendance(attendRes.data || []);

      // --- DETERMINE PERMISSIONS ---
      // Find the current logged-in user in the members list
      const currentUserEmail = session.user.email;
      const currentUser = membersRes.data?.find((m: any) => m.email === currentUserEmail);
      
      if (currentUser && currentUser.roles && currentUser.roles.permissions) {
          setUserPermissions(currentUser.roles.permissions);
      } else if (currentUserEmail === 'super@yayasan.org') {
          // Fallback for hardcoded super admin
          setUserPermissions(['DASHBOARD', 'MEMBERS', 'DIVISIONS', 'ORGANIZATIONS', 'PROGRAMS', 'ROLES', 'EVENTS', 'FINANCE', 'EDUCATORS']);
      } else {
          // Default: No permissions or maybe just Dashboard
          setUserPermissions(['DASHBOARD']); 
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      // setDbError(true); 
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
  };

  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  // Permission Checker
  const canAccess = (viewId: ViewState) => {
      if (userPermissions.length === 0) return false;
      return userPermissions.includes(viewId);
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
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">E-Yayasan</span>
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
          <NavItem id="MEMBERS" label="Anggota" icon={Users} />
          <NavItem id="ROLES" label="Role & Akses" icon={ShieldCheck} />
          <NavItem id="DIVISIONS" label="Bidang" icon={Layers} />
          <NavItem id="PROGRAMS" label="Program Kerja" icon={Briefcase} />
        </nav>

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

      {/* Mobile Header (Visible only on small screens) */}
      <div className="md:hidden fixed top-0 w-full bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border z-20 px-4 py-3 flex justify-between items-center transition-colors duration-200">
        <span className="font-bold text-gray-900 dark:text-white">E-Yayasan</span>
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
             <p className="font-bold">Koneksi Database Gagal</p>
             <p className="text-sm">Gagal mengambil data dari Supabase. Pastikan tabel telah dibuat.</p>
             <Help />
           </div>
        )}

        {!dbError && loadingData ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            Memuat data...
          </div>
        ) : (
          <div className="max-w-7xl mx-auto animate-in fade-in duration-300 relative">
            
            {/* View Rendering with Permission Checks */}
            
            {view === 'DASHBOARD' && canAccess('DASHBOARD') && (
              <Dashboard 
                members={members} 
                programs={programs} 
                divisions={divisions} 
                events={events}
                attendance={attendance}
                isDarkMode={theme === 'dark'} 
              />
            )}
            {view === 'EVENTS' && canAccess('EVENTS') && (
              <Events 
                events={events}
                members={members}
                attendance={attendance}
                onRefresh={fetchData}
              />
            )}
            {view === 'EDUCATORS' && canAccess('EDUCATORS') && (
              <Educators 
                members={members}
                organizations={organizations}
                roles={roles}
              />
            )}
            {view === 'FINANCE' && canAccess('FINANCE') && (
              <Finance 
                programs={programs}
                divisions={divisions}
                organizations={organizations}
              />
            )}
            {view === 'ORGANIZATIONS' && canAccess('ORGANIZATIONS') && (
              <Organizations 
                data={organizations} 
                onRefresh={fetchData} 
              />
            )}
            {view === 'MEMBERS' && canAccess('MEMBERS') && (
              <Members 
                data={members} 
                roles={roles} 
                divisions={divisions} 
                organizations={organizations}
                onRefresh={fetchData} 
                currentUserEmail={session?.user?.email}
              />
            )}
            {view === 'ROLES' && canAccess('ROLES') && (
              <Roles 
                data={roles} 
                onRefresh={fetchData} 
              />
            )}
            {view === 'DIVISIONS' && canAccess('DIVISIONS') && (
              <Divisions 
                data={divisions} 
                members={members}
                programs={programs}
                onRefresh={fetchData} 
              />
            )}
            {view === 'PROGRAMS' && canAccess('PROGRAMS') && (
              <Programs 
                data={programs} 
                divisions={divisions} 
                organizations={organizations}
                members={members}
                onRefresh={fetchData} 
              />
            )}

            {/* Access Denied / Fallback */}
            // {!canAccess(view) && (
            //     <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            //         <Lock size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
            //         <h2 className="text-lg font-bold text-gray-600 dark:text-gray-300">Akses Ditolak</h2>
            //         <p>Anda tidak memiliki izin untuk melihat halaman ini.</p>
            //     </div>
            // )}
          </div>
        )}
      </main>
      
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 w-full bg-white dark:bg-dark-card border-t border-gray-200 dark:border-dark-border z-20 flex justify-around p-2 transition-colors duration-200 overflow-x-auto">
        {canAccess('DASHBOARD') && <button onClick={() => setView('DASHBOARD')} className={`p-2 rounded ${view === 'DASHBOARD' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}><LayoutDashboard size={20}/></button>}
        {canAccess('EVENTS') && <button onClick={() => setView('EVENTS')} className={`p-2 rounded ${view === 'EVENTS' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}><CalendarDays size={20}/></button>}
        {canAccess('EDUCATORS') && <button onClick={() => setView('EDUCATORS')} className={`p-2 rounded ${view === 'EDUCATORS' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}><GraduationCap size={20}/></button>}
        {canAccess('FINANCE') && <button onClick={() => setView('FINANCE')} className={`p-2 rounded ${view === 'FINANCE' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}><FileText size={20}/></button>}
      </div>
    </div>
  );
};

export default App;