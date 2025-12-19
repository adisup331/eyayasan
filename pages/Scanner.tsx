import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore - html5-qrcode is loaded via importmap in index.html
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
  const [selectedSessionId, setSelectedSessionId] = useState(''); 
  
  const [scanMode, setScanMode] = useState<'CAMERA' | 'MANUAL'>('CAMERA');
  const [manualInput, setManualInput] = useState('');
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [lastResult, setLastResult] = useState<{status: 'SUCCESS'|'ERROR'|'WARNING', title: string, message: string} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

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
      if (selectedEvent && availableSessions.length > 0) {
          setSelectedSessionId(availableSessions[0].id);
      }
  }, [selectedEventId]);

  useEffect(() => {
      return () => {
          if (scannerRef.current) {
              try {
                  scannerRef.current.clear().catch((err: any) => console.error("Failed to clear scanner", err));
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
                          fps: 15, 
                          qrbox: { width: 280, height: 280 },
                          formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128 ],
                          rememberLastUsedCamera: true,
                          aspectRatio: 1.0
                      },
                      false
                  );
                  
                  scannerRef.current = scanner;
                  
                  scanner.render(
                      onScanSuccess, 
                      (err: any) => {
                          // Suppress noisy errors
                      }
                  );
              } catch (err: any) {
                  console.error("Camera Start Error:", err);
                  setCameraError("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
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
          }).catch((err: any) => {
              console.error(err);
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
      setLogs(prev => [newLog, ...prev].slice(0, 30));
  };

  const processAttendance = async (memberId: string) => {
      if (!selectedEventId || isProcessing) return;
      setIsProcessing(true);
      setLastResult(null);

      const cleanId = memberId.trim();
      const member = members.find(m => m.id === cleanId);
      
      if (!member) {
          setLastResult({ 
              status: 'ERROR', 
              title: 'Data Tidak Ditemukan', 
              message: `ID: ${cleanId.substring(0, 8)}...` 
          });
          addLog(cleanId, 'ERROR', 'ID Tidak Terdaftar');
          setIsProcessing(false);
          return;
      }

      try {
          const { data: existing, error: checkError } = await supabase
              .from('event_attendance')
              .select('*')
              .eq('event_id', selectedEventId)
              .eq('member_id', member.id)
              .single();

          if (checkError && checkError.code !== 'PGRST116') throw checkError; 

          const currentLogs = (existing?.logs as Record<string, string>) || {};
          const targetSessionId = selectedSessionId || 'default';

          if (currentLogs[targetSessionId]) {
              setLastResult({ 
                  status: 'WARNING', 
                  title: 'Sudah Absen', 
                  message: `${member.full_name}` 
              });
              addLog(member.full_name, 'WARNING', 'Sudah scan sesi ini');
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

          const sessionName = availableSessions.find(s => s.id === targetSessionId)?.name || 'Hadir';
          setLastResult({ 
              status: 'SUCCESS', 
              title: sessionName, 
              message: member.full_name 
          });
          addLog(member.full_name, 'SUCCESS', `Berhasil: ${sessionName}`);
          
          onRefresh();
          if (navigator.vibrate) navigator.vibrate(100);

      } catch (err: any) {
          setLastResult({ 
              status: 'ERROR', 
              title: 'Error Sistem', 
              message: err.message 
          });
          addLog(member.full_name, 'ERROR', 'Gagal memproses data');
      } finally {
          setIsProcessing(false);
          setManualInput('');
      }
  };

  const onScanSuccess = (decodedText: string) => {
      processAttendance(decodedText);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(manualInput.trim()) {
          processAttendance(manualInput.trim());
      }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-black flex flex-col relative">
        <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border p-4 sticky top-0 z-20">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <ScanBarcode className="text-primary-600 dark:text-primary-400" /> Scanner Mobile
            </h2>
            
            <div className="space-y-3">
                <div className="relative">
                    <select 
                        value={selectedEventId} 
                        onChange={e => { setSelectedEventId(e.target.value); setLogs([]); setLastResult(null); stopCamera(); }}
                        className="w-full pl-3 pr-8 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-dark-border rounded-xl text-sm font-bold text-gray-800 dark:text-white appearance-none outline-none focus:ring-2 focus:ring-primary-500"
                    >
                        <option value="">-- Pilih Agenda --</option>
                        {activeEvents.map(e => (
                            <option key={e.id} value={e.id}>
                                {e.name}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                        <ChevronRight size={18} className="rotate-90" />
                    </div>
                </div>

                {selectedEvent && (
                    <div className="flex flex-col gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl">
                        <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Pilih Sesi:</label>
                        <div className="flex flex-wrap gap-2">
                            {availableSessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSessionId(s.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        selectedSessionId === s.id 
                                        ? 'bg-blue-600 text-white shadow-md' 
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
                <div className="h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl">
                    <CalendarDays size={40} className="text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">Silakan pilih agenda terlebih dahulu untuk mulai memindai.</p>
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
                            <Keyboard size={16}/> Manual
                        </button>
                    </div>

                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden relative min-h-[300px] flex flex-col">
                        {scanMode === 'CAMERA' ? (
                            <div className="flex-1 flex flex-col">
                                {isCameraActive ? (
                                    <>
                                        <div id="full-reader" className="w-full"></div>
                                        <button 
                                            onClick={stopCamera}
                                            className="m-4 bg-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                                        >
                                            <StopCircle size={18}/> Matikan Kamera
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                        <QrCode size={64} className="text-gray-200 mb-6" />
                                        <button 
                                            onClick={startCamera}
                                            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 transition active:scale-95"
                                        >
                                            <PlayCircle size={24}/> Buka Kamera
                                        </button>
                                        {cameraError && <p className="text-xs text-red-500 mt-4">{cameraError}</p>}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col justify-center p-6">
                                <form onSubmit={handleManualSubmit} className="space-y-4">
                                    <div className="text-center mb-4">
                                        <Keyboard size={32} className="mx-auto text-gray-300 mb-2"/>
                                        <h3 className="font-bold text-gray-800 dark:text-white">Input ID Anggota</h3>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={manualInput}
                                        onChange={e => setManualInput(e.target.value)}
                                        className="w-full p-4 text-center text-xl font-bold border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 dark:text-white focus:border-primary-500 outline-none"
                                        placeholder="Ketik ID Disini..."
                                        autoFocus
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!manualInput || isProcessing} 
                                        className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary-600/20"
                                    >
                                        {isProcessing ? 'Memproses...' : 'Proses Absensi'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {lastResult && (
                        <div className={`p-6 rounded-2xl border-2 shadow-lg animate-in zoom-in duration-300 ${
                            lastResult.status === 'SUCCESS' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                            lastResult.status === 'WARNING' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' :
                            'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                        }`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${
                                    lastResult.status === 'SUCCESS' ? 'bg-green-500 text-white' :
                                    lastResult.status === 'WARNING' ? 'bg-yellow-500 text-white' :
                                    'bg-red-500 text-white'
                                }`}>
                                    {lastResult.status === 'SUCCESS' ? <CheckCircle2 size={32}/> : 
                                     lastResult.status === 'WARNING' ? <AlertTriangle size={32}/> : <XCircle size={32}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-black uppercase tracking-widest ${
                                        lastResult.status === 'SUCCESS' ? 'text-green-700 dark:text-green-400' :
                                        lastResult.status === 'WARNING' ? 'text-yellow-700 dark:text-yellow-400' :
                                        'text-red-700 dark:text-red-400'
                                    }`}>
                                        {lastResult.title}
                                    </p>
                                    <p className="text-xl font-extrabold text-gray-900 dark:text-white truncate">
                                        {lastResult.message}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <History size={14}/> Riwayat Scan Terakhir
                            </h3>
                            <button onClick={() => setLogs([])} className="text-[10px] font-bold text-red-500 uppercase">Bersihkan</button>
                        </div>
                        
                        <div className="space-y-2">
                            {logs.length === 0 ? (
                                <p className="text-center py-6 text-xs text-gray-400 italic">Belum ada aktivitas scan.</p>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-dark-border rounded-xl shadow-sm">
                                        <div className="flex items-center gap-3">
                                            {/* Fix missing opening quotes in template literal */}
                                            <div className={`w-1 h-6 rounded-full ${
                                                log.status === 'SUCCESS' ? 'bg-green-500' :
                                                log.status === 'WARNING' ? 'bg-yellow-500' :
                                                'bg-red-500'
                                            }`}></div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-800 dark:text-white">{log.memberName}</p>
                                                <p className="text-[10px] text-gray-500">{log.message}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400">{log.time}</span>
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