import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Event, Member, EventSession, EventAttendance } from '../types';
import { supabase } from '../supabaseClient';
import { 
    ScanBarcode, Keyboard, PlayCircle, CheckCircle2, XCircle, 
    AlertTriangle, Camera, StopCircle, History, ChevronRight, 
    QrCode, RefreshCw, X, List, Users, Clock, Check, UserPlus, Timer, MessageCircle, Search, Save,
    HelpCircle, ChevronDown, ChevronUp
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface ScannerProps {
  events: Event[];
  members: Member[];
  attendance: EventAttendance[];
  onRefresh: () => void;
}

interface ScanLog {
    id: string;
    time: string;
    memberName: string;
    status: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
    message: string;
}

export const Scanner: React.FC<ScannerProps> = ({ events, members, attendance, onRefresh }) => {
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(''); 
  const [activeTab, setActiveTab] = useState<'SCAN' | 'LIST'>('SCAN');
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [lastResult, setLastResult] = useState<{status: 'SUCCESS'|'ERROR'|'WARNING'|'INFO', title: string, message: string} | null>(null);
  
  const [pendingMember, setPendingMember] = useState<Member | null>(null);
  const [isLate, setIsLate] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);
  const [manualSearch, setManualSearch] = useState('');
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [tempReason, setTempReason] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [listSearch, setListSearch] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMounted = useRef(true);
  const scanDivId = "reader-viewport-main";

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeEvents = useMemo(() => {
      const now = new Date(); 
      const threeDaysAgo = new Date(now); 
      threeDaysAgo.setDate(now.getDate() - 3);
      return events.filter(e => { 
          const eDate = new Date(e.date); 
          return eDate >= threeDaysAgo && e.status !== 'Cancelled'; 
      }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const availableSessions: EventSession[] = selectedEvent?.sessions || [{id: 'default', name: 'Kehadiran'}];
  const activeSession = availableSessions.find(s => s.id === (selectedSessionId || 'default')) || availableSessions[0];

  const manualCandidates = useMemo(() => {
    if (!manualSearch || manualSearch.length < 2) return [];
    return members.filter(m => 
        m.full_name.toLowerCase().includes(manualSearch.toLowerCase())
    ).slice(0, 5);
  }, [members, manualSearch]);

  const scannedMembers = useMemo(() => {
    if (!selectedEventId) return [];
    const currentSessionId = selectedSessionId || 'default';
    
    return attendance
        .filter(a => a.event_id === selectedEventId)
        .filter(a => {
            if (a.logs && a.logs[currentSessionId]) return true;
            if (currentSessionId === 'default' && a.check_in_time) return true;
            return false;
        })
        .map(a => {
            const member = members.find(m => m.id === a.member_id);
            const scanTime = a.logs ? a.logs[currentSessionId] : a.check_in_time;
            return {
                ...a,
                full_name: member?.full_name || 'Tidak Dikenal',
                group_name: (member as any)?.groups?.name || '-',
                scan_time_display: scanTime ? new Date(scanTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'
            };
        })
        .filter(m => m.full_name.toLowerCase().includes(listSearch.toLowerCase()))
        .sort((a, b) => {
            const timeA = a.logs ? new Date(a.logs[currentSessionId]).getTime() : 0;
            const timeB = b.logs ? new Date(b.logs[currentSessionId]).getTime() : 0;
            return timeB - timeA;
        });
  }, [attendance, members, selectedEventId, selectedSessionId, listSearch]);

  useEffect(() => {
      isMounted.current = true;
      if (selectedEvent && availableSessions.length > 0) { setSelectedSessionId(availableSessions[0].id); }
      return () => { isMounted.current = false; if (scannerRef.current?.isScanning) { scannerRef.current.stop().catch(() => {}); } };
  }, [selectedEventId, selectedEvent, availableSessions]);

  const stopCamera = async () => {
      if (scannerRef.current) { 
          try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); } catch (err) {} 
          finally { scannerRef.current = null; } 
      }
      if (isMounted.current) {
        setIsCameraActive(false); 
        setIsInitializing(false);
      }
  };

  const handleRestart = async () => {
      setLastResult(null);
      setPendingMember(null);
      setIsLate(false);
      setManualSearch('');
      await stopCamera();
      if (selectedEventId) {
          await startCamera();
      }
  };

  const handleScanNext = async () => { 
      setLastResult(null); 
      setPendingMember(null);
      setIsLate(false);
      setManualSearch('');
      if (activeTab === 'SCAN' && isCameraActive) { } 
      else if (activeTab === 'SCAN') { await startCamera(); }
  };

  const processAttendance = async (memberId: string) => {
      if (!selectedEventId || isProcessing) return;
      setIsProcessing(true); 
      await stopCamera();
      
      const member = members.find(m => m.id === memberId.trim());
      if (!member) { 
          setLastResult({ status: 'ERROR', title: 'Tidak Dikenal', message: `Data kartu tidak terdaftar.` }); 
          setIsProcessing(false); 
          return; 
      }

      const now = new Date();
      let targetStartTime: Date;
      if (activeSession?.startTime) { 
          const [h, m] = activeSession.startTime.split(':').map(Number); 
          targetStartTime = new Date(selectedEvent?.date || now); 
          targetStartTime.setHours(h, m, 0, 0); 
      } else { 
          targetStartTime = selectedEvent ? new Date(selectedEvent.date) : now; 
      }

      const tolerance = selectedEvent?.late_tolerance || 15;
      const limitTime = new Date(targetStartTime.getTime() + (tolerance * 60000));
      
      const diffMs = now.getTime() - targetStartTime.getTime();
      setLateMinutes(Math.floor(diffMs / 60000));
      setIsLate(now > limitTime);
      setPendingMember(member);
      setIsProcessing(false);
  };

  const executeSave = async (member: Member, status: 'Present' | 'Present Late' | 'Excused' | 'Excused Late', reason?: string) => {
      try {
          const now = new Date().toISOString(); 
          const targetSessionId = selectedSessionId || 'default';
          const existing = attendance.find(a => a.event_id === selectedEventId && a.member_id === member.id);
          
          const { error } = await supabase.from('event_attendance').upsert({ 
              event_id: selectedEventId, 
              member_id: member.id, 
              status, 
              check_in_time: now, 
              leave_reason: reason || null,
              logs: { ...(existing?.logs || {}), [targetSessionId]: now } 
          }, { onConflict: 'event_id, member_id' });
          
          if (error) throw error;
          
          let resultStatus: 'SUCCESS' | 'WARNING' | 'INFO' = 'SUCCESS';
          if (status.includes('Late')) resultStatus = 'WARNING';
          if (status === 'Excused') resultStatus = 'INFO';

          setLastResult({ 
              status: resultStatus, 
              title: status === 'Present' ? 'Hadir Tepat' : 
                     status === 'Present Late' ? 'Hadir Telat' : 
                     status === 'Excused' ? 'Izin Absen' : 'Izin Telat', 
              message: member.full_name 
          });
          
          onRefresh();
          setIsLate(false);
          setPendingMember(null);
          setManualSearch('');
      } catch (err: any) { setLastResult({ status: 'ERROR', title: 'Gagal', message: err.message }); }
  };

  const startCamera = async () => {
      if (!selectedEventId || isInitializing) return; 
      setIsInitializing(true); 
      setIsCameraActive(true);
      setLastResult(null);
      setPendingMember(null);
      
      setTimeout(async () => {
          try { 
              const html5QrCode = new Html5Qrcode(scanDivId); 
              scannerRef.current = html5QrCode; 
              await html5QrCode.start(
                  { facingMode: "environment" }, 
                  { fps: 15, qrbox: { width: 250, height: 250 } }, 
                  (text) => processAttendance(text), 
                  () => {}
              ); 
              setIsInitializing(false); 
          } catch (err: any) { 
              setIsCameraActive(false); 
              setIsInitializing(false); 
          }
      }, 300);
  };

  const renderMobileUI = () => (
    <div className="fixed inset-0 z-50 bg-black flex flex-col no-print overflow-hidden">
        {/* Header Fixed */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 via-black/40 to-transparent p-4 flex justify-between items-center">
            <div className="flex-1">
                <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); stopCamera(); setLastResult(null); }} className="w-full bg-white/10 backdrop-blur-xl text-white border-none rounded-xl px-3 py-2.5 text-sm font-black outline-none ring-1 ring-white/20 shadow-2xl">
                    <option value="" className="text-black">-- PILIH ACARA --</option>
                    {activeEvents.map(e => (<option key={e.id} value={e.id} className="text-black">{e.name}</option>))}
                </select>
                {selectedEvent && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                        {availableSessions.map(s => (
                            <button key={s.id} onClick={() => { setSelectedSessionId(s.id); stopCamera(); setLastResult(null); }} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all shadow-lg ${selectedSessionId === s.id ? 'bg-primary-600 text-white ring-2 ring-primary-400' : 'bg-white/10 text-white ring-1 ring-white/20'}`}> {s.name} </button>
                        ))}
                    </div>
                )}
            </div>
            {isCameraActive && (
                 <button onClick={stopCamera} className="ml-4 p-3 bg-red-600/80 backdrop-blur-md text-white rounded-full shadow-2xl active:scale-90 transition-transform">
                    <StopCircle size={24}/>
                </button>
            )}
        </div>

        {/* Scanner Area */}
        <div className="flex-1 relative flex flex-col z-10">
            {activeTab === 'SCAN' ? (
                <div className="flex-1 flex flex-col bg-slate-950">
                    {isCameraActive ? (
                        <div id={scanDivId} className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950 text-white pb-32">
                            <div className="w-24 h-24 bg-primary-500/10 rounded-full flex items-center justify-center text-primary-500 mb-8 animate-pulse border border-primary-500/20 shadow-[0_0_50px_rgba(59,130,246,0.2)]">
                                <QrCode size={48} />
                            </div>
                            <h3 className="font-black text-xl mb-3 tracking-tight">Scanner Siap</h3>
                            <p className="text-sm text-white/40 mb-12 max-w-[260px]">Silakan pilih acara aktif dan tekan tombol di bawah untuk mengaktifkan kamera.</p>
                            <button onClick={startCamera} className="w-full max-w-[280px] bg-primary-600 text-white py-5 rounded-2xl font-black shadow-2xl shadow-primary-600/30 active:scale-95 transition-all uppercase tracking-widest">AKTIFKAN KAMERA</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex flex-col bg-white dark:bg-dark-bg overflow-hidden animate-in slide-in-from-right-full duration-300 pb-24">
                    <div className="p-5 border-b dark:border-dark-border bg-gray-50 dark:bg-dark-card flex items-center gap-3">
                        <Search size={20} className="text-gray-400"/>
                        <input type="text" placeholder="Cari dalam daftar..." value={listSearch} onChange={e => setListSearch(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-sm font-black dark:text-white" />
                        <button onClick={() => setActiveTab('SCAN')} className="p-2 text-gray-400"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y dark:divide-dark-border">
                        {scannedMembers.length > 0 ? scannedMembers.map((m, idx) => (
                            <div key={idx} className="p-5 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-dark-card/50 transition">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${m.status.includes('Late') ? 'bg-amber-100 text-amber-600' : m.status === 'Excused' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>{m.full_name.charAt(0)}</div>
                                    <div>
                                        <p className="text-sm font-black dark:text-white">{m.full_name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{m.group_name} • {m.scan_time_display}</p>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${m.status.includes('Late') ? 'text-amber-600 bg-amber-50' : m.status === 'Excused' ? 'text-blue-600 bg-blue-50' : 'text-green-600 bg-green-50'}`}>{m.status}</span>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-30">
                                <History size={64} className="mb-4" />
                                <p className="font-black text-sm uppercase">Belum ada data</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Manual Search Overlay (Floating on Mobile) */}
        {activeTab === 'SCAN' && !pendingMember && !lastResult && (
            <div className="absolute bottom-28 left-4 right-4 z-[60]">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20} />
                    <input 
                        type="text" 
                        placeholder="Manual: Ketik Nama Anggota..." 
                        value={manualSearch}
                        onChange={(e) => setManualSearch(e.target.value)}
                        onFocus={() => stopCamera()}
                        className="w-full pl-12 pr-4 py-4 bg-black/60 backdrop-blur-2xl border border-white/20 rounded-2xl text-white text-sm font-black outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                    />
                    {manualCandidates.length > 0 && (
                        <div className="absolute bottom-full left-0 right-0 mb-4 bg-white dark:bg-dark-card rounded-2xl shadow-2xl overflow-hidden divide-y dark:divide-dark-border animate-in slide-in-from-bottom-4">
                            {manualCandidates.map(m => (
                                <button key={m.id} onClick={() => processAttendance(m.id)} className="w-full px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-dark-border transition flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-9 h-9 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center font-black text-xs">{m.full_name.charAt(0)}</div>
                                        <div className="flex flex-col"><span className="text-sm font-black text-gray-900 dark:text-white">{m.full_name}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{(m as any).groups?.name || '-'}</span></div>
                                    </div>
                                    <ChevronRight size={18} className="text-gray-300"/>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Mobile Bottom Dock (Z-Index High) */}
        <div className="h-24 bg-white dark:bg-dark-card border-t dark:border-dark-border flex items-center px-8 gap-10 fixed bottom-0 left-0 right-0 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
            <button onClick={() => setActiveTab('SCAN')} className={`flex-1 flex flex-col items-center gap-1.5 transition-all ${activeTab === 'SCAN' ? 'text-primary-600' : 'text-gray-400'}`}>
                <div className={`p-2 rounded-xl transition-colors ${activeTab === 'SCAN' ? 'bg-primary-50' : ''}`}><Camera size={26}/></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Ambil Scan</span>
            </button>
            <button onClick={() => { setActiveTab('LIST'); stopCamera(); }} className={`flex-1 flex flex-col items-center gap-1.5 transition-all ${activeTab === 'LIST' ? 'text-primary-600' : 'text-gray-400'}`}>
                <div className={`p-2 rounded-xl transition-colors ${activeTab === 'LIST' ? 'bg-primary-50' : ''}`}>
                    <div className="relative">
                        <List size={26}/>
                        {scannedMembers.length > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white">{scannedMembers.length}</span>}
                    </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Daftar Scan</span>
            </button>
        </div>

        {/* Overlays for Scan Results */}
        {pendingMember && !lastResult && (
            <div className="absolute inset-0 z-[110] flex flex-col justify-end bg-black/80 backdrop-blur-md animate-in fade-in">
                <div className="bg-white dark:bg-dark-card rounded-t-[40px] p-8 pb-12 space-y-8 animate-in slide-in-from-bottom-full duration-500 shadow-2xl">
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
                    <div className="text-center space-y-2">
                        <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-white mb-4 shadow-xl rotate-3 ${isLate ? 'bg-amber-500 shadow-amber-500/20' : 'bg-primary-600 shadow-primary-600/20'}`}>
                            {isLate ? <Timer size={40}/> : <UserPlus size={40}/>}
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">{pendingMember.full_name}</h3>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">{(pendingMember as any).groups?.name || 'UMUM'}</p>
                        {isLate && <div className="inline-block mt-4 px-5 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl text-xs font-black ring-1 ring-amber-200 dark:ring-amber-800">TERLAMBAT {lateMinutes} MENIT</div>}
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <button onClick={() => executeSave(pendingMember, isLate ? 'Present Late' : 'Present')} className="w-full bg-primary-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 uppercase shadow-xl shadow-primary-600/20 active:scale-95 transition-all text-sm tracking-widest"><CheckCircle2 size={24}/> KONFIRMASI HADIR</button>
                        <button onClick={() => setIsReasonModalOpen(true)} className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-4 rounded-2xl font-black flex items-center justify-center gap-3 uppercase active:scale-95 transition-all text-xs tracking-widest"><HelpCircle size={20}/> IZIN / TELAT BERIZIN</button>
                        <button onClick={() => { setPendingMember(null); startCamera(); }} className="w-full text-gray-400 dark:text-gray-500 py-2 text-[10px] font-black uppercase tracking-[0.3em]">BATALKAN</button>
                    </div>
                </div>
            </div>
        )}

        {/* Success/Error Screens */}
        {lastResult && (
            <div className={`absolute inset-0 z-[120] flex flex-col items-center justify-center p-10 text-center animate-in zoom-in duration-300 ${
                lastResult.status === 'SUCCESS' ? 'bg-green-600' : 
                lastResult.status === 'WARNING' ? 'bg-amber-500' : 
                lastResult.status === 'INFO' ? 'bg-blue-600' : 'bg-red-600'
            }`}>
                <div className="p-8 bg-white/10 rounded-[40px] mb-8 text-white backdrop-blur-2xl border border-white/20 shadow-2xl">
                    {lastResult.status === 'SUCCESS' ? <CheckCircle2 size={96}/> : 
                     lastResult.status === 'WARNING' ? <Timer size={96}/> : 
                     lastResult.status === 'INFO' ? <HelpCircle size={96}/> : <XCircle size={96}/>}
                </div>
                <h2 className="text-4xl font-black text-white mb-3 uppercase tracking-tighter drop-shadow-2xl">{lastResult.title}</h2>
                <p className="text-white text-2xl font-bold mb-20 uppercase opacity-90 tracking-tight">{lastResult.message}</p>
                <div className="w-full max-w-[320px] space-y-4">
                    <button onClick={handleScanNext} className="w-full bg-white text-gray-900 py-6 rounded-2xl font-black shadow-[0_20px_50px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95 text-sm">LANJUT SCAN</button>
                    <button onClick={handleRestart} className="w-full bg-black/10 text-white/60 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/10">Ulangi Kamera</button>
                </div>
            </div>
        )}
    </div>
  );

  const renderDesktopUI = () => (
    <div className="max-w-2xl mx-auto min-h-[calc(100vh-80px)] bg-gray-50 dark:bg-black flex flex-col pb-10">
        <div className="bg-white dark:bg-dark-card border-b p-6 sticky top-0 z-20 shadow-sm rounded-b-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black flex items-center gap-3 text-gray-900 dark:text-white uppercase tracking-tighter"><ScanBarcode className="text-primary-600" size={32}/> Scanner Presensi</h2>
                {selectedEventId && (<button onClick={onRefresh} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-400 hover:text-primary-600 transition"><RefreshCw size={24} /></button>)}
            </div>
            <div className="space-y-4">
                <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); stopCamera(); setLastResult(null); }} className="w-full px-5 py-4 bg-gray-100 dark:bg-gray-800 border-none rounded-2xl text-base font-black dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-inner">
                    <option value="">-- PILIH ACARA AKTIF --</option>
                    {activeEvents.map(e => (<option key={e.id} value={e.id}>{e.name.toUpperCase()} ({new Date(e.date).toLocaleDateString()})</option>))}
                </select>
                {selectedEvent && (
                    <div className="flex flex-wrap gap-2 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        {availableSessions.map(s => (<button key={s.id} onClick={() => { setSelectedSessionId(s.id); stopCamera(); setLastResult(null); }} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${selectedSessionId === s.id ? 'bg-primary-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-primary-600'}`}> {s.name} </button>))}
                    </div>
                )}
            </div>
        </div>
        <div className="flex-1 p-6 space-y-6">
            {selectedEventId ? (
                <>
                    <div className="flex bg-gray-200 dark:bg-gray-800 p-1.5 rounded-2xl shadow-inner">
                        <button onClick={() => setActiveTab('SCAN')} className={`flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'SCAN' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500'}`}><Camera size={18}/> Layar Scanner</button>
                        <button onClick={() => { setActiveTab('LIST'); stopCamera(); }} className={`flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'LIST' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500'}`}><List size={18}/> Daftar Masuk ({scannedMembers.length})</button>
                    </div>
                    {activeTab === 'SCAN' && (
                        <div className="relative group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input type="text" placeholder="Cari Nama Anggota (Input Manual)..." value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} onFocus={() => stopCamera()} className="w-full pl-14 pr-6 py-4 bg-white dark:bg-gray-800 border-none rounded-2xl text-base font-bold dark:text-white outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-all" />
                            {manualCandidates.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y dark:divide-gray-700 animate-in fade-in slide-in-from-top-2">
                                    {manualCandidates.map(m => (
                                        <button key={m.id} onClick={() => processAttendance(m.id)} className="w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-between">
                                            <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900 text-primary-600 flex items-center justify-center font-black text-sm">{m.full_name.charAt(0)}</div><div className="flex flex-col"><span className="text-base font-black text-gray-900 dark:text-white">{m.full_name}</span><span className="text-[10px] text-gray-400 font-black uppercase">{(m as any).groups?.name || 'UMUM'}</span></div></div><ChevronRight size={20} className="text-gray-300"/>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden relative min-h-[500px] flex flex-col transition-all">
                        {activeTab === 'SCAN' ? (
                            <div className="flex-1 flex flex-col">
                                {isCameraActive ? (
                                    <div className="flex flex-col flex-1 relative">
                                        <div id={scanDivId} className="w-full aspect-square bg-black overflow-hidden relative rounded-b-3xl" />
                                        <div className="p-6 bg-white dark:bg-dark-card border-t dark:border-gray-800 grid grid-cols-2 gap-4">
                                            <button onClick={stopCamera} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-100 transition"><StopCircle size={20}/> Matikan Kamera</button>
                                            <button onClick={handleRestart} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition"><RefreshCw size={20}/> Mulai Ulang</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in">
                                        <div className="w-32 h-32 bg-primary-50 dark:bg-primary-950 rounded-[40px] flex items-center justify-center text-primary-600 dark:text-primary-400 mb-8 shadow-inner animate-pulse"><QrCode size={64} /></div>
                                        <h3 className="font-black text-2xl text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">Scanner Siap</h3>
                                        <p className="text-sm text-gray-500 mb-10 max-w-[300px]">Arahkan kamera ke QR Code anggota atau gunakan pencarian manual untuk memproses absensi.</p>
                                        <button onClick={startCamera} className="w-full max-w-[320px] bg-primary-600 hover:bg-primary-700 text-white py-5 rounded-2xl font-black shadow-2xl shadow-primary-600/30 flex items-center justify-center gap-3 uppercase tracking-widest transition-all active:scale-95"><PlayCircle size={24}/> AKTIFKAN KAMERA</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col animate-in fade-in">
                                <div className="p-5 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-dark-card z-10">
                                    <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/><input type="text" placeholder="Filter daftar masuk..." value={listSearch} onChange={e => setListSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500" /></div>
                                </div>
                                <div className="flex-1 overflow-y-auto divide-y dark:divide-gray-800 max-h-[600px]">
                                    {scannedMembers.length > 0 ? scannedMembers.map((m, idx) => (
                                        <div key={idx} className="p-5 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${m.status === 'Present' ? 'bg-green-100 text-green-600' : m.status === 'Excused' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>{m.full_name.charAt(0)}</div><div><p className="text-base font-black text-gray-900 dark:text-white line-clamp-1">{m.full_name}</p><p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{m.group_name} • {m.scan_time_display}</p></div></div><div className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${m.status === 'Present' ? 'bg-green-50 text-green-500' : m.status === 'Excused' ? 'bg-blue-50 text-blue-500' : 'bg-amber-50 text-amber-500'}`}>{m.status}</div></div>
                                    )) : (
                                        <div className="py-32 text-center flex flex-col items-center gap-4 text-gray-300"><History size={64} className="opacity-20"/><p className="text-base font-black uppercase tracking-widest">Daftar Kosong</p></div>
                                    )}
                                </div>
                            </div>
                        )}
                        {/* Desktop Logic Overlays (Similar to Mobile but fixed inside container) */}
                        {pendingMember && !lastResult && (
                            <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center p-8 text-center animate-in fade-in transition-colors ${isLate ? 'bg-amber-600' : 'bg-primary-600'}`}>
                                <div className="p-6 bg-white/20 rounded-[40px] mb-6 text-white shadow-inner">{isLate ? <Timer size={80}/> : <UserPlus size={80}/>}</div>
                                <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">{isLate ? 'TERLAMBAT' : 'HADIR'}</h3>
                                <div className="text-white font-black mb-10"><p className="text-2xl uppercase">{pendingMember.full_name}</p><span className="text-sm px-4 py-1.5 rounded-full bg-black/20 mt-3 inline-block font-bold">{isLate ? `Terlambat ${lateMinutes} Menit` : 'Tepat Waktu'}</span></div>
                                <div className="grid grid-cols-1 gap-4 w-full max-w-[340px]">
                                    <button onClick={() => executeSave(pendingMember, isLate ? 'Present Late' : 'Present')} className="bg-white text-gray-900 py-5 rounded-3xl font-black shadow-2xl flex items-center justify-center gap-3 uppercase active:scale-95 transition-all text-sm tracking-widest"><CheckCircle2 size={24}/> KONFIRMASI HADIR</button>
                                    <button onClick={() => setIsReasonModalOpen(true)} className="bg-black/20 border border-white/30 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 uppercase active:scale-95 transition-all text-xs tracking-widest"><HelpCircle size={24}/> {isLate ? 'IZIN TELAT' : 'IZIN ABSEN'}</button>
                                    <button onClick={() => { setPendingMember(null); startCamera(); }} className="text-white/60 text-xs font-black uppercase tracking-[0.4em] mt-4 hover:text-white transition-colors">BATALKAN</button>
                                </div>
                            </div>
                        )}
                        {lastResult && (
                            <div className={`absolute inset-0 z-[110] flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-300 ${lastResult.status === 'SUCCESS' ? 'bg-green-600' : lastResult.status === 'WARNING' ? 'bg-amber-500' : lastResult.status === 'INFO' ? 'bg-blue-600' : 'bg-red-600'}`}>
                                <div className="p-6 bg-white/20 rounded-[40px] mb-8 text-white backdrop-blur-md shadow-lg">{lastResult.status === 'SUCCESS' ? <CheckCircle2 size={80}/> : lastResult.status === 'WARNING' ? <Timer size={80}/> : lastResult.status === 'INFO' ? <HelpCircle size={80}/> : <XCircle size={80}/>}</div>
                                <h3 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter drop-shadow-2xl">{lastResult.title}</h3>
                                <p className="text-white font-black text-2xl mb-16 uppercase opacity-90 tracking-tight">{lastResult.message}</p>
                                <div className="flex flex-col gap-4 w-full max-w-[320px]">
                                    <button onClick={handleScanNext} className="w-full bg-white text-gray-900 py-5 rounded-3xl font-black shadow-2xl flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95 transition-transform text-sm"><ScanBarcode size={24}/> LANJUT SCAN</button>
                                    <button onClick={handleRestart} className="w-full bg-black/10 text-white/60 py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-black/30 transition text-xs tracking-widest uppercase">Mulai Ulang</button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed border-gray-200 dark:border-gray-800 rounded-[40px] opacity-60 bg-white dark:bg-dark-card animate-in zoom-in"><QrCode size={80} className="mb-6 text-gray-300" /><p className="text-lg font-black text-gray-400 uppercase tracking-widest">Silakan pilih acara di atas</p></div>
            )}
        </div>
    </div>
  );

  return (
    <>
        {isMobileView ? renderMobileUI() : renderDesktopUI()}
        <Modal isOpen={isReasonModalOpen} onClose={() => setIsReasonModalOpen(false)} title="Alasan Izin">
            <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 flex items-start gap-3"><HelpCircle className="text-blue-600 mt-1" size={20}/><div className="text-xs text-blue-800 dark:text-blue-200 font-bold uppercase tracking-tight">Keterangan Izin: <br/><span className="font-normal opacity-80">Masukkan alasan mengapa anggota ini izin atau telat.</span></div></div>
                <textarea autoFocus value={tempReason} onChange={e => setTempReason(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500 transition-all" placeholder="Contoh: Sakit, Ada keperluan mendadak, dll..." rows={4} />
                <div className="flex justify-end gap-3 pt-2"><button onClick={() => setIsReasonModalOpen(false)} className="px-6 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest">Batal</button><button onClick={() => { if (pendingMember) { executeSave(pendingMember, isLate ? 'Excused Late' : 'Excused', tempReason); setIsReasonModalOpen(false); setTempReason(''); } }} className="bg-primary-600 text-white px-8 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-primary-600/20 active:scale-95 transition-all flex items-center gap-2 uppercase tracking-widest"><Save size={16}/> Simpan Izin</button></div>
            </div>
        </Modal>
    </>
  );
};