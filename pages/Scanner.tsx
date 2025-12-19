import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Event, Member, EventSession, EventAttendance } from '../types';
import { supabase } from '../supabaseClient';
import { 
    ScanBarcode, Keyboard, PlayCircle, CheckCircle2, XCircle, 
    AlertTriangle, Camera, StopCircle, History, ChevronRight, 
    QrCode, RefreshCw, X, List, Users, Clock, Check, UserPlus
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
  
  // State untuk verifikasi telat
  const [pendingMember, setPendingMember] = useState<Member | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNextBtn, setShowNextBtn] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMounted = useRef(true);
  const scanDivId = "reader-viewport-main";
  const cooldownTimerRef = useRef<any>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);

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

  useEffect(() => {
      isMounted.current = true;
      if (selectedEvent && availableSessions.length > 0) {
          setSelectedSessionId(availableSessions[0].id);
      }
      return () => {
          isMounted.current = false;
          if (scannerRef.current?.isScanning) {
              scannerRef.current.stop().catch(() => {});
          }
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      };
  }, [selectedEventId, selectedEvent]);

  const playFeedbackSound = (type: 'SUCCESS' | 'ERROR' | 'PROMPT') => {
      try {
          if (!audioCtxRef.current) {
              audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') ctx.resume();

          if (type === 'SUCCESS') {
              const now = ctx.currentTime;
              const playNote = (f: number, s: number, d: number) => {
                  const osc = ctx.createOscillator();
                  const g = ctx.createGain();
                  osc.frequency.setValueAtTime(f, s);
                  g.gain.setValueAtTime(0.1, s);
                  g.gain.exponentialRampToValueAtTime(0.01, s + d);
                  osc.connect(g).connect(ctx.destination);
                  osc.start(s); osc.stop(s + d);
              };
              playNote(660, now, 0.1); playNote(880, now + 0.1, 0.15);
          } else if (type === 'PROMPT') {
              const osc = ctx.createOscillator();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(440, ctx.currentTime);
              const g = ctx.createGain();
              g.gain.setValueAtTime(0.1, ctx.currentTime);
              osc.connect(g).connect(ctx.destination);
              osc.start(); osc.stop(ctx.currentTime + 0.2);
          } else {
              const osc = ctx.createOscillator();
              osc.type = 'square';
              osc.frequency.setValueAtTime(110, ctx.currentTime); 
              const g = ctx.createGain();
              g.gain.setValueAtTime(0.05, ctx.currentTime);
              osc.connect(g).connect(ctx.destination);
              osc.start(); osc.stop(ctx.currentTime + 0.3);
          }
      } catch (e) {}
  };

  const resetScannerState = () => {
      setIsProcessing(false);
      setLastResult(null);
      setShowNextBtn(false);
      setPendingMember(null);
      setManualInput('');
  };

  const processAttendance = async (memberId: string) => {
      if (!selectedEventId || isProcessing || pendingMember || showNextBtn) return;
      setIsProcessing(true);

      const cleanId = memberId.trim();
      // Cari berdasarkan ID atau Nama (untuk manual input)
      const member = members.find(m => m.id === cleanId || m.full_name.toLowerCase() === cleanId.toLowerCase());
      
      if (!member) {
          setLastResult({ status: 'ERROR', title: 'Tidak Dikenal', message: `Data tidak ditemukan di database.` });
          playFeedbackSound('ERROR');
          setTimeout(() => resetScannerState(), 2500);
          return;
      }

      // Cek Duplikasi di Sesi ini
      const targetSessionId = selectedSessionId || 'default';
      const existing = attendance.find(a => a.event_id === selectedEventId && a.member_id === member.id);
      if (existing?.logs?.[targetSessionId]) {
          setLastResult({ status: 'WARNING', title: 'Sudah Terabsen', message: `${member.full_name} sudah melakukan scan sebelumnya.` });
          playFeedbackSound('ERROR');
          setShowNextBtn(true);
          return;
      }

      // Logika Waktu (Telat)
      const now = new Date();
      const eventStartTime = selectedEvent ? new Date(selectedEvent.date) : now;
      const tolerance = selectedEvent?.late_tolerance || 15;
      const lateTime = new Date(eventStartTime.getTime() + tolerance * 60000);
      
      const isLate = now > lateTime;

      if (isLate) {
          playFeedbackSound('PROMPT');
          setPendingMember(member);
      } else {
          executeSave(member, 'Present');
      }
  };

  const executeSave = async (member: Member, status: 'Present' | 'Excused Late') => {
      try {
          const now = new Date().toISOString();
          const targetSessionId = selectedSessionId || 'default';
          
          const existing = attendance.find(a => a.event_id === selectedEventId && a.member_id === member.id);
          const newLogs = { ...(existing?.logs || {}), [targetSessionId]: now };

          const { error } = await supabase.from('event_attendance').upsert({ 
              event_id: selectedEventId, 
              member_id: member.id, 
              status,
              check_in_time: now, 
              logs: newLogs 
          }, { onConflict: 'event_id, member_id' });

          if (error) throw error;

          setLastResult({ 
              status: 'SUCCESS', 
              title: status === 'Excused Late' ? 'Izin Telat Disetujui' : 'Berhasil Absen', 
              message: member.full_name 
          });
          addLog(member.full_name, 'SUCCESS', status === 'Excused Late' ? 'Hadir (Izin Telat)' : 'Hadir Tepat Waktu');
          playFeedbackSound('SUCCESS');
          if (navigator.vibrate) navigator.vibrate([100]);
          onRefresh();
          setShowNextBtn(true);
      } catch (err: any) {
          setLastResult({ status: 'ERROR', title: 'Gagal Simpan', message: err.message });
          playFeedbackSound('ERROR');
          setShowNextBtn(true);
      } finally {
          setPendingMember(null);
      }
  };

  const stopCamera = async () => {
      if (scannerRef.current) {
          try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); } 
          catch (err) {} finally { scannerRef.current = null; }
      }
      setIsCameraActive(false);
      setIsInitializing(false);
  };

  const startCamera = async () => {
      if (!selectedEventId || isInitializing) return;
      setIsInitializing(true);
      setCameraError(null);
      await stopCamera();
      setIsCameraActive(true);

      setTimeout(async () => {
          if (!isMounted.current) return;
          try {
              const html5QrCode = new Html5Qrcode(scanDivId);
              scannerRef.current = html5QrCode;
              await html5QrCode.start(
                  { facingMode: "environment" }, 
                  { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, 
                  (text) => processAttendance(text),
                  () => {}
              );
              setIsInitializing(false);
          } catch (err: any) {
              setCameraError(err.message || "Gagal akses kamera.");
              setIsCameraActive(false);
              setIsInitializing(false);
          }
      }, 600);
  };

  const addLog = (name: string, status: 'SUCCESS' | 'ERROR' | 'WARNING', message: string) => {
      const newLog: ScanLog = {
          id: Math.random().toString(36).substr(2, 9),
          time: new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}),
          memberName: name, status, message
      };
      setLogs(prev => [newLog, ...prev].slice(0, 10));
  };

  return (
    <div className="max-w-lg mx-auto min-h-[calc(100vh-80px)] bg-gray-50 dark:bg-black flex flex-col pb-10">
        {/* Header Section */}
        <div className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border p-4 sticky top-0 z-20">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <ScanBarcode className="text-primary-600" /> Scanner Absensi
            </h2>
            
            <div className="space-y-3">
                <select 
                    value={selectedEventId} 
                    onChange={e => { setSelectedEventId(e.target.value); stopCamera(); resetScannerState(); }}
                    className="w-full px-3 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-dark-border rounded-xl text-sm font-bold dark:text-white outline-none"
                >
                    <option value="">-- Pilih Acara --</option>
                    {activeEvents.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({new Date(e.date).toLocaleDateString()})</option>
                    ))}
                </select>

                {selectedEvent && (
                    <div className="flex flex-wrap gap-2 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                        {availableSessions.map(s => (
                            <button
                                key={s.id}
                                onClick={() => { setSelectedSessionId(s.id); resetScannerState(); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    selectedSessionId === s.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-blue-600 border border-blue-100 dark:border-blue-900'
                                }`}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <div className="flex-1 p-4 space-y-4">
            {!selectedEventId ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl opacity-60">
                    <QrCode size={48} className="text-gray-300 mb-4" />
                    <p className="text-sm font-medium text-gray-500">Pilih acara untuk memulai</p>
                </div>
            ) : (
                <>
                    {/* Mode Switcher */}
                    <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl">
                        <button onClick={() => { setScanMode('CAMERA'); stopCamera(); resetScannerState(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${scanMode === 'CAMERA' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}><Camera size={16} className="inline mr-1"/> Kamera</button>
                        <button onClick={() => { setScanMode('MANUAL'); stopCamera(); resetScannerState(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${scanMode === 'MANUAL' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}><Keyboard size={16} className="inline mr-1"/> Manual</button>
                        <button onClick={() => { setScanMode('LIST'); stopCamera(); resetScannerState(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${scanMode === 'LIST' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}><List size={16} className="inline mr-1"/> List</button>
                    </div>

                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden relative min-h-[360px] flex flex-col">
                        {scanMode === 'CAMERA' && (
                            <div className="flex-1 flex flex-col">
                                {isCameraActive ? (
                                    <div className="flex flex-col flex-1 relative">
                                        <div id={scanDivId} className="w-full aspect-square bg-black overflow-hidden relative">
                                            {isInitializing && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10"><RefreshCw size={32} className="text-primary-500 animate-spin" /></div>
                                            )}
                                        </div>
                                        <div className="p-4 bg-white dark:bg-dark-card border-t dark:border-gray-800">
                                            <button onClick={stopCamera} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95"><StopCircle size={18}/> Matikan Kamera</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                                        <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center text-primary-600 mb-6"><QrCode size={40} /></div>
                                        <button onClick={startCamera} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-primary-600/30 flex items-center justify-center gap-2 transition active:scale-95 uppercase tracking-wider"><PlayCircle size={24}/> Mulai Kamera</button>
                                        {cameraError && <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg">{cameraError}</div>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Pop-up Verifikasi Telat */}
                        {pendingMember && (
                            <div className="absolute inset-0 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center animate-in zoom-in duration-200">
                                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-full flex items-center justify-center mb-4">
                                    <Clock size={40} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1 uppercase tracking-tighter">Status: Telat</h3>
                                <p className="text-sm text-gray-500 mb-6 leading-tight">Anggota <strong>{pendingMember.full_name}</strong> terdeteksi telat. <br/> Berikan izin telat?</p>
                                
                                <div className="w-full space-y-3">
                                    <button 
                                        onClick={() => executeSave(pendingMember, 'Excused Late')}
                                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition"
                                    >
                                        <CheckCircle2 size={20}/> YA, IZIN TELAT
                                    </button>
                                    <button 
                                        onClick={() => executeSave(pendingMember, 'Present')}
                                        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                                    >
                                        <AlertTriangle size={20}/> TETAP TELAT
                                    </button>
                                    <button 
                                        onClick={() => resetScannerState()}
                                        className="w-full py-2 text-xs text-red-500 font-bold hover:underline"
                                    >
                                        BATALKAN ABSENSI
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Hasil Scan & Button Scan Lagi */}
                        {lastResult && !pendingMember && (
                            <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 ${
                                lastResult.status === 'SUCCESS' ? 'bg-green-500' : 
                                lastResult.status === 'WARNING' ? 'bg-yellow-500' : 'bg-red-600'
                            }`}>
                                <div className="p-4 bg-white/20 rounded-full mb-6 text-white animate-in zoom-in duration-500">
                                    {lastResult.status === 'SUCCESS' ? <CheckCircle2 size={64}/> : 
                                     lastResult.status === 'WARNING' ? <AlertTriangle size={64}/> : <XCircle size={64}/>}
                                </div>
                                <h3 className="text-2xl font-black text-white mb-2 leading-none uppercase tracking-tighter">{lastResult.title}</h3>
                                <p className="text-white/90 text-lg font-bold mb-10 leading-snug">{lastResult.message}</p>
                                
                                <button 
                                    onClick={() => resetScannerState()}
                                    className="w-full max-w-[280px] bg-white text-gray-900 py-4 rounded-2xl font-black shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition hover:bg-gray-50 uppercase tracking-widest"
                                >
                                    <ScanBarcode size={24}/> Scan Lagi
                                </button>
                            </div>
                        )}
                        
                        {scanMode === 'MANUAL' && (
                            <div className="flex-1 p-6 flex flex-col justify-center">
                                <form onSubmit={(e) => { e.preventDefault(); processAttendance(manualInput); }} className="space-y-4">
                                    <input 
                                        type="text" 
                                        value={manualInput} 
                                        onChange={e => setManualInput(e.target.value)} 
                                        className="w-full p-4 text-center text-xl font-bold border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 dark:text-white focus:border-primary-500 outline-none" 
                                        placeholder="Ketik ID / Nama..." 
                                        autoFocus 
                                    />
                                    <button disabled={!manualInput || isProcessing || showNextBtn} className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black shadow-lg disabled:opacity-50 active:scale-95 transition uppercase tracking-widest">
                                        Absen Manual
                                    </button>
                                </form>
                            </div>
                        )}

                        {scanMode === 'LIST' && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="p-4 border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Absensi Sesi: {selectedSessionId}</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {attendance.filter(a => a.event_id === selectedEventId && a.logs?.[selectedSessionId || 'default']).map((att, idx) => {
                                        const m = members.find(mem => mem.id === att.member_id);
                                        const checkTime = att.logs?.[selectedSessionId || 'default'];
                                        return (
                                            <div key={att.id} className="p-3 flex items-center justify-between border-b dark:border-gray-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-xs text-gray-500">{idx + 1}</div>
                                                    <div>
                                                        <p className="text-xs font-bold dark:text-white">{m?.full_name}</p>
                                                        <p className="text-[10px] text-gray-400">{checkTime ? new Date(checkTime).toLocaleTimeString() : '-'}</p>
                                                    </div>
                                                </div>
                                                <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${att.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                    {att.status === 'Present' ? 'Hadir' : 'Izin Telat'}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {attendance.filter(a => a.event_id === selectedEventId && a.logs?.[selectedSessionId || 'default']).length === 0 && (
                                        <div className="p-10 text-center text-gray-400 text-sm italic">Belum ada absensi tercatat.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Recent Logs */}
                    <div className="space-y-2 pt-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><History size={14}/> Riwayat Scan</h3>
                            <button onClick={() => setLogs([])} className="text-[9px] font-bold text-red-500 uppercase hover:underline">Clear</button>
                        </div>
                        {logs.map(log => (
                            <div key={log.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border dark:border-dark-border rounded-xl shadow-sm animate-in fade-in">
                                <div className="flex items-center gap-3">
                                    <div className={`w-1 h-6 rounded-full ${log.status === 'SUCCESS' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                                    <div><p className="text-xs font-bold dark:text-white">{log.memberName}</p><p className="text-[10px] text-gray-500">{log.message}</p></div>
                                </div>
                                <span className="text-[10px] font-mono text-gray-400">{log.time}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    </div>
  );
};
