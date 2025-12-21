import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Event, Member, EventSession, EventAttendance } from '../types';
import { supabase } from '../supabaseClient';
import { 
    ScanBarcode, Keyboard, PlayCircle, CheckCircle2, XCircle, 
    AlertTriangle, Camera, StopCircle, History, ChevronRight, 
    QrCode, RefreshCw, X, List, Users, Clock, Check, UserPlus, Timer, MessageCircle, Search, Save,
    HelpCircle // Added missing icon import
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
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(''); 
  const [activeTab, setActiveTab] = useState<'SCAN' | 'LIST'>('SCAN');
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [lastResult, setLastResult] = useState<{status: 'SUCCESS'|'ERROR'|'WARNING'|'INFO', title: string, message: string} | null>(null);
  
  // State for Selection Interaction
  const [pendingMember, setPendingMember] = useState<Member | null>(null);
  const [isLate, setIsLate] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);
  const [manualSearch, setManualSearch] = useState('');
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [tempReason, setTempReason] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [listSearch, setListSearch] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMounted = useRef(true);
  const scanDivId = "reader-viewport-main";

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
      if (activeTab === 'SCAN' && isCameraActive) { 
          // Camera already active, just clearing result overlay
      } else if (activeTab === 'SCAN') {
          await startCamera();
      }
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
          
          setLogs(prev => [{ 
              id: Math.random().toString(36).substr(2, 9), 
              time: new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit', hour12: false}), 
              memberName: member.full_name, 
              status: resultStatus, 
              message: status === 'Present' ? 'Hadir Tepat' : 
                       status === 'Present Late' ? 'Telat' : 
                       status === 'Excused' ? 'Izin' : 'Izin Telat'
          }, ...prev].slice(0, 10) as ScanLog[]);
          
          onRefresh();
          setIsLate(false);
          setPendingMember(null);
          setManualSearch('');
      } catch (err: any) { setLastResult({ status: 'ERROR', title: 'Gagal', message: err.message }); }
  };

  const startCamera = async () => {
      if (!selectedEventId || isInitializing) return; 
      setIsInitializing(true); 
      setCameraError(null); 
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
              setCameraError(err.message); 
              setIsCameraActive(false); 
              setIsInitializing(false); 
          }
      }, 300);
  };

  return (
    <div className="max-w-lg mx-auto min-h-[calc(100vh-80px)] bg-gray-50 dark:bg-black flex flex-col pb-10">
        <div className="bg-white dark:bg-dark-card border-b p-4 sticky top-0 z-20 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white"><ScanBarcode className="text-primary-600" /> Scanner</h2>
                {selectedEventId && (
                    <div className="flex gap-2">
                        <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-primary-600"><RefreshCw size={20} /></button>
                    </div>
                )}
            </div>
            
            <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); stopCamera(); setLastResult(null); }} className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-transparent dark:border-gray-700 rounded-xl text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all">
                <option value="">-- Pilih Acara Aktif --</option>
                {activeEvents.map(e => (<option key={e.id} value={e.id}>{e.name} ({new Date(e.date).toLocaleDateString()})</option>))}
            </select>
            {selectedEvent && (
                <div className="flex flex-wrap gap-2 mt-3 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    {availableSessions.map(s => (<button key={s.id} onClick={() => { setSelectedSessionId(s.id); stopCamera(); setLastResult(null); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${selectedSessionId === s.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-blue-600 border border-blue-200'}`}> {s.name} </button>))}
                </div>
            )}
        </div>
        
        <div className="flex-1 p-4 space-y-4">
            {selectedEventId ? (
                <>
                    <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl shadow-inner">
                        <button 
                            onClick={() => setActiveTab('SCAN')}
                            className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'SCAN' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            <Camera size={16}/> Ambil Absen
                        </button>
                        <button 
                            onClick={() => { setActiveTab('LIST'); stopCamera(); }}
                            className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'LIST' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            <List size={16}/> Terabsen ({scannedMembers.length})
                        </button>
                    </div>

                    {activeTab === 'SCAN' && (
                        <div className="relative">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Input Manual: Cari nama anggota..." 
                                    value={manualSearch}
                                    onChange={(e) => setManualSearch(e.target.value)}
                                    onFocus={() => stopCamera()}
                                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-all"
                                />
                            </div>
                            
                            {manualCandidates.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-30 overflow-hidden divide-y dark:divide-gray-700 animate-in fade-in slide-in-from-top-2">
                                    {manualCandidates.map(m => (
                                        <button 
                                            key={m.id} 
                                            onClick={() => processAttendance(m.id)}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900 text-primary-600 flex items-center justify-center font-bold text-xs">{m.full_name.charAt(0)}</div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{m.full_name}</span>
                                                    <span className="text-[10px] text-gray-500 uppercase">{(m as any).groups?.name || '-'}</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-300"/>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden relative min-h-[400px] flex flex-col transition-all">
                        {activeTab === 'SCAN' ? (
                            <div className="flex-1 flex flex-col">
                                {isCameraActive ? (
                                    <div className="flex flex-col flex-1 relative">
                                        {isInitializing && (
                                            <div className="absolute inset-0 z-20 bg-black/50 flex flex-col items-center justify-center text-white gap-3 backdrop-blur-sm">
                                                <RefreshCw size={32} className="animate-spin text-primary-400"/>
                                                <span className="text-xs font-bold uppercase tracking-widest">Inisialisasi Kamera...</span>
                                            </div>
                                        )}
                                        <div id={scanDivId} className="w-full aspect-square bg-black overflow-hidden relative" />
                                        <div className="p-4 bg-white dark:bg-dark-card border-t dark:border-gray-800 grid grid-cols-2 gap-3">
                                            <button onClick={stopCamera} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition hover:bg-red-100"><StopCircle size={18}/> Matikan</button>
                                            <button onClick={handleRestart} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200"><RefreshCw size={18}/> Restart</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                                        <div className="w-24 h-24 bg-primary-50 dark:bg-primary-950 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 mb-6 shadow-inner animate-pulse"><QrCode size={48} /></div>
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-2">Siap Melakukan Scan</h3>
                                        <p className="text-xs text-gray-500 mb-8 max-w-[240px]">Pilih sesi aktif lalu arahkan kamera ke QR Code peserta atau gunakan input pencarian manual.</p>
                                        <button onClick={startCamera} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-primary-600/20 flex items-center justify-center gap-3 uppercase tracking-widest transition-all active:scale-95"><PlayCircle size={24}/> Mulai Kamera</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* TAB: LIST SCANNED */
                            <div className="flex-1 flex flex-col animate-in fade-in">
                                <div className="p-4 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-dark-card z-10">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                                        <input 
                                            type="text" 
                                            placeholder="Cari dalam daftar..." 
                                            value={listSearch}
                                            onChange={e => setListSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto divide-y dark:divide-gray-800">
                                    {scannedMembers.length > 0 ? scannedMembers.map((m, idx) => (
                                        <div key={idx} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                                    m.status === 'Present' ? 'bg-green-100 text-green-600' : 
                                                    m.status === 'Excused' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                                                }`}>
                                                    {m.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{m.full_name}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{m.group_name}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-black text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-lg mb-1">{m.scan_time_display}</div>
                                                <div className={`text-[9px] font-bold uppercase ${
                                                    m.status === 'Present' ? 'text-green-500' : 
                                                    m.status === 'Excused' ? 'text-blue-500' : 'text-amber-500'
                                                }`}>
                                                    {m.status === 'Present' ? 'Hadir' : 
                                                     m.status === 'Present Late' ? 'Telat' : 
                                                     m.status === 'Excused' ? 'Izin' : 'Izin Telat'}
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="py-20 text-center flex flex-col items-center gap-2 text-gray-400">
                                            <History size={48} className="opacity-20"/>
                                            <p className="text-sm font-bold">Belum ada yang discan</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* OVERLAY: CHOICE INTERACTION (Triggered by Scan or Manual Select) */}
                        {pendingMember && !lastResult && (
                            <div className={`absolute inset-0 z-40 flex flex-col items-center justify-center p-6 text-center animate-in fade-in transition-colors ${isLate ? 'bg-amber-600' : 'bg-primary-600'}`}>
                                <div className="p-5 bg-white/20 rounded-full mb-4 text-white shadow-inner">
                                    {isLate ? <Timer size={64}/> : <UserPlus size={64}/>}
                                </div>
                                <h3 className="text-2xl font-black text-white mb-1 uppercase tracking-tight">
                                    {isLate ? 'TERDETEKSI TELAT' : 'PILIH STATUS'}
                                </h3>
                                <div className="text-white font-bold mb-8">
                                    <p className="text-xl">{pendingMember.full_name}</p>
                                    <span className={`text-xs px-3 py-1 rounded-full bg-black/20 mt-2 inline-block ${isLate ? 'text-amber-100' : 'text-primary-100'}`}>
                                        {isLate ? `Terlambat ${lateMinutes} Menit` : 'Hadir Tepat Waktu'}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4 w-full max-w-[300px]">
                                    <button 
                                        onClick={() => executeSave(pendingMember, isLate ? 'Present Late' : 'Present')}
                                        className="bg-white text-gray-900 py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 uppercase active:scale-95 transition-all"
                                    >
                                        <CheckCircle2 size={24}/> Hadir {isLate ? 'Telat' : ''}
                                    </button>
                                    
                                    <button 
                                        onClick={() => setIsReasonModalOpen(true)}
                                        className="bg-black/20 border border-white/30 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 uppercase active:scale-95 transition-all"
                                    >
                                        <HelpCircle size={24}/> {isLate ? 'Izin Telat' : 'Izin Absen'}
                                    </button>

                                    <button 
                                        onClick={() => { setPendingMember(null); startCamera(); }}
                                        className="text-white/60 text-xs font-bold uppercase tracking-widest mt-4 hover:text-white transition-colors"
                                    >
                                        Batal / Kembali
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* RESULT SCREEN */}
                        {lastResult && (
                            <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 ${
                                lastResult.status === 'SUCCESS' ? 'bg-green-500' : 
                                lastResult.status === 'WARNING' ? 'bg-amber-500' : 
                                lastResult.status === 'INFO' ? 'bg-blue-500' : 'bg-red-600'
                            }`}>
                                <div className="p-5 bg-white/20 rounded-full mb-6 text-white backdrop-blur-md shadow-lg">
                                    {lastResult.status === 'SUCCESS' ? <CheckCircle2 size={72}/> : 
                                     lastResult.status === 'WARNING' ? <Timer size={72}/> : 
                                     lastResult.status === 'INFO' ? <HelpCircle size={72}/> : <XCircle size={72}/>}
                                </div>
                                <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">{lastResult.title}</h3>
                                <p className="text-white font-bold text-xl mb-12 drop-shadow-sm uppercase">{lastResult.message}</p>
                                <div className="flex flex-col gap-3 w-full max-w-[280px]">
                                    <button onClick={handleScanNext} className="w-full bg-white text-gray-900 py-4 rounded-2xl font-black shadow-2xl flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95 transition-transform"><ScanBarcode size={24}/> Lanjut Scan</button>
                                    <button onClick={handleRestart} className="w-full bg-black/20 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black/30 transition text-sm">Mulai Ulang</button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl opacity-60 bg-white dark:bg-dark-card animate-in zoom-in"><QrCode size={48} className="mb-4 text-gray-300" /><p className="text-sm font-bold text-gray-400">Silakan pilih acara di atas</p></div>
            )}
        </div>

        {/* MODAL INPUT ALASAN IZIN */}
        <Modal isOpen={isReasonModalOpen} onClose={() => setIsReasonModalOpen(false)} title="Alasan Izin">
            <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 flex items-start gap-3">
                    <HelpCircle className="text-blue-600 mt-1" size={20}/>
                    <div className="text-xs text-blue-800 dark:text-blue-200 font-bold uppercase tracking-tight">Keterangan Izin: <br/><span className="font-normal opacity-80">Masukkan alasan mengapa anggota ini izin atau telat.</span></div>
                </div>
                <textarea 
                    autoFocus
                    value={tempReason} 
                    onChange={e => setTempReason(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    placeholder="Contoh: Sakit, Ada keperluan mendadak, dll..."
                    rows={4}
                />
                <div className="flex justify-end gap-3 pt-2">
                    <button 
                        onClick={() => setIsReasonModalOpen(false)} 
                        className="px-6 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={() => {
                            if (pendingMember) {
                                executeSave(pendingMember, isLate ? 'Excused Late' : 'Excused', tempReason);
                                setIsReasonModalOpen(false);
                                setTempReason('');
                            }
                        }}
                        className="bg-primary-600 text-white px-8 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-primary-600/20 active:scale-95 transition-all flex items-center gap-2 uppercase tracking-widest"
                    >
                        <Save size={16}/> Simpan Izin
                    </button>
                </div>
            </div>
        </Modal>
    </div>
  );
};