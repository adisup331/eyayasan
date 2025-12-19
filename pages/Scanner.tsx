import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Event, Member, EventSession } from '../types';
import { supabase } from '../supabaseClient';
// Added X to imports
import { ScanBarcode, Keyboard, PlayCircle, CheckCircle2, XCircle, AlertTriangle, CalendarDays, Clock, Camera, StopCircle, History, ChevronRight, QrCode, RefreshCw, X } from '../components/ui/Icons';

interface ScannerProps {
  events: Event[];
  members: Member[];
  onRefresh: () => void;
}

interface ScanLog {
    id: string;
    time: string;
    memberName: string;
    status: 'SUCCESS' | 'ERROR' | 'WARNING';
    message: string;
}

export const Scanner: React.FC<ScannerProps> = ({ events, members, onRefresh }) => {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(''); 
  
  const [scanMode, setScanMode] = useState<'CAMERA' | 'MANUAL'>('CAMERA');
  const [manualInput, setManualInput] = useState('');
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [lastResult, setLastResult] = useState<{status: 'SUCCESS'|'ERROR'|'WARNING', title: string, message: string} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMounted = useRef(true);
  const scanDivId = "reader-viewport-main";

  const activeEvents = React.useMemo(() => {
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

  useEffect(() => {
      isMounted.current = true;
      if (selectedEvent && availableSessions.length > 0) {
          setSelectedSessionId(availableSessions[0].id);
      }
      return () => {
          isMounted.current = false;
          // Ensure total cleanup on unmount
          if (scannerRef.current?.isScanning) {
              scannerRef.current.stop().catch(() => {});
          }
      };
  }, [selectedEventId, selectedEvent]);

  const stopCamera = async () => {
      if (scannerRef.current) {
          try {
              if (scannerRef.current.isScanning) {
                  await scannerRef.current.stop();
              }
          } catch (err) {
              console.warn("Cleanup warning:", err);
          } finally {
              scannerRef.current = null;
          }
      }
      if (isMounted.current) {
          setIsCameraActive(false);
          setIsInitializing(false);
          setCameraError(null);
      }
  };

  const startCamera = async () => {
      if (!selectedEventId || isInitializing) return;

      setIsInitializing(true);
      setCameraError(null);
      
      // Stop any existing session first
      await stopCamera();

      // Set camera active state so the div is rendered
      setIsCameraActive(true);

      // Wait for React to paint the element and the browser to be ready
      // Increased delay to 600ms for mobile stability
      setTimeout(async () => {
          if (!isMounted.current) return;

          const element = document.getElementById(scanDivId);
          if (!element) {
              if (isMounted.current) {
                  setIsInitializing(false);
                  setCameraError("Container scanner tidak ditemukan.");
              }
              return;
          }

          try {
              const html5QrCode = new Html5Qrcode(scanDivId);
              scannerRef.current = html5QrCode;

              const config = { 
                  fps: 10, 
                  qrbox: { width: 250, height: 250 },
                  aspectRatio: 1.0,
                  disableFlip: false
              };

              await html5QrCode.start(
                  { facingMode: "environment" }, 
                  config, 
                  (text) => { if (isMounted.current) processAttendance(text); },
                  () => { /* frame ignored */ }
              );
              
              if (isMounted.current) setIsInitializing(false);
          } catch (err: any) {
              console.error("Scanner startup error:", err);
              if (isMounted.current) {
                  const message = err.toString();
                  if (message.includes("NotAllowedError") || message.includes("Permission denied")) {
                      setCameraError("Izin kamera ditolak. Berikan izin di browser.");
                  } else if (message.includes("interrupted by a new load")) {
                      // ignore this specific one as we handle load shifts
                  } else {
                      setCameraError(err.message || "Gagal menghubungkan kamera.");
                  }
                  setIsInitializing(false);
                  setIsCameraActive(false);
              }
          }
      }, 600);
  };

  const processAttendance = async (memberId: string) => {
      if (!selectedEventId || isProcessing) return;
      setIsProcessing(true);

      const cleanId = memberId.trim();
      const member = members.find(m => m.id === cleanId || m.full_name.toLowerCase() === cleanId.toLowerCase());
      
      if (!member) {
          if (isMounted.current) {
              setLastResult({ 
                  status: 'ERROR', 
                  title: 'Data Tidak Ditemukan', 
                  message: `ID: ${cleanId.substring(0, 15)}` 
              });
              addLog(cleanId, 'ERROR', 'Tidak terdaftar di database');
          }
          setIsProcessing(false);
          return;
      }

      try {
          const { data: existing, error: checkError } = await supabase
              .from('event_attendance')
              .select('*')
              .eq('event_id', selectedEventId)
              .eq('member_id', member.id)
              .maybeSingle(); // Better than .single() to avoid 406 error

          if (checkError) throw checkError;

          const currentLogs = (existing?.logs as Record<string, string>) || {};
          const targetSessionId = selectedSessionId || 'default';

          if (currentLogs[targetSessionId]) {
              if (isMounted.current) {
                  setLastResult({ status: 'WARNING', title: 'Sudah Tercatat', message: member.full_name });
                  addLog(member.full_name, 'WARNING', 'Ganda pada sesi ini');
              }
              setIsProcessing(false);
              return;
          }

          const now = new Date().toISOString();
          const newLogs = { ...currentLogs, [targetSessionId]: now };

          const { error: upsertError } = await supabase
              .from('event_attendance')
              .upsert({ 
                  event_id: selectedEventId, 
                  member_id: member.id, 
                  status: 'Present',
                  check_in_time: now, 
                  logs: newLogs 
              }, { onConflict: 'event_id, member_id' });

          if (upsertError) throw upsertError;

          if (isMounted.current) {
              setLastResult({ status: 'SUCCESS', title: 'Berhasil Absen', message: member.full_name });
              addLog(member.full_name, 'SUCCESS', `Tercatat pada sesi ${availableSessions.find(s=>s.id===targetSessionId)?.name || 'Hadir'}`);
              onRefresh();
              if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
          }
      } catch (err: any) {
          console.error("Attendance process error:", err);
          if (isMounted.current) {
              setLastResult({ status: 'ERROR', title: 'Kesalahan Sistem', message: "Gagal menyimpan data." });
              addLog(member.full_name, 'ERROR', err.message || 'Supabase Error');
          }
      } finally {
          if (isMounted.current) {
              setIsProcessing(false);
              setManualInput('');
              // Auto clear success message after 3 seconds
              setTimeout(() => { if (isMounted.current) setLastResult(null); }, 3000);
          }
      }
  };

  const addLog = (name: string, status: 'SUCCESS' | 'ERROR' | 'WARNING', message: string) => {
      const newLog: ScanLog = {
          id: Math.random().toString(36).substr(2, 9),
          time: new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}),
          memberName: name,
          status,
          message
      };
      setLogs(prev => [newLog, ...prev].slice(0, 15));
  };

  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(manualInput.trim()) {
          processAttendance(manualInput.trim());
      }
  };

  return (
    <div className="max-w-lg mx-auto min-h-[calc(100vh-80px)] bg-gray-50 dark:bg-black flex flex-col pb-10">
        <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border p-4 sticky top-0 z-20">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <ScanBarcode className="text-primary-600 dark:text-primary-400" /> Scanner Absensi
            </h2>
            
            <div className="space-y-3">
                <div className="relative">
                    <select 
                        value={selectedEventId} 
                        onChange={e => { 
                            setSelectedEventId(e.target.value); 
                            setLogs([]); 
                            setLastResult(null); 
                            stopCamera(); 
                        }}
                        className="w-full pl-3 pr-8 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-dark-border rounded-xl text-sm font-bold text-gray-800 dark:text-white appearance-none outline-none focus:ring-2 focus:ring-primary-500"
                    >
                        <option value="">-- Pilih Acara --</option>
                        {activeEvents.map(e => (
                            <option key={e.id} value={e.id}>
                                {e.name} ({new Date(e.date).toLocaleDateString('id-ID')})
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">
                        <ChevronRight size={18} className="rotate-90" />
                    </div>
                </div>

                {selectedEvent && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl animate-in fade-in zoom-in duration-300">
                        <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter mb-2 block">Pilih Sesi Absen:</label>
                        <div className="flex flex-wrap gap-2">
                            {availableSessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setSelectedSessionId(s.id); setLastResult(null); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        selectedSessionId === s.id 
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105' 
                                        : 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                    }`}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="flex-1 p-4 space-y-4">
            {!selectedEventId ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl opacity-60">
                    <QrCode size={48} className="text-gray-300 mb-4" />
                    <p className="text-sm font-medium text-gray-500">Pilih acara untuk memulai pemindaian</p>
                </div>
            ) : (
                <>
                    <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl">
                        <button 
                            onClick={() => { setScanMode('CAMERA'); stopCamera(); setLastResult(null); }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${scanMode === 'CAMERA' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <Camera size={16}/> Kamera
                        </button>
                        <button 
                            onClick={() => { setScanMode('MANUAL'); stopCamera(); setLastResult(null); }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${scanMode === 'MANUAL' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <Keyboard size={16}/> Input ID
                        </button>
                    </div>

                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden relative min-h-[340px] flex flex-col">
                        {scanMode === 'CAMERA' ? (
                            <div className="flex-1 flex flex-col">
                                {isCameraActive ? (
                                    <div className="flex flex-col flex-1">
                                        <div id={scanDivId} className="w-full aspect-square bg-black overflow-hidden relative min-h-[300px]">
                                            {isInitializing && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
                                                    <div className="text-center">
                                                        <RefreshCw size={40} className="text-primary-500 animate-spin mx-auto mb-3" />
                                                        <p className="text-xs text-white font-bold tracking-widest uppercase">Memuat Kamera...</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 bg-white dark:bg-dark-card border-t border-gray-100 dark:border-gray-800">
                                            <button 
                                                onClick={stopCamera}
                                                className="w-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                                            >
                                                <StopCircle size={18}/> Hentikan Kamera
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                                        <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center text-primary-600 mb-6">
                                            <QrCode size={40} />
                                        </div>
                                        <button 
                                            onClick={startCamera}
                                            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-primary-600/30 flex items-center justify-center gap-2 transition active:scale-95 uppercase tracking-wider"
                                        >
                                            <PlayCircle size={24}/> Aktifkan Kamera
                                        </button>
                                        {cameraError && (
                                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 text-xs font-bold animate-in shake duration-300">
                                                {cameraError}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col justify-center p-6 animate-in slide-in-from-bottom-4">
                                <form onSubmit={handleManualSubmit} className="space-y-4">
                                    <div className="text-center mb-4">
                                        <Keyboard size={32} className="mx-auto text-gray-300 mb-2"/>
                                        <h3 className="font-bold text-gray-800 dark:text-white">Cari Anggota / Scan ID</h3>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={manualInput}
                                        onChange={e => setManualInput(e.target.value)}
                                        className="w-full p-4 text-center text-xl font-bold border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 dark:text-white focus:border-primary-500 outline-none transition-all placeholder:text-gray-300"
                                        placeholder="Ketik ID atau Nama..."
                                        autoFocus
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!manualInput || isProcessing} 
                                        className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary-600/20 active:scale-95 transition uppercase"
                                    >
                                        {isProcessing ? 'Memproses...' : 'Proses Kehadiran'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {lastResult && (
                        <div className={`p-6 rounded-2xl border-2 shadow-2xl animate-in zoom-in duration-300 ${
                            lastResult.status === 'SUCCESS' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                            lastResult.status === 'WARNING' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' :
                            'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                        }`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full shrink-0 ${
                                    lastResult.status === 'SUCCESS' ? 'bg-green-500 text-white' :
                                    lastResult.status === 'WARNING' ? 'bg-yellow-500 text-white' :
                                    'bg-red-500 text-white'
                                }`}>
                                    {lastResult.status === 'SUCCESS' ? <CheckCircle2 size={32}/> : 
                                     lastResult.status === 'WARNING' ? <AlertTriangle size={32}/> : <XCircle size={32}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${
                                        lastResult.status === 'SUCCESS' ? 'text-green-700 dark:text-green-400' :
                                        lastResult.status === 'WARNING' ? 'text-yellow-700 dark:text-yellow-400' :
                                        'text-red-700 dark:text-red-400'
                                    }`}>
                                        {lastResult.title}
                                    </p>
                                    <p className="text-lg font-black text-gray-900 dark:text-white truncate">
                                        {lastResult.message}
                                    </p>
                                </div>
                                <button onClick={() => setLastResult(null)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <History size={14}/> Riwayat Scan Terbaru
                            </h3>
                            <button onClick={() => setLogs([])} className="text-[10px] font-bold text-red-500 hover:underline uppercase">Hapus</button>
                        </div>
                        
                        <div className="space-y-2">
                            {logs.length === 0 ? (
                                <p className="text-center py-6 text-xs text-gray-400 italic">Belum ada aktivitas.</p>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-dark-border rounded-xl shadow-sm animate-in fade-in duration-300">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1 h-6 rounded-full ${
                                                log.status === 'SUCCESS' ? 'bg-green-500' :
                                                log.status === 'WARNING' ? 'bg-yellow-500' :
                                                'bg-red-500'
                                            }`}></div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-gray-800 dark:text-white truncate max-w-[140px]">{log.memberName}</p>
                                                <p className="text-[10px] text-gray-500 leading-none">{log.message}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-gray-400">{log.time}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    </div>
  );
};
