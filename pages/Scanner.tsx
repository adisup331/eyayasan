
import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Event, Member, EventSession } from '../types';
import { supabase } from '../supabaseClient';
import { ScanBarcode, Keyboard, PlayCircle, CheckCircle2, XCircle, AlertTriangle, CalendarDays, Clock, User, Ban, Camera, StopCircle, History, ChevronRight, QrCode } from '../components/ui/Icons';

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
  const [selectedSessionId, setSelectedSessionId] = useState(''); // NEW: Specific Session
  
  const [scanMode, setScanMode] = useState<'CAMERA' | 'MANUAL'>('CAMERA');
  const [manualInput, setManualInput] = useState('');
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [lastResult, setLastResult] = useState<{status: 'SUCCESS'|'ERROR'|'WARNING', title: string, message: string} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Filter Active Events (Upcoming or Today)
  const activeEvents = React.useMemo(() => {
      const now = new Date();
      now.setHours(0,0,0,0);
      return events.filter(e => {
          const eDate = new Date(e.date);
          return eDate >= now && e.status !== 'Cancelled';
      }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const availableSessions: EventSession[] = selectedEvent?.sessions || [{id: 'default', name: 'Kehadiran'}];

  // Default select first session when event changes
  useEffect(() => {
      if (selectedEvent && availableSessions.length > 0) {
          setSelectedSessionId(availableSessions[0].id);
      }
  }, [selectedEventId]);

  // --- SCANNER LOGIC ---
  useEffect(() => {
      // Clean up function to run when component unmounts or camera is stopped
      return () => {
          if (scannerRef.current) {
              try {
                  scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
              } catch (e) {
                  console.error("Error clearing scanner", e);
              }
              scannerRef.current = null;
          }
      };
  }, []);

  const startCamera = () => {
      if (!selectedEventId) return;
      setCameraError(null);
      setIsCameraActive(true);

      // Delay slightly to allow DOM to render
      setTimeout(() => {
          const element = document.getElementById('full-reader');
          if (element) {
              try {
                  if (scannerRef.current) {
                      scannerRef.current.clear().catch(() => {});
                  }

                  const scanner = new Html5QrcodeScanner(
                      "full-reader", 
                      { 
                          fps: 10, 
                          qrbox: { width: 250, height: 250 },
                          formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128 ],
                          rememberLastUsedCamera: true,
                          aspectRatio: 1.0
                      },
                      /* verbose= */ false
                  );
                  
                  scannerRef.current = scanner;
                  
                  scanner.render(
                      onScanSuccess, 
                      (err) => {
                          // Ignore scan errors as they happen every frame no code is detected
                      }
                  );
              } catch (err: any) {
                  console.error("Camera Start Error:", err);
                  setCameraError("Gagal memulai kamera. Pastikan izin browser diizinkan.");
                  setIsCameraActive(false);
              }
          }
      }, 100);
  };

  const stopCamera = () => {
      if (scannerRef.current) {
          scannerRef.current.clear().then(() => {
              scannerRef.current = null;
              setIsCameraActive(false);
          }).catch((err) => {
              console.error("Failed to stop", err);
              setIsCameraActive(false);
          });
      } else {
          setIsCameraActive(false);
      }
  };

  const addLog = (name: string, status: 'SUCCESS' | 'ERROR' | 'WARNING', message: string) => {
      const newLog: ScanLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}),
          memberName: name,
          status,
          message
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  const processAttendance = async (memberId: string) => {
      if (!selectedEventId || isProcessing) return;
      setIsProcessing(true);
      setLastResult(null);

      // Handle raw Code-128 or QR
      const cleanId = memberId.trim();

      const member = members.find(m => m.id === cleanId);
      
      if (!member) {
          setLastResult({ status: 'ERROR', title: 'Tidak Ditemukan', message: `ID: ${cleanId}` });
          addLog(cleanId, 'ERROR', 'ID Tidak Ditemukan');
          
          triggerErrorEffect();
          return;
      }

      try {
          // 1. Get Existing Record
          const { data: existing, error: checkError } = await supabase
              .from('event_attendance')
              .select('*')
              .eq('event_id', selectedEventId)
              .eq('member_id', member.id)
              .single();

          if (checkError && checkError.code !== 'PGRST116') throw checkError; 

          // 2. Check Session Log
          const currentLogs = (existing?.logs as Record<string, string>) || {};
          const targetSessionId = selectedSessionId || 'default';

          if (currentLogs[targetSessionId]) {
              // ALREADY SCANNED FOR THIS SESSION
              setLastResult({ status: 'WARNING', title: 'Sudah Scan', message: `${member.full_name} (${targetSessionId})` });
              addLog(member.full_name, 'WARNING', 'Sudah scan sesi ini');
              triggerErrorEffect();
              return;
          }

          // 3. Update Logs
          const now = new Date().toISOString();
          const newLogs = { ...currentLogs, [targetSessionId]: now };

          const { error: upsertError } = await supabase
              .from('event_attendance')
              .upsert({ 
                  event_id: selectedEventId, 
                  member_id: member.id, 
                  status: 'Present', // Always present if scanned
                  check_in_time: now, // Latest scan
                  logs: newLogs // Save session log
              }, { onConflict: 'event_id, member_id' });

          if (upsertError) throw upsertError;

          const sessionName = availableSessions.find(s => s.id === targetSessionId)?.name || 'Hadir';
          setLastResult({ status: 'SUCCESS', title: sessionName, message: member.full_name });
          addLog(member.full_name, 'SUCCESS', `Scan ${sessionName}`);
          onRefresh(); // Sync main data
          triggerSuccessEffect();

      } catch (err: any) {
          console.error(err);
          setLastResult({ status: 'ERROR', title: 'Error System', message: err.message });
          addLog(member.full_name, 'ERROR', err.message);
          triggerErrorEffect();
      }
  };

  const triggerSuccessEffect = () => {
      // Pause briefly for visual feedback
      if(scannerRef.current) scannerRef.current.pause(true);
      setTimeout(() => { 
          if(scannerRef.current) scannerRef.current.resume(); 
          setIsProcessing(false);
          setManualInput(''); 
      }, 1500);
  }

  const triggerErrorEffect = () => {
      if(scannerRef.current) scannerRef.current.pause(true);
      setTimeout(() => { 
          if(scannerRef.current) scannerRef.current.resume(); 
          setIsProcessing(false);
          setManualInput(''); // Clear input
      }, 2000);
  }

  const onScanSuccess = (decodedText: string) => {
      processAttendance(decodedText);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(manualInput.trim()) processAttendance(manualInput.trim());
  };

  const handleModeSwitch = (mode: 'CAMERA' | 'MANUAL') => {
      setScanMode(mode);
      stopCamera();
      setLastResult(null);
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-black flex flex-col relative shadow-2xl border-x border-gray-100 dark:border-gray-800">
        
        {/* --- 1. STICKY HEADER & EVENT SELECTOR --- */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <ScanBarcode className="text-primary-600 dark:text-primary-400" /> Scanner
            </h2>
            
            <div className="space-y-2">
                {/* Event Selector */}
                <div className="relative">
                    <select 
                        value={selectedEventId} 
                        onChange={e => { 
                            setSelectedEventId(e.target.value); 
                            setLogs([]); 
                            setLastResult(null); 
                            stopCamera(); 
                        }}
                        className="w-full pl-3 pr-8 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-800 dark:text-white appearance-none outline-none focus:ring-2 focus:ring-primary-500 transition-shadow shadow-sm"
                    >
                        <option value="">-- Pilih Acara --</option>
                        {activeEvents.map(e => (
                            <option key={e.id} value={e.id}>
                                {e.name}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-gray-500">
                        <ChevronRight size={16} className="rotate-90" />
                    </div>
                </div>

                {/* Session Selector (Only if Event Selected) */}
                {selectedEvent && (
                    <div className="relative animate-in slide-in-from-top-2">
                        <select 
                            value={selectedSessionId} 
                            onChange={e => setSelectedSessionId(e.target.value)}
                            className="w-full pl-3 pr-8 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold text-blue-800 dark:text-blue-300 appearance-none outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {availableSessions.map(s => (
                                <option key={s.id} value={s.id}>Scan untuk: {s.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-2.5 pointer-events-none text-blue-500">
                            <ChevronRight size={14} className="rotate-90" />
                        </div>
                    </div>
                )}
            </div>

            {selectedEvent && (
                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500 dark:text-gray-400 px-1">
                    <span className="flex items-center gap-1"><CalendarDays size={10}/> {new Date(selectedEvent.date).toLocaleDateString('id-ID')}</span>
                    <span className="flex items-center gap-1"><Clock size={10}/> {new Date(selectedEvent.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
            )}
        </div>

        {/* --- 2. MAIN CONTENT AREA --- */}
        <div className="flex-1 p-4 space-y-4">
            
            {!selectedEventId ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-3">
                        <ScanBarcode size={32} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pilih acara di atas untuk mulai scan.</p>
                </div>
            ) : (
                <>
                    {/* SEGMENTED CONTROL */}
                    <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
                        <button 
                            onClick={() => handleModeSwitch('CAMERA')}
                            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${scanMode === 'CAMERA' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white scale-[1.02]' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <Camera size={14}/> Kamera
                        </button>
                        <button 
                            onClick={() => handleModeSwitch('MANUAL')}
                            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${scanMode === 'MANUAL' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white scale-[1.02]' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <Keyboard size={14}/> Input ID
                        </button>
                    </div>

                    {/* SCANNER / INPUT BOX */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden relative min-h-[300px] flex flex-col">
                        {scanMode === 'CAMERA' ? (
                            <div className="flex-1 flex flex-col relative bg-black">
                                {isCameraActive ? (
                                    <>
                                        <div id="full-reader" className="w-full h-full object-cover"></div>
                                        <button 
                                            onClick={stopCamera}
                                            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600/90 hover:bg-red-700 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-sm shadow-lg transition"
                                        >
                                            <StopCircle size={14}/> Stop
                                        </button>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-center p-6">
                                        <div className="mb-4 relative">
                                            <div className="absolute inset-0 bg-primary-500 blur-xl opacity-20 rounded-full"></div>
                                            <QrCode size={48} className="text-gray-400 relative z-10" />
                                        </div>
                                        <p className="text-xs text-gray-500 mb-4">Pastikan cahaya cukup terang</p>
                                        <button 
                                            onClick={startCamera}
                                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary-600/30 flex items-center gap-2 transition active:scale-95"
                                        >
                                            <Camera size={18}/> Buka Kamera
                                        </button>
                                        {cameraError && <p className="text-[10px] text-red-500 mt-3 bg-red-50 px-2 py-1 rounded">{cameraError}</p>}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col justify-center p-6 bg-gray-50 dark:bg-gray-900/50">
                                <form onSubmit={handleManualSubmit} className="w-full space-y-4">
                                    <div className="text-center space-y-2">
                                        <Keyboard size={32} className="mx-auto text-gray-300 mb-2"/>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Input Manual</label>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={manualInput}
                                        onChange={e => setManualInput(e.target.value)}
                                        className="w-full p-4 text-center text-xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                                        placeholder="ID..."
                                        autoFocus
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!manualInput || isProcessing} 
                                        className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-600/20 transition active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {isProcessing ? 'Memproses...' : <><PlayCircle size={18}/> Cek Absen</>}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* STATUS CARD (LAST RESULT) */}
                    {lastResult && (
                        <div className={`p-4 rounded-xl border shadow-sm animate-in zoom-in duration-300 ${
                            lastResult.status === 'SUCCESS' ? 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800' :
                            lastResult.status === 'WARNING' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800' :
                            'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${
                                    lastResult.status === 'SUCCESS' ? 'bg-green-100 text-green-600' :
                                    lastResult.status === 'WARNING' ? 'bg-yellow-100 text-yellow-600' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                    {lastResult.status === 'SUCCESS' ? <CheckCircle2 size={24}/> : 
                                     lastResult.status === 'WARNING' ? <AlertTriangle size={24}/> : <XCircle size={24}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold uppercase tracking-wider ${
                                        lastResult.status === 'SUCCESS' ? 'text-green-700 dark:text-green-400' :
                                        lastResult.status === 'WARNING' ? 'text-yellow-700 dark:text-yellow-400' :
                                        'text-red-700 dark:text-red-400'
                                    }`}>
                                        {lastResult.title}
                                    </p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                        {lastResult.message}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RECENT LOGS LIST */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <History size={12}/> Riwayat Scan ({logs.length})
                            </h3>
                            {logs.length > 0 && <button onClick={() => setLogs([])} className="text-[10px] text-red-500 hover:underline">Hapus Log</button>}
                        </div>
                        
                        <div className="space-y-2">
                            {logs.length === 0 ? (
                                <p className="text-center text-xs text-gray-400 py-4 italic bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                                    Belum ada data scan sesi ini.
                                </p>
                            ) : (
                                logs.slice(0, 5).map(log => (
                                    <div key={log.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm animate-in slide-in-from-bottom-2">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {log.status === 'SUCCESS' ? <div className="w-1.5 h-8 bg-green-500 rounded-full shrink-0"></div> :
                                             log.status === 'WARNING' ? <div className="w-1.5 h-8 bg-yellow-500 rounded-full shrink-0"></div> :
                                             <div className="w-1.5 h-8 bg-red-500 rounded-full shrink-0"></div>}
                                            
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{log.memberName}</p>
                                                <p className="text-[10px] text-gray-500 truncate">{log.message}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-mono text-gray-400 shrink-0 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                            {log.time}
                                        </span>
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