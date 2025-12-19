import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Event, Member, EventSession, EventAttendance } from '../types';
import { supabase } from '../supabaseClient';
import { 
    ScanBarcode, Keyboard, PlayCircle, CheckCircle2, XCircle, 
    AlertTriangle, Camera, StopCircle, History, ChevronRight, 
    QrCode, RefreshCw, X, List, Users, Clock, Check
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
  
  // States for Late Verification
  const [pendingMember, setPendingMember] = useState<Member | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const startCooldown = () => {
      setCooldown(100);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = setInterval(() => {
          setCooldown(prev => {
              if (prev <= 0) {
                  clearInterval(cooldownTimerRef.current);
                  setIsProcessing(false);
                  setLastResult(null);
                  return 0;
              }
              return prev - 2;
          });
      }, 50);
  };

  const processAttendance = async (memberId: string) => {
      if (!selectedEventId || isProcessing || pendingMember) return;
      setIsProcessing(true);

      const cleanId = memberId.trim();
      const member = members.find(m => m.id === cleanId || m.full_name.toLowerCase() === cleanId.toLowerCase());
      
      if (!member) {
          setLastResult({ status: 'ERROR', title: 'Tidak Dikenal', message: `ID: ${cleanId.substring(0, 10)}...` });
          playFeedbackSound('ERROR');
          setTimeout(() => { setIsProcessing(false); setLastResult(null); }, 2000);
          return;
      }

      // Check Timing
      const now = new Date();
      const eventStartTime = selectedEvent ? new Date(selectedEvent.date) : now;
      const tolerance = selectedEvent?.late_tolerance || 15;
      const lateTime = new Date(eventStartTime.getTime() + tolerance * 60000);
      
      const isLate = now > lateTime;

      // Check existing to prevent duplicates
      const { data: existing } = await supabase.from('event_attendance').select('*').eq('event_id', selectedEventId).eq('member_id', member.id).maybeSingle();
      const targetSessionId = selectedSessionId || 'default';
      if (existing?.logs?.[targetSessionId]) {
          setLastResult({ status: 'WARNING', title: 'Sudah Absen', message: member.full_name });
          playFeedbackSound('ERROR');
          startCooldown();
          return;
      }

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
          
          // Get current logs if any
          const { data: existing } = await supabase.from('event_attendance').select('logs').eq('event_id', selectedEventId).eq('member_id', member.id).maybeSingle();
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
      } catch (err: any) {
          setLastResult({ status: 'ERROR', title: 'Gagal Simpan', message: err.message });
          playFeedbackSound('ERROR');
      } finally {
          setPendingMember(null);
          startCooldown();
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
                    onChange={e => { setSelectedEventId(e.target.value); stopCamera(); }}
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
                                onClick={() => setSelectedSessionId(s.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    selectedSessionId === s.id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-blue-600 border border-blue-100'
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
                        <button onClick={() => { setScanMode('CAMERA'); stopCamera(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${scanMode === 'CAMERA' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}><Camera size={16} className="inline mr-1"/> Kamera</button>
                        <button onClick={() => { setScanMode('MANUAL'); stopCamera(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${scanMode === 'MANUAL' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}><Keyboard size={16} className="inline mr-1"/> Manual</button>
                        <button onClick={() => { setScanMode('LIST'); stopCamera(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${scanMode === 'LIST' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}><List size={16} className="inline mr-1"/> List</button>
                    </div>

                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden relative min-h-[340px] flex flex-col">
                        {scanMode === 'CAMERA' && (
                            <div className="flex-1 flex flex-col">
                                {isCameraActive ? (
                                    <div className="flex flex-col flex-1 relative">
                                        <div id={scanDivId} className="w-full aspect-square bg-black overflow-hidden relative">
                                            {isInitializing && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10"><RefreshCw size={32} className="text-primary-500 animate-spin" /></div>
                                            )}
                                            {isProcessing && !pendingMember && !isInitializing && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[5] animate-in fade-in">
                                                     <div className="w-full max-w-[200px] h-2 bg-gray-700 rounded-full overflow-hidden mb-4">
                                                         <div className="h-full bg-primary-500 transition-all duration-100" style={{ width: `${cooldown}%` }}></div>
                                                     </div>
                                                     <p className="text-white text-xs font-bold uppercase tracking-widest">Memproses...</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 bg-white dark:bg-dark-card border-t dark:border-gray-800">
                                            <button onClick={stopCamera} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95"><StopCircle size={18}/> Matikan Kamera</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                                        <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center text-primary-600 mb-6"><QrCode size={40} /></div>
                                        <button onClick={startCamera} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-primary-600/30 flex items-center justify-center gap-2 transition active:scale-95 uppercase tracking-wider"><PlayCircle size={24}/> Mulai Scan</button>
                                        {cameraError && <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg">{cameraError}</div>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Late Verification Prompt Overlay */}
                        {pendingMember && (
                            <div className="absolute inset-0 z-30 bg-white/95 dark:bg-dark-card/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center animate-in zoom-in duration-200">
                                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-full flex items-center justify-center mb-4">
                                    <Clock size={40} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">Verifikasi Telat</h3>
                                <p className="text-sm text-gray-500 mb-6">Anggota <strong>{pendingMember.full_name}</strong> terdeteksi telat. Pilih status kehadiran:</p>
                                
                                <div className="w-full space-y-3">
                                    <button 
                                        onClick={() => executeSave(pendingMember, 'Excused Late')}
                                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition"
                                    >
                                        <CheckCircle2 size={20}/> Izin Telat (Approved)
                                    </button>
                                    <button 
                                        onClick={() => executeSave(pendingMember, 'Present')}
                                        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                                    >
                                        <AlertTriangle size={20}/> Tetap Telat (Normal)
                                    </button>
                                    <button 
                                        onClick={() => { setPendingMember(null); setIsProcessing(false); }}
                                        className="w-full py-2 text-xs text-red-500 font-bold hover:underline"
                                    >
                                        Batalkan Scan
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {scanMode === 'MANUAL' && (
                            <div className="flex-1 p-6 flex flex-col justify-center">
                                <form onSubmit={(e) => { e.preventDefault(); processAttendance(manualInput); }} className="space-y-4">
                                    <input type="text" value={manualInput} onChange={e => setManualInput(e.target.value)} className="w-full p-4 text-center text-xl font-bold border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 dark:text-white focus:border-primary-500 outline-none" placeholder="Ketik ID / Nama..." autoFocus />
                                    <button disabled={!manualInput || isProcessing} className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black shadow-lg disabled:opacity-50 active:scale-95 transition uppercase">Proses</button>
                                </form>
                            </div>
                        )}

                        {scanMode === 'LIST' && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="p-4 border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Kehadiran Sesi Ini</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {attendance.filter(a => a.event_id === selectedEventId && a.status === 'Present').map((att, idx) => {
                                        const m = members.find(mem => mem.id === att.member_id);
                                        return (
                                            <div key={att.id} className="p-3 flex items-center justify-between border-b dark:border-gray-800">
                                                <div>
                                                    <p className="text-xs font-bold dark:text-white">{m?.full_name}</p>
                                                    <p className="text-[10px] text-gray-500">{new Date(att.check_in_time!).toLocaleTimeString()}</p>
                                                </div>
                                                <CheckCircle2 size={16} className="text-green-500" />
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Result Overlay Card */}
                    {lastResult && !pendingMember && (
                        <div className={`p-6 rounded-2xl border-2 shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden ${
                            lastResult.status === 'SUCCESS' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                            lastResult.status === 'WARNING' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' :
                            'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                        }`}>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className={`p-3 rounded-full shrink-0 ${
                                    lastResult.status === 'SUCCESS' ? 'bg-green-500 text-white' :
                                    lastResult.status === 'WARNING' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
                                }`}>
                                    {lastResult.status === 'SUCCESS' ? <CheckCircle2 size={32}/> : 
                                     lastResult.status === 'WARNING' ? <AlertTriangle size={32}/> : <XCircle size={32}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-80`}>{lastResult.title}</p>
                                    <p className="text-lg font-black text-gray-900 dark:text-white truncate">{lastResult.message}</p>
                                </div>
                            </div>
                            {/* Auto Refresh Progress Bar */}
                            <div className="absolute bottom-0 left-0 h-1 bg-primary-500/30 transition-all duration-100" style={{ width: `${cooldown}%` }}></div>
                        </div>
                    )}

                    {/* Recent Logs */}
                    <div className="space-y-2 pt-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><History size={14}/> Riwayat Scan</h3>
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