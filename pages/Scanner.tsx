import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Event, Member, EventSession, EventAttendance } from '../types';
import { supabase } from '../supabaseClient';
import { 
    ScanBarcode, Keyboard, PlayCircle, CheckCircle2, XCircle, 
    AlertTriangle, Camera, StopCircle, History, ChevronRight, 
    QrCode, RefreshCw, X, List, Users, Clock, Check, UserPlus, Timer
} from '../components/ui/Icons';

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
    status: 'SUCCESS' | 'ERROR' | 'WARNING';
    message: string;
}

export const Scanner: React.FC<ScannerProps> = ({ events, members, attendance, onRefresh }) => {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(''); 
  const [scanMode, setScanMode] = useState<'CAMERA' | 'MANUAL' | 'LIST'>('CAMERA');
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

  const activeEvents = useMemo(() => {
      const now = new Date(); const threeDaysAgo = new Date(now); threeDaysAgo.setDate(now.getDate() - 3);
      return events.filter(e => { const eDate = new Date(e.date); return eDate >= threeDaysAgo && e.status !== 'Cancelled'; }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const availableSessions: EventSession[] = selectedEvent?.sessions || [{id: 'default', name: 'Kehadiran'}];
  const activeSession = availableSessions.find(s => s.id === (selectedSessionId || 'default')) || availableSessions[0];

  useEffect(() => {
      isMounted.current = true;
      if (selectedEvent && availableSessions.length > 0) { setSelectedSessionId(availableSessions[0].id); }
      return () => { isMounted.current = false; if (scannerRef.current?.isScanning) { scannerRef.current.stop().catch(() => {}); } };
  }, [selectedEventId, selectedEvent, availableSessions]);

  const stopCamera = async () => {
      if (scannerRef.current) { try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); } catch (err) {} finally { scannerRef.current = null; } }
      setIsCameraActive(false); setIsInitializing(false);
  };

  const handleScanNext = async () => { setLastResult(null); setManualInput(''); if (scanMode === 'CAMERA') { await stopCamera(); await startCamera(); } };

  const processAttendance = async (memberId: string) => {
      if (!selectedEventId || isProcessing) return;
      setIsProcessing(true); await stopCamera();
      
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
      
      // Tentukan status berdasarkan waktu scan
      const finalStatus = now > limitTime ? 'Excused Late' : 'Present';
      
      await executeSave(member, finalStatus);
      setIsProcessing(false);
  };

  const executeSave = async (member: Member, status: 'Present' | 'Excused Late') => {
      try {
          const now = new Date().toISOString(); 
          const targetSessionId = selectedSessionId || 'default';
          const existing = attendance.find(a => a.event_id === selectedEventId && a.member_id === member.id);
          
          const { error } = await supabase.from('event_attendance').upsert({ 
              event_id: selectedEventId, 
              member_id: member.id, 
              status, 
              check_in_time: now, 
              logs: { ...(existing?.logs || {}), [targetSessionId]: now } 
          }, { onConflict: 'event_id, member_id' });
          
          if (error) throw error;
          
          setLastResult({ 
              status: status === 'Present' ? 'SUCCESS' : 'WARNING', 
              title: status === 'Present' ? 'Berhasil Absen' : 'Absen (Terlambat)', 
              message: member.full_name 
          });
          
          setLogs(prev => [{ 
              id: Math.random().toString(36).substr(2, 9), 
              time: new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit', hour12: false}), 
              memberName: member.full_name, 
              status: status === 'Present' ? 'SUCCESS' : 'WARNING', 
              message: status === 'Present' ? 'Hadir Tepat' : 'Telat' 
          }, ...prev].slice(0, 10));
          
          onRefresh();
      } catch (err: any) { setLastResult({ status: 'ERROR', title: 'Gagal', message: err.message }); }
  };

  const startCamera = async () => {
      if (!selectedEventId || isInitializing) return; setIsInitializing(true); setCameraError(null); setIsCameraActive(true);
      setTimeout(async () => {
          try { const html5QrCode = new Html5Qrcode(scanDivId); scannerRef.current = html5QrCode; await html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 250, height: 250 } }, (text) => processAttendance(text), () => {}); setIsInitializing(false); } 
          catch (err: any) { setCameraError(err.message); setIsCameraActive(false); setIsInitializing(false); }
      }, 500);
  };

  return (
    <div className="max-w-lg mx-auto min-h-[calc(100vh-80px)] bg-gray-50 dark:bg-black flex flex-col pb-10">
        <div className="bg-white dark:bg-dark-card border-b p-4 sticky top-0 z-20 shadow-sm">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-gray-900 dark:text-white"><ScanBarcode className="text-primary-600" /> QR Scanner Kehadiran</h2>
            <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); stopCamera(); setLastResult(null); }} className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border rounded-xl text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-primary-500">
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
                    <div className="bg-white dark:bg-dark-card px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 flex justify-between items-center shadow-sm">
                        <div className="flex flex-col">
                             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Sesi Aktif</span>
                             <span className="text-sm font-black text-primary-600">{activeSession.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-indigo-300 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg"><Clock size={14}/> {activeSession.startTime || '--:--'} WIB</div>
                    </div>
                    
                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden relative min-h-[400px] flex flex-col">
                        {scanMode === 'CAMERA' && (
                            <div className="flex-1 flex flex-col">
                                {isCameraActive ? (
                                    <div className="flex flex-col flex-1 relative">
                                        <div id={scanDivId} className="w-full aspect-square bg-black overflow-hidden relative" />
                                        <div className="p-4 bg-white dark:bg-dark-card border-t dark:border-gray-800">
                                            <button onClick={stopCamera} className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition"><StopCircle size={18}/> Matikan Kamera</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                                        <div className="w-24 h-24 bg-primary-50 dark:bg-primary-950 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 mb-6 shadow-inner"><QrCode size={48} /></div>
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-2">Siap Melakukan Scan</h3>
                                        <p className="text-xs text-gray-500 mb-8 max-w-[240px]">Pastikan pencahayaan cukup dan QR Code terlihat jelas di kamera.</p>
                                        <button onClick={startCamera} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-primary-600/20 flex items-center justify-center gap-3 uppercase tracking-widest transition-all active:scale-95"><PlayCircle size={24}/> Mulai Kamera</button>
                                    </div>
                                )}
                            </div>
                        )}
                        {lastResult && (
                            <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 ${
                                lastResult.status === 'SUCCESS' ? 'bg-green-500' : 
                                lastResult.status === 'WARNING' ? 'bg-amber-500' : 'bg-red-600'
                            }`}>
                                <div className="p-5 bg-white/20 rounded-full mb-6 text-white backdrop-blur-md">
                                    {lastResult.status === 'SUCCESS' ? <CheckCircle2 size={72}/> : 
                                     lastResult.status === 'WARNING' ? <Timer size={72}/> : <XCircle size={72}/>}
                                </div>
                                <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">{lastResult.title}</h3>
                                <p className="text-white font-bold text-xl mb-12 drop-shadow-sm uppercase">{lastResult.message}</p>
                                <button onClick={handleScanNext} className="w-full max-w-[280px] bg-white text-gray-900 py-4 rounded-2xl font-black shadow-2xl flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95 transition-transform"><ScanBarcode size={24}/> Lanjut Scan</button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl opacity-60 bg-white dark:bg-dark-card"><QrCode size={48} className="mb-4 text-gray-300" /><p className="text-sm font-bold text-gray-400">Silakan pilih acara di atas</p></div>
            )}
        </div>
    </div>
  );
};