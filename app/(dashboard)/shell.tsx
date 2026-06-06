'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import type { ViewState } from '@/types';
import {
  LayoutDashboard, Users, Layers, Briefcase, LogOut, Sun, Moon, Building2,
  ShieldCheck, CalendarDays, Maximize2, Minimize2, GraduationCap, Globe,
  Boxes, User, Book, ScanBarcode, BadgeCheck, FileText, Menu, X,
  ChevronLeft, ChevronRight, MessageSquare,
} from '@/components/ui/Icons';

interface ShellProps {
  children: React.ReactNode;
  permissions: string[];
  isSuperAdmin: boolean;
  foundationName: string;
}

// Path mapping mirrors the old App.tsx NavItem logic.
const pathFor = (id: ViewState) =>
  id === 'DASHBOARD' ? '/' : `/${id.toLowerCase().replace('_', '-')}`;

export function Shell({ children, permissions, isSuperAdmin, foundationName }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Hydrate UI prefs from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setIsSidebarCollapsed(localStorage.getItem('sidebar-collapsed') === 'true');
    setTheme((localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((p) => (p === 'light' ? 'dark' : 'light'));
  const toggleSidebar = () => setIsSidebarCollapsed((p) => !p);
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
    setIsFullScreen((p) => !p);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const NavItem = ({ id, label, icon: Icon }: { id: ViewState; label: string; icon: any }) => {
    if (
      id !== 'PROFILE' && id !== 'DOCUMENTATION' && id !== 'MEMBER_CARDS' &&
      !permissions.includes(id) && (id !== 'MASTER_FOUNDATION' || !isSuperAdmin)
    ) return null;

    const path = pathFor(id);
    const isActive = id === 'DASHBOARD' ? pathname === '/' : pathname === path;

    return (
      <Link
        href={path}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`w-full flex items-center transition-all duration-300 py-3 rounded-xl text-sm font-medium overflow-hidden ${
          isSidebarCollapsed ? 'justify-center px-0 mx-0' : 'space-x-3 px-4'
        } ${
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
        title={isSidebarCollapsed ? label : undefined}
      >
        <Icon size={22} className="shrink-0" />
        {!isSidebarCollapsed && <span className="whitespace-nowrap">{label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border z-40 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><Menu size={24} /></button>
          <div className="flex items-center space-x-2 text-primary-600 font-bold text-lg"><Layers size={18} className="text-white bg-primary-600 p-0.5 rounded" /><span className="truncate max-w-[120px]">{foundationName}</span></div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
          <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition"><LogOut size={18} /></button>
        </div>
      </header>

      <div className={`fixed inset-0 bg-black/50 z-50 md:hidden transition-opacity duration-300 backdrop-blur-sm ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMobileMenuOpen(false)} />

      <aside className={`fixed inset-y-0 left-0 z-[60] md:z-30 bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border flex flex-col transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${isSidebarCollapsed ? 'md:w-[72px]' : 'md:w-64'} w-64 shadow-2xl md:shadow-none`}>
        <div className={`p-5 border-b border-gray-100 dark:border-dark-border flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center space-x-3 text-primary-600 font-bold text-xl overflow-hidden">
            <div className="bg-primary-600 p-1.5 rounded-xl text-white shadow-lg shadow-primary-600/20 shrink-0"><Layers size={20} /></div>
            {!isSidebarCollapsed && <span>Ruang-GMB</span>}
          </div>
          <button onClick={toggleSidebar} className="hidden md:flex p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors">
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X size={20} /></button>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto mt-2 custom-scrollbar">
          <NavItem id="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
          <div className={`my-4 border-t border-gray-100 dark:border-gray-800 transition-all ${isSidebarCollapsed ? 'mx-2' : 'mx-4'}`}></div>
          <NavItem id="MEMBER_CARDS" label="Kartu Anggota" icon={BadgeCheck} />
          <NavItem id="SCANNER" label="Scanner Kehadiran" icon={ScanBarcode} />
          <NavItem id="EVENTS" label="Acara & Absensi" icon={CalendarDays} />
          <NavItem id="FORUMS" label="Forum Khusus" icon={MessageSquare} />
          <div className={`my-4 border-t border-gray-100 dark:border-gray-800 transition-all ${isSidebarCollapsed ? 'mx-2' : 'mx-4'}`}></div>
          <NavItem id="EDUCATORS" label="Tenaga Pendidik" icon={GraduationCap} />
          <NavItem id="FINANCE" label="Keuangan" icon={FileText} />
          <NavItem id="ORGANIZATIONS" label="Organisasi" icon={Building2} />
          <NavItem id="WORKPLACES" label="Kantor/Tempat Kerja" icon={Building2} />
          <NavItem id="VILLAGES" label="Desa" icon={Globe} />
          <NavItem id="GROUPS" label="Kelompok" icon={Boxes} />
          <NavItem id="MEMBERS" label="Anggota" icon={Users} />
          <NavItem id="ROLES" label="Role & Akses" icon={ShieldCheck} />
          <NavItem id="DIVISIONS" label="Bidang" icon={Layers} />
          <NavItem id="PROGRAMS" label="Program Kerja" icon={Briefcase} />
          <div className={`my-4 border-t border-gray-100 dark:border-gray-800 transition-all ${isSidebarCollapsed ? 'mx-2' : 'mx-4'}`}></div>
          <NavItem id="DOCUMENTATION" label="Dokumentasi" icon={Book} />
          <NavItem id="PROFILE" label="Profil Saya" icon={User} />
          {isSuperAdmin && <NavItem id="MASTER_FOUNDATION" label="Master Yayasan" icon={Globe} />}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-dark-border space-y-1">
          <button onClick={toggleFullScreen} className={`w-full flex items-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all py-2.5 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4 space-x-3'}`} title="Layar Penuh">
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            {!isSidebarCollapsed && <span className="text-sm">Full Screen</span>}
          </button>
          <button onClick={toggleTheme} className={`w-full flex items-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all py-2.5 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4 space-x-3'}`} title={`Mode ${theme === 'light' ? 'Gelap' : 'Terang'}`}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            {!isSidebarCollapsed && <span className="text-sm">Mode {theme === 'light' ? 'Gelap' : 'Terang'}</span>}
          </button>
          <button onClick={handleLogout} className={`w-full flex items-center text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all py-2.5 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4 space-x-3'}`} title="Keluar">
            <LogOut size={18} />
            {!isSidebarCollapsed && <span className="text-sm font-medium">Keluar</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 p-4 md:p-8 transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-64'} mt-14 md:mt-0`}>
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
