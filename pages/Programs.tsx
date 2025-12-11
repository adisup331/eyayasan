
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Program, Division, Organization, Member, Foundation, ReviewItem } from '../types';
import { 
  Plus, Edit, Trash2, Calendar, Briefcase, Wallet, Filter, AlertTriangle, 
  X, Layers, CheckSquare, Square, Building2, ChevronRight, Table, 
  FileSpreadsheet, Maximize2, Minimize2, Search, ZoomIn, ZoomOut,
  Image, ExternalLink, Paperclip, FileText, Printer, BookOpen, Clock, Users, Crown, CheckCircle2, LayoutGrid, ChevronLeft, User,
  PlayCircle, StopCircle, Check, ChevronDown, List, Save, Book, Presentation
} from '../components/ui/Icons';
import { Modal } from '../components/Modal';

interface ProgramsProps {
  data: Program[];
  divisions: Division[];
  organizations: Organization[];
  members: Member[];
  onRefresh: () => void;
  activeFoundation: Foundation | null;
  isSuperAdmin?: boolean; // Added prop
}

type ViewMode = 'table' | 'sheet' | 'document' | 'calendar';

// Helper: Parse Month (Moved outside component for stability)
const parseMonths = (monthStr: string): string[] => {
  try {
    const parsed = JSON.parse(monthStr);
    return Array.isArray(parsed) ? parsed : [monthStr];
  } catch (e) {
    return monthStr ? [monthStr] : [];
  }
};

export const Programs: React.FC<ProgramsProps> = ({ data, divisions, organizations, members, onRefresh, activeFoundation, isSuperAdmin }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Program | null>(null);
  
  // REVIEW / REPORT MODAL STATE
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReviewMaximized, setIsReviewMaximized] = useState(false); // NEW: Maximize State
  const [reviewProgram, setReviewProgram] = useState<Program | null>(null);
  
  // Multi-Review State
  const [currentReviewList, setCurrentReviewList] = useState<ReviewItem[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null); // Null means creating new
  const [isEditingReview, setIsEditingReview] = useState(false); // True if form visible

  // Recap Slideshow State
  const [showRecapMode, setShowRecapMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next'); // Added for animation direction

  // Review Form
  const [reviewDate, setReviewDate] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  
  // Full Screen State (Main Page)
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Sheet Zoom State
  const [zoomLevel, setZoomLevel] = useState(1);

  // Calendar View State
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Description / Evidence Modal
  const [infoModal, setInfoModal] = useState<{isOpen: boolean, data: Program | null, mode: 'DESC' | 'PROOF'}>({ isOpen: false, data: null, mode: 'DESC' });

  // Filter State
  const [filterDivisionId, setFilterDivisionId] = useState('');
  const [filterOrgId, setFilterOrgId] = useState('');
  const [filterYear, setFilterYear] = useState<number | ''>(''); // Default Empty to show all initially
  const [filterMonths, setFilterMonths] = useState<string[]>([]); // Multi select
  const [isMonthPopupOpen, setIsMonthPopupOpen] = useState(false); // New Popup State

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState(''); 
  const [costPerMonth, setCostPerMonth] = useState<number>(0);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  
  // Time Configuration
  const [timeType, setTimeType] = useState<'SPECIFIC' | 'RECURRING' | 'FLEXIBLE' | 'CUSTOM'>('FLEXIBLE');
  const [specificDate, setSpecificDate] = useState(''); 
  const [recurDay, setRecurDay] = useState<number>(1);
  const [recurTime, setRecurTime] = useState('08:00');
  
  // New: Custom Schedule Map (Month Name -> ISO Date String)
  const [customSchedules, setCustomSchedules] = useState<Record<string, string>>({});

  const [divisionId, setDivisionId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [status, setStatus] = useState<'Planned' | 'In Progress' | 'Completed'>('Planned');
  
  // New Attachment States
  const [proofUrl, setProofUrl] = useState('');
  const [docUrl, setDocUrl] = useState('');

  const [loading, setLoading] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const allMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // --- SYNC CALENDAR WITH FILTER ---
  useEffect(() => {
      const newDate = new Date(currentCalendarDate);
      let changed = false;
      if (filterYear && typeof filterYear === 'number' && filterYear !== newDate.getFullYear()) {
          newDate.setFullYear(filterYear);
          changed = true;
      }
      if (filterMonths.length > 0) {
          const monthIndex = allMonths.indexOf(filterMonths[0]);
          if (monthIndex !== -1 && monthIndex !== newDate.getMonth()) {
              newDate.setMonth(monthIndex);
              changed = true;
          }
      }
      if (changed) {
          setCurrentCalendarDate(newDate);
      }
  }, [filterYear, filterMonths]);

  // --- FILTERED DATA ---
  const filteredData = useMemo(() => {
    return data.filter(p => {
        if (filterYear && (p.year || 2024) !== filterYear) return false;
        if (filterDivisionId && p.division_id !== filterDivisionId) return false;
        if (filterOrgId && p.organization_id !== filterOrgId) return false;
        if (filterMonths.length > 0) {
            const pMonths = parseMonths(p.month);
            let specificMonthName = '';
            if (p.date) {
                const d = new Date(p.date);
                specificMonthName = allMonths[d.getMonth()];
            }
            const hasMonth = filterMonths.some(m => pMonths.includes(m) || m === specificMonthName);
            if (!hasMonth) return false;
        }
        return true;
    }).sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA; 
        return a.name.localeCompare(b.name);
    });
  }, [data, filterDivisionId, filterOrgId, filterYear, filterMonths]);

  // --- RECAP SLIDES GENERATION (PER BIDANG ORDERED) ---
  const recapSlides = useMemo(() => {
      const slides: { 
          programName: string; 
          divisionName: string; 
          review: ReviewItem;
          programId: string;
          isPlanned: boolean;
          status: string;
      }[] = [];

      // 1. Sort Divisions by Order Index
      const sortedDivisions = [...divisions].sort((a, b) => (a.order_index || 999) - (b.order_index || 999));

      // 2. Iterate through ordered divisions
      sortedDivisions.forEach(div => {
          // Find programs for this division from the filtered list
          const divPrograms = filteredData.filter(p => p.division_id === div.id);
          
          divPrograms.forEach(prog => {
              let reviews: ReviewItem[] = [];
              if (Array.isArray(prog.review_data)) {
                  reviews = prog.review_data;
              } else if (prog.review_data && typeof prog.review_data === 'object' && Object.keys(prog.review_data).length > 0) {
                  // Legacy support
                  reviews = [{
                      id: 'legacy',
                      date: new Date().toISOString(),
                      title: 'Laporan Kegiatan',
                      content: (prog.review_data as any).content || '',
                      images: (prog.review_data as any).images || []
                  }];
              }

              if (reviews.length > 0) {
                  // Existing Reviews
                  reviews.forEach(r => {
                      slides.push({
                          programName: prog.name,
                          divisionName: div.name,
                          review: r,
                          programId: prog.id,
                          isPlanned: false,
                          status: prog.status
                      });
                  });
              } else {
                  // No Reviews = Planned Slide
                  slides.push({
                      programName: prog.name,
                      divisionName: div.name,
                      review: {
                          id: `plan-${prog.id}`,
                          date: prog.date || new Date().toISOString(),
                          title: 'Program Belum Terlaksana',
                          content: prog.description || 'Belum ada laporan atau catatan kegiatan.',
                          images: []
                      },
                      programId: prog.id,
                      isPlanned: true,
                      status: prog.status
                  });
              }
          });
      });

      return slides;
  }, [filteredData, divisions]);

  // Grouping for Sheet View
  const groupedData = useMemo(() => {
      const groups: { [key: string]: Program[] } = {};
      filteredData.forEach(p => {
          const divId = p.division_id || 'unknown';
          if (!groups[divId]) groups[divId] = [];
          groups[divId].push(p);
      });
      return groups;
  }, [filteredData]);

  // Sorted Division IDs for Sheet View
  const sortedDivisionIds = useMemo(() => {
      return Object.keys(groupedData).sort((a, b) => {
          if (a === 'unknown') return 1;
          if (b === 'unknown') return -1;
          const divA = divisions.find(d => d.id === a);
          const divB = divisions.find(d => d.id === b);
          if (divA?.order_index !== undefined && divB?.order_index !== undefined) {
              return divA.order_index - divB.order_index;
          }
          return (divA?.name || '').localeCompare(divB?.name || '');
      });
  }, [groupedData, divisions]);

  // Calculate Grand Total for Sheet View
  const grandTotalCost = useMemo(() => {
      return filteredData.reduce((acc, p) => {
          const pMonths = parseMonths(p.month);
          // NEW LOGIC: Recurring programs cost calculation
          
          let freq = pMonths.length;
          if (p.date && pMonths.length <= 1) {
              freq = 1;
          }
          if (freq === 0) freq = 1; // Safeguard

          return acc + (p.cost * freq);
      }, 0);
  }, [filteredData]);

  const totalCost = filteredData.reduce((acc, curr) => acc + curr.cost, 0);

  const statusSummary = useMemo(() => {
      return {
          planned: filteredData.filter(p => p.status === 'Planned').length,
          inProgress: filteredData.filter(p => p.status === 'In Progress').length,
          completed: filteredData.filter(p => p.status === 'Completed').length
      };
  }, [filteredData]);

  const getDivisionDetails = (divId: string) => {
      const div = divisions.find(d => d.id === divId);
      if (!div) return null;
      const head = members.find(m => m.id === div.head_member_id);
      const divMembers = members.filter(m => m.division_id === divId);
      return { 
          ...div, 
          headName: head?.full_name || '-', 
          memberCount: divMembers.length,
          members: divMembers 
      };
  };

  // --- RECAP HANDLERS ---
  const handleNextSlide = () => {
      setSlideDirection('next');
      setCurrentSlideIndex(prev => (prev + 1) % recapSlides.length);
  };
  const handlePrevSlide = () => {
      setSlideDirection('prev');
      setCurrentSlideIndex(prev => (prev - 1 + recapSlides.length) % recapSlides.length);
  };

  // Keyboard navigation for slides
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (showRecapMode) {
              if (e.key === 'ArrowRight') handleNextSlide();
              if (e.key === 'ArrowLeft') handlePrevSlide();
              if (e.key === 'Escape') setShowRecapMode(false);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showRecapMode, recapSlides.length]);


  // --- REVIEW HANDLERS ---
  const handleOpenReview = (program: Program) => {
      setReviewProgram(program);
      
      // Handle legacy single object vs new array
      let items: ReviewItem[] = [];
      if (Array.isArray(program.review_data)) {
          items = program.review_data;
      } else if (program.review_data && typeof program.review_data === 'object' && Object.keys(program.review_data).length > 0) {
          // Migration for single object
          items = [{
              id: 'legacy-1',
              date: new Date().toISOString(),
              title: 'Review Awal',
              content: (program.review_data as any).content || '',
              images: (program.review_data as any).images || []
          }];
      }
      
      setCurrentReviewList(items);
      setIsReviewModalOpen(true);
      setIsReviewMaximized(false); // Reset size
      setIsEditingReview(false); // Show list first
      setSelectedReviewId(null);
  };

  const handleCreateReview = () => {
      setSelectedReviewId(null);
      setReviewDate(new Date().toISOString().split('T')[0]);
      setReviewTitle('Laporan Kegiatan');
      setReviewContent('');
      setReviewImages([]);
      setIsEditingReview(true);
  };

  const handleEditReview = (item: ReviewItem) => {
      setSelectedReviewId(item.id);
      setReviewDate(item.date ? new Date(item.date).toISOString().split('T')[0] : '');
      setReviewTitle(item.title);
      setReviewContent(item.content);
      setReviewImages(item.images || []);
      setIsEditingReview(true);
  };

  const handleDeleteReviewItem = async (itemId: string) => {
      if(!confirm("Yakin hapus review ini?")) return;
      if (!reviewProgram) return;

      const updatedList = currentReviewList.filter(r => r.id !== itemId);
      
      setLoading(true);
      try {
          const { error } = await supabase.from('programs').update({ 
              review_data: updatedList,
          }).eq('id', reviewProgram.id);
          
          if(error) throw error;
          
          setCurrentReviewList(updatedList);
          if (isEditingReview && selectedReviewId === itemId) {
              setIsEditingReview(false);
          }
          onRefresh();
          showToast("Review dihapus.", "success");
      } catch (err: any) {
          showToast(err.message, "error");
      } finally {
          setLoading(false);
      }
  }

  const handleAddReviewImage = () => {
      if(newImageUrl) {
          setReviewImages(prev => [...prev, newImageUrl]);
          setNewImageUrl('');
      }
  };

  const handleRemoveReviewImage = (idx: number) => {
      setReviewImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveReview = async () => {
      if (!reviewProgram) return;
      setLoading(true);
      
      const newItem: ReviewItem = {
          id: selectedReviewId || Date.now().toString(),
          date: new Date(reviewDate).toISOString(),
          title: reviewTitle,
          content: reviewContent,
          images: reviewImages
      };

      let updatedList = [...currentReviewList];
      if (selectedReviewId) {
          updatedList = updatedList.map(item => item.id === selectedReviewId ? newItem : item);
      } else {
          updatedList.push(newItem);
      }

      // Sort by date descending
      updatedList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      try {
          const { error } = await supabase.from('programs').update({ 
              review_data: updatedList,
              // Auto set status to Completed/In Progress
              status: reviewProgram.status === 'Planned' ? 'In Progress' : reviewProgram.status
          }).eq('id', reviewProgram.id);
          
          if(error) throw error;
          
          showToast("Laporan kegiatan berhasil disimpan!", "success");
          setCurrentReviewList(updatedList);
          setIsEditingReview(false);
          onRefresh();
      } catch (err: any) {
          showToast(err.message, "error");
      } finally {
          setLoading(false);
      }
  };

  // --- CRUD HANDLERS ---

  const handleOpen = (program?: Program) => {
    if (program) {
      setEditingItem(program);
      setName(program.name);
      setDescription(program.description || '');
      setCostPerMonth(program.cost);
      setDivisionId(program.division_id);
      setOrganizationId(program.organization_id || '');
      setYear(program.year || new Date().getFullYear());
      setStatus(program.status);
      
      const pMonths = parseMonths(program.month);
      setSelectedMonths(pMonths);
      setProofUrl(program.proof_url || '');
      setDocUrl(program.doc_url || '');

      // Check Schedules first (CUSTOM)
      if (program.schedules) {
          setTimeType('CUSTOM');
          let schedulesArray: {month: string, date: string}[] = [];
          try {
              schedulesArray = typeof program.schedules === 'string' ? JSON.parse(program.schedules) : program.schedules;
          } catch(e) { schedulesArray = []; }
          
          const scheduleMap: Record<string, string> = {};
          schedulesArray.forEach(s => scheduleMap[s.month] = s.date);
          setCustomSchedules(scheduleMap);
          setSpecificDate('');
          setRecurDay(1);
      }
      else if (program.date) {
          // Determine Time Type based on Data
          const d = new Date(program.date);
          const hours = d.getHours().toString().padStart(2,'0');
          const minutes = d.getMinutes().toString().padStart(2,'0');
          
          if (pMonths.length > 1) {
              // Date + Multiple Months = Recurring
              setTimeType('RECURRING');
              setRecurDay(d.getDate());
              setRecurTime(`${hours}:${minutes}`);
              setSpecificDate('');
          } else {
              // Date + 1 Month (or 0) = Specific
              setTimeType('SPECIFIC');
              // Format for datetime-local: YYYY-MM-DDTHH:mm
              const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              setSpecificDate(localIso);
          }
          setCustomSchedules({});
      } else {
          setTimeType('FLEXIBLE');
          setSpecificDate('');
          setCustomSchedules({});
      }

    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
      setCostPerMonth(0);
      setDivisionId(divisions[0]?.id || '');
      setOrganizationId(''); 
      setYear(filterYear ? Number(filterYear) : new Date().getFullYear());
      setStatus('Planned');
      setSelectedMonths([]);
      
      setTimeType('FLEXIBLE');
      setSpecificDate('');
      setRecurDay(1);
      setRecurTime('08:00');
      setCustomSchedules({});
      
      setProofUrl('');
      setDocUrl('');
    }
    setIsModalOpen(true);
  };

  const toggleMonth = (month: string) => {
    setSelectedMonths(prev => 
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    );
  };

  const toggleFilterMonth = (month: string) => {
      setFilterMonths(prev => 
        prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
      );
  }

  const updateCustomSchedule = (month: string, val: string) => {
      setCustomSchedules(prev => ({ ...prev, [month]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!activeFoundation && !isSuperAdmin) {
        alert("Konteks Yayasan tidak valid.");
        setLoading(false);
        return;
    }

    const targetFoundationId = activeFoundation?.id || (isSuperAdmin && organizations.find(o => o.id === organizationId)?.foundation_id) || null;

    let finalDate: string | null = null;
    let finalMonths = [...selectedMonths];
    let finalSchedules: any = null;

    // LOGIC: TIME TYPE
    if (timeType === 'SPECIFIC') {
        if (!specificDate) {
            alert("Tanggal spesifik harus diisi");
            setLoading(false);
            return;
        }
        finalDate = new Date(specificDate).toISOString();
        // Ensure month is added
        const d = new Date(specificDate);
        const mName = allMonths[d.getMonth()];
        if (!finalMonths.includes(mName)) finalMonths = [mName];
    } 
    else if (timeType === 'RECURRING') {
        // Construct a dummy date with Day & Time
        const d = new Date();
        d.setFullYear(year);
        d.setMonth(0); // Jan
        d.setDate(recurDay);
        const [hh, mm] = recurTime.split(':');
        d.setHours(Number(hh), Number(mm));
        finalDate = d.toISOString();
        
        if (finalMonths.length === 0) {
            alert("Pilih minimal satu bulan untuk program rutin.");
            setLoading(false);
            return;
        }
    } 
    else if (timeType === 'CUSTOM') {
        if (finalMonths.length === 0) {
            alert("Pilih minimal satu bulan.");
            setLoading(false);
            return;
        }
        
        const scheduleArray: {month: string, date: string}[] = [];
        // Sort months chronologically
        const sortedMonths = finalMonths.sort((a,b) => allMonths.indexOf(a) - allMonths.indexOf(b));
        
        for (const m of sortedMonths) {
            const dateStr = customSchedules[m];
            if (dateStr) {
                scheduleArray.push({ month: m, date: new Date(dateStr).toISOString() });
            }
        }
        
        if (scheduleArray.length > 0) {
            finalSchedules = scheduleArray; // Store as JSON object
            finalDate = scheduleArray[0].date; // Use first date for sorting
        }
    }
    else {
        // FLEXIBLE
        finalDate = null;
    }

    const payload: any = {
      name,
      description,
      cost: costPerMonth,
      month: JSON.stringify(finalMonths),
      year,
      date: finalDate, 
      division_id: divisionId,
      organization_id: organizationId || null,
      status,
      proof_url: proofUrl,
      doc_url: docUrl,
      foundation_id: targetFoundationId,
      schedules: finalSchedules
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from('programs').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('programs').insert([payload]);
        if (error) throw error;
      }
      onRefresh();
      setIsModalOpen(false);
      showToast('Program berhasil disimpan');
    } catch (error: any) {
      showToast('Error: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
      if (!deleteConfirm.id) return;
      try {
          const { error } = await supabase.from('programs').delete().eq('id', deleteConfirm.id);
          if (error) throw error;
          onRefresh();
          setDeleteConfirm({isOpen: false, id: null});
          showToast('Program dihapus');
      } catch (error: any) {
          showToast('Gagal hapus: ' + error.message, 'error');
      }
  }

  const toggleFullScreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen().catch(err => {
              console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          });
          setIsFullScreen(true);
      } else {
          document.exitFullscreen();
          setIsFullScreen(false);
      }
  };

  const getStatusColor = (s: string) => {
      switch(s) {
          case 'In Progress': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'; 
          case 'Completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'; 
          case 'Planned': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'; 
          default: return 'bg-gray-100 text-gray-600 border-gray-200';
      }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  // --- CALENDAR RENDERER ---
  const renderCalendarView = () => {
      const year = currentCalendarDate.getFullYear();
      const month = currentCalendarDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const currentMonthName = allMonths[month];

      const prevMonth = () => setCurrentCalendarDate(new Date(year, month - 1, 1));
      const nextMonth = () => setCurrentCalendarDate(new Date(year, month + 1, 1));

      // Get programs for specific day
      const getProgramsForDay = (day: number) => {
          return filteredData.filter(p => {
              // CHECK CUSTOM SCHEDULES FIRST
              if (p.schedules) {
                  let schedulesArray: {month: string, date: string}[] = [];
                  try { schedulesArray = typeof p.schedules === 'string' ? JSON.parse(p.schedules) : p.schedules; } catch(e){}
                  
                  return schedulesArray.some(s => {
                      const d = new Date(s.date);
                      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
                  });
              }

              if (!p.date) return false;
              const d = new Date(p.date);
              
              // Case 1: Specific Date
              const isSpecific = parseMonths(p.month).length <= 1; 
              if (isSpecific) {
                  return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
              }
              
              // Case 2: Recurring Date
              // Check if day matches AND current month is in selected months
              const months = parseMonths(p.month);
              if (months.includes(currentMonthName) && (p.year || 2024) === year) {
                  return d.getDate() === day;
              }
              return false;
          });
      };

      // Get programs for the whole month (Sidebar List)
      const getProgramsForMonthList = () => {
          return filteredData.filter(p => {
              const pMonths = parseMonths(p.month);
              
              // CUSTOM SCHEDULE
              if (p.schedules) {
                  let schedulesArray: {month: string, date: string}[] = [];
                  try { schedulesArray = typeof p.schedules === 'string' ? JSON.parse(p.schedules) : p.schedules; } catch(e){}
                  return schedulesArray.some(s => {
                      const d = new Date(s.date);
                      return d.getMonth() === month && d.getFullYear() === year;
                  });
              }

              // Check specific date month
              if (p.date && pMonths.length <= 1) {
                  const d = new Date(p.date);
                  return d.getMonth() === month && d.getFullYear() === year;
              }
              // Check month array
              return pMonths.includes(currentMonthName) && (p.year || 2024) === year;
          });
      };

      const monthPrograms = getProgramsForMonthList();

      const days = [];
      for (let i = 0; i < firstDay; i++) {
          days.push(<div key={`empty-${i}`} className="h-24 md:h-32 bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800"></div>);
      }
      for (let d = 1; d <= daysInMonth; d++) {
          const dayPrograms = getProgramsForDay(d);
          days.push(
              <div key={d} className="h-24 md:h-32 border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 relative hover:bg-gray-50 dark:hover:bg-gray-700 transition group overflow-y-auto">
                  <span className="absolute top-1 left-2 text-xs font-bold text-gray-400 group-hover:text-primary-500">{d}</span>
                  <div className="mt-4 space-y-1">
                      {dayPrograms.map(p => (
                          <div 
                            key={p.id} 
                            onClick={() => handleOpen(p)}
                            className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 border-l-2 border-blue-500"
                            title={p.name}
                          >
                              {p.name}
                          </div>
                      ))}
                  </div>
              </div>
          );
      }

      return (
          <div className="flex flex-col lg:flex-row h-full gap-4">
              {/* Calendar Grid */}
              <div className="flex-1 bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden flex flex-col">
                  <div className="p-4 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-bold text-lg text-gray-800 dark:text-white capitalize">
                          {currentCalendarDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                      </h3>
                      <div className="flex gap-2">
                          <button onClick={prevMonth} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ChevronLeft size={20}/></button>
                          <button onClick={() => setCurrentCalendarDate(new Date())} className="text-xs font-bold px-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">Today</button>
                          <button onClick={nextMonth} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ChevronRight size={20}/></button>
                      </div>
                  </div>
                  <div className="grid grid-cols-7 text-center text-xs font-bold text-gray-500 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <div>Min</div><div>Sen</div><div>Sel</div><div>Rab</div><div>Kam</div><div>Jum</div><div>Sab</div>
                  </div>
                  <div className="grid grid-cols-7 flex-1 overflow-y-auto">
                      {days}
                  </div>
              </div>

              {/* Sidebar List (Programs in this month) */}
              <div className="w-full lg:w-80 bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border flex flex-col max-h-[600px] lg:h-auto">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 font-bold text-sm text-gray-700 dark:text-gray-200 flex justify-between items-center">
                      <span>Program Bulan Ini</span>
                      <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">{monthPrograms.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {monthPrograms.length === 0 ? (
                          <p className="text-center text-xs text-gray-400 py-8">Tidak ada program.</p>
                      ) : (
                          monthPrograms.map(p => (
                              <div key={p.id} onClick={() => handleOpen(p)} className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer group">
                                  <div className="flex justify-between items-start mb-1">
                                      <span className="font-semibold text-sm text-gray-800 dark:text-white line-clamp-1">{p.name}</span>
                                      {p.date && <span className="text-[10px] text-gray-500 font-mono bg-gray-100 dark:bg-gray-900 px-1 rounded">{new Date(p.date).getDate()}</span>}
                                  </div>
                                  <p className="text-xs text-gray-500 mb-1">{divisions.find(d=>d.id===p.division_id)?.name}</p>
                                  <div className="flex justify-between items-center">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusColor(p.status)}`}>{p.status}</span>
                                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{formatCurrency(p.cost)}</span>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      );
  };

  // --- RECAP SLIDESHOW RENDERER (ENHANCED) ---
  const renderRecapOverlay = () => {
      if (!showRecapMode || recapSlides.length === 0) return null;
      
      const currentSlide = recapSlides[currentSlideIndex];
      const hasImage = currentSlide.review.images && currentSlide.review.images.length > 0;
      
      // Fallback images depending on status
      const placeholderImage = currentSlide.isPlanned 
          ? 'https://via.placeholder.com/1200x800?text=Program+Belum+Terlaksana&font=roboto' 
          : 'https://via.placeholder.com/1200x800?text=No+Image+Available';
          
      const mainImage = hasImage ? currentSlide.review.images[0] : placeholderImage;

      return (
          <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col overflow-hidden">
              <style>{`
                  @keyframes slideInRight {
                      from { transform: translateX(100%); opacity: 0; }
                      to { transform: translateX(0); opacity: 1; }
                  }
                  @keyframes slideInLeft {
                      from { transform: translateX(-100%); opacity: 0; }
                      to { transform: translateX(0); opacity: 1; }
                  }
                  @keyframes fadeIn {
                      from { opacity: 0; }
                      to { opacity: 1; }
                  }
                  @keyframes scaleUp {
                      from { transform: scale(1); }
                      to { transform: scale(1.1); }
                  }
                  .animate-slide-in-right { animation: slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                  .animate-slide-in-left { animation: slideInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                  .animate-fade-in { animation: fadeIn 0.8s ease-in forwards; }
                  .animate-ken-burns { animation: scaleUp 20s linear infinite alternate; }
                  .glass-panel { background: rgba(20, 20, 30, 0.7); backdrop-filter: blur(20px); border-left: 1px solid rgba(255,255,255,0.1); }
              `}</style>

              {/* Progress Bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-white/20 z-20">
                  <div 
                      className="h-full bg-primary-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.8)]" 
                      style={{ width: `${((currentSlideIndex + 1) / recapSlides.length) * 100}%` }}
                  ></div>
              </div>

              {/* Header Overlay */}
              <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
                  <div className="flex items-center gap-4 animate-fade-in">
                      <div className="bg-primary-600 p-2.5 rounded-xl shadow-lg shadow-primary-900/50"><Presentation size={24} className="text-white"/></div>
                      <div>
                          <h2 className="text-xl font-bold leading-none tracking-tight text-white">{activeFoundation?.name}</h2>
                          <p className="text-sm text-gray-300 font-medium tracking-wide opacity-80 mt-1">Laporan Kegiatan & Evaluasi</p>
                      </div>
                  </div>
                  <div className="flex gap-4 items-center">
                      <div className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 text-sm font-mono text-gray-300">
                          {currentSlideIndex + 1} <span className="opacity-50 mx-1">/</span> {recapSlides.length}
                      </div>
                      <button onClick={() => setShowRecapMode(false)} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition text-white hover:rotate-90 duration-300 backdrop-blur">
                          <X size={24}/>
                      </button>
                  </div>
              </div>

              {/* Main Content Area (Split) */}
              <div key={currentSlideIndex} className={`flex-1 flex flex-col md:flex-row h-full w-full relative overflow-hidden ${slideDirection === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
                  
                  {/* Background Image Layer (Full Coverage) */}
                  <div className="absolute inset-0 z-0">
                        <img 
                          src={mainImage} 
                          className="w-full h-full object-cover opacity-40 blur-3xl scale-110"
                          alt="bg-blur"
                        />
                        <div className="absolute inset-0 bg-black/60"></div>
                  </div>

                  {/* Left: Focused Image (70%) */}
                  <div className="flex-[2] relative z-10 flex items-center justify-center p-8 md:p-16 overflow-hidden">
                      <div className="relative w-full h-full max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 group flex items-center justify-center bg-black/50">
                          {hasImage ? (
                              <img 
                                  src={mainImage} 
                                  alt="Review" 
                                  className="w-full h-full object-contain animate-ken-burns"
                              />
                          ) : (
                              <div className="text-center p-10 animate-fade-in">
                                  <div className="bg-white/10 p-6 rounded-full inline-block mb-4 backdrop-blur-sm border border-white/10">
                                      {currentSlide.isPlanned ? <Calendar size={64} className="text-white/80"/> : <Image size={64} className="text-white/50"/>}
                                  </div>
                                  <h2 className="text-2xl font-bold text-white/90">{currentSlide.isPlanned ? "Program Belum Terlaksana" : "Tidak Ada Dokumentasi"}</h2>
                                  <p className="text-white/60 mt-2">Gambar belum tersedia untuk laporan ini.</p>
                              </div>
                          )}
                          
                          {/* Navigation Buttons (Overlay on Image Area) */}
                          <div className="absolute inset-0 flex justify-between items-center px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                              <button onClick={handlePrevSlide} className="p-4 bg-black/50 hover:bg-white/10 hover:backdrop-blur-md rounded-full text-white/80 hover:text-white transition transform hover:scale-110 pointer-events-auto">
                                  <ChevronLeft size={40}/>
                              </button>
                              <button onClick={handleNextSlide} className="p-4 bg-black/50 hover:bg-white/10 hover:backdrop-blur-md rounded-full text-white/80 hover:text-white transition transform hover:scale-110 pointer-events-auto">
                                  <ChevronRight size={40}/>
                              </button>
                          </div>
                      </div>
                  </div>

                  {/* Right: Text Content (30%) - Glassmorphism Panel */}
                  <div className="flex-1 glass-panel text-white relative z-20 flex flex-col h-full shadow-2xl">
                      <div className="flex-1 flex flex-col justify-center p-10 md:p-12 space-y-8 overflow-y-auto custom-scrollbar">
                          
                          {/* Meta Tags */}
                          <div className="flex flex-wrap gap-2 animate-fade-in" style={{animationDelay: '0.1s'}}>
                              <span className="px-3 py-1 bg-primary-500/80 backdrop-blur text-white text-xs font-bold rounded-md uppercase tracking-wider shadow-lg shadow-primary-900/20 border border-primary-400/30">
                                  {currentSlide.divisionName}
                              </span>
                              <span className={`px-3 py-1 text-xs font-bold rounded-md border backdrop-blur flex items-center gap-2 ${
                                  currentSlide.isPlanned 
                                  ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200' 
                                  : 'bg-green-500/20 border-green-500/30 text-green-200'
                              }`}>
                                  {currentSlide.isPlanned ? <Clock size={12}/> : <CheckCircle2 size={12}/>}
                                  {currentSlide.isPlanned ? 'Belum Terlaksana' : 'Selesai'}
                              </span>
                              <span className="px-3 py-1 bg-white/10 backdrop-blur text-gray-200 text-xs font-bold rounded-md border border-white/10 flex items-center gap-2">
                                  <Calendar size={12}/> {new Date(currentSlide.review.date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}
                              </span>
                          </div>

                          {/* Title & Program Name */}
                          <div className="animate-fade-in space-y-2" style={{animationDelay: '0.2s'}}>
                              <h1 className="text-3xl md:text-4xl font-bold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                                  {currentSlide.programName}
                              </h1>
                              <h3 className={`text-lg font-medium border-l-4 pl-4 py-1 ${currentSlide.isPlanned ? 'text-yellow-100 border-yellow-500' : 'text-primary-100 border-primary-500'}`}>
                                  {currentSlide.review.title}
                              </h3>
                          </div>

                          {/* Description */}
                          <div className="animate-fade-in" style={{animationDelay: '0.3s'}}>
                              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-base font-light border-t border-white/10 pt-6">
                                  {currentSlide.review.content || "Tidak ada deskripsi laporan tertulis untuk kegiatan ini."}
                              </p>
                          </div>

                          {/* Gallery Thumbnails */}
                          {currentSlide.review.images && currentSlide.review.images.length > 1 && (
                              <div className="animate-fade-in mt-auto pt-6" style={{animationDelay: '0.4s'}}>
                                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">Dokumentasi Lainnya</p>
                                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                      {currentSlide.review.images.slice(1).map((img, idx) => (
                                          <div key={idx} className="relative group cursor-pointer w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-white/10 hover:border-primary-500 transition-colors">
                                              <img src={img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="thumb"/>
                                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                      
                      {/* Footer Info */}
                      <div className="p-6 border-t border-white/10 text-center bg-black/20 backdrop-blur-sm">
                          <p className="text-xs text-gray-500 font-mono">ID: {currentSlide.programId.split('-')[0]}</p>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div ref={containerRef} className={`flex flex-col space-y-4 transition-all duration-300 ${isFullScreen ? 'bg-gray-50 dark:bg-dark-bg p-6 overflow-y-auto' : ''}`}>
      
      {/* RENDER RECAP OVERLAY */}
      {renderRecapOverlay()}

      {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="text-sm font-medium">{toast.message}</span>
          </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Briefcase className="text-primary-600 dark:text-primary-400" /> Program Kerja & Anggaran
            </h2>
            <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <span className="bg-white dark:bg-gray-800 px-2 py-1 rounded border dark:border-gray-700 shadow-sm">
                    Total: <strong>{filteredData.length}</strong> Program
                </span>
            </div>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
            {/* View Switcher */}
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center">
                <button onClick={() => setViewMode('table')} className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-white dark:bg-dark-card shadow text-primary-600' : 'text-gray-500'}`} title="Tabel"><Table size={18}/></button>
                <button onClick={() => setViewMode('sheet')} className={`p-2 rounded-md ${viewMode === 'sheet' ? 'bg-white dark:bg-dark-card shadow text-primary-600' : 'text-gray-500'}`} title="Sheet (Matrix)"><FileSpreadsheet size={18}/></button>
                <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-md ${viewMode === 'calendar' ? 'bg-white dark:bg-dark-card shadow text-primary-600' : 'text-gray-500'}`} title="Kalender"><Calendar size={18}/></button>
                <button onClick={() => setViewMode('document')} className={`p-2 rounded-md ${viewMode === 'document' ? 'bg-white dark:bg-dark-card shadow text-primary-600' : 'text-gray-500'}`} title="Dokumen"><FileText size={18}/></button>
            </div>

            <div className="h-8 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

            {/* Recap Presentation Button */}
            <button 
                onClick={() => { 
                    if(recapSlides.length > 0) setShowRecapMode(true); 
                    else alert("Belum ada laporan kegiatan untuk ditampilkan."); 
                }} 
                className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg transition shadow-sm border border-indigo-100 dark:border-indigo-800" 
                title="Mode Presentasi / Recap"
            >
                <Presentation size={20} />
            </button>

            <button onClick={toggleFullScreen} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition" title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}>
                {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>

            {!isSuperAdmin && (
                <button
                onClick={() => handleOpen()}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm font-medium shadow-sm"
                >
                <Plus size={18} /> Tambah Program
                </button>
            )}
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col md:flex-row gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium">
              <Filter size={16} /> Filter:
          </div>
          
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value) || '')} className="px-3 py-1.5 text-sm border rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none">
              <option value="">Semua Tahun</option>
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              <option value={new Date().getFullYear()+1}>{new Date().getFullYear()+1}</option>
          </select>

          <select value={filterDivisionId} onChange={(e) => setFilterDivisionId(e.target.value)} className="px-3 py-1.5 text-sm border rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none">
              <option value="">Semua Bidang</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select value={filterOrgId} onChange={(e) => setFilterOrgId(e.target.value)} className="px-3 py-1.5 text-sm border rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none max-w-[200px]">
              <option value="">Semua Organisasi</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>

          {/* Month Popup Filter */}
          <div className="relative">
              <button 
                onClick={() => setIsMonthPopupOpen(!isMonthPopupOpen)}
                className={`px-3 py-1.5 text-sm border rounded-lg flex items-center gap-2 transition ${isMonthPopupOpen ? 'bg-primary-50 border-primary-500 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700'}`}
              >
                  <Calendar size={14} /> 
                  <span>Filter Bulan {filterMonths.length > 0 && `(${filterMonths.length})`}</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isMonthPopupOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isMonthPopupOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsMonthPopupOpen(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-2xl z-20 p-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-sm text-gray-800 dark:text-white">Pilih Bulan</h4>
                            <div className="flex gap-2">
                                {filterMonths.length > 0 && (
                                    <button 
                                        onClick={() => setFilterMonths([])} 
                                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                                    >
                                        Reset
                                    </button>
                                )}
                                <button onClick={() => setIsMonthPopupOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                    <X size={16}/>
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                            {allMonths.map(m => (
                                <button 
                                    key={m}
                                    onClick={() => toggleFilterMonth(m)}
                                    className={`text-xs py-1.5 rounded transition ${
                                        filterMonths.includes(m) 
                                        ? 'bg-primary-600 text-white font-medium shadow-md' 
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {m.substring(0,3)}
                                </button>
                            ))}
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                            <button 
                                onClick={() => setIsMonthPopupOpen(false)} 
                                className="w-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs py-1.5 rounded font-medium hover:bg-primary-100 dark:hover:bg-primary-900/50 transition"
                            >
                                Terapkan Filter
                            </button>
                        </div>
                    </div>
                  </>
              )}
          </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className={`flex-1 overflow-hidden bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-dark-border shadow-sm ${viewMode === 'calendar' ? 'p-0 border-0 shadow-none bg-transparent' : 'relative'}`}>
          
          {/* VIEW: TABLE */}
          {viewMode === 'table' && (
              <div className="overflow-x-auto h-full flex flex-col">
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Program & Bidang</th>
                                <th className="px-6 py-4">Waktu</th>
                                <th className="px-6 py-4 text-right">Biaya</th>
                                <th className="px-6 py-4">Status & Bukti</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                            {filteredData.map(item => {
                                const divDetails = getDivisionDetails(item.division_id);
                                return (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition group">
                                    <td className="px-6 py-4 align-top">
                                        <div className="font-medium text-gray-900 dark:text-white text-base">{item.name}</div>
                                        
                                        {/* Division & Head Info */}
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                                            <div className="flex items-center gap-1.5">
                                                <Layers size={12} className="text-blue-500"/>
                                                <span className="font-semibold text-gray-700 dark:text-gray-300">{divDetails?.name || '-'}</span>
                                            </div>
                                            {divDetails && (
                                                <div className="pl-2 ml-1 border-l-2 border-gray-200 dark:border-gray-700 space-y-1">
                                                    <span className="flex items-center gap-1" title="Kepala Bidang">
                                                        <User size={10} className="text-gray-400"/> Kepala: {divDetails.headName}
                                                    </span>
                                                    
                                                    {/* SHOW ALL MEMBERS */}
                                                    <div className="mt-1">
                                                        <span className="flex items-center gap-1 font-semibold text-gray-600 dark:text-gray-300" title="Daftar Anggota">
                                                            <Users size={10} className="text-gray-400"/> Anggota ({divDetails.memberCount}):
                                                        </span>
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {divDetails.members && divDetails.members.length > 0 ? (
                                                                divDetails.members.map((m, idx) => (
                                                                    <span key={m.id} className="text-[10px] text-gray-500 dark:text-gray-400">
                                                                        {m.full_name}{idx < divDetails.members.length - 1 ? ',' : ''}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400 italic">Belum ada anggota</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {item.organizations && <div className="flex items-center gap-1 mt-1"><Building2 size={10} className="text-gray-400"/> {item.organizations.name}</div>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300 align-top">
                                        <div className="font-bold">{item.year}</div>
                                        <div className="max-w-[200px]" title={parseMonths(item.month).join(', ')}>
                                            {item.schedules ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px] uppercase tracking-wider">Detail Jadwal:</span>
                                                    {(() => {
                                                        try {
                                                            const s = typeof item.schedules === 'string' ? JSON.parse(item.schedules) : item.schedules;
                                                            return s.slice(0, 3).map((sch: any, idx: number) => (
                                                                <div key={idx} className="flex gap-1 items-center bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded text-[10px]">
                                                                    <Calendar size={10} className="text-indigo-500"/>
                                                                    <span>{new Date(sch.date).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit'})}</span>
                                                                </div>
                                                            ))
                                                        } catch(e) { return '-'; }
                                                    })()}
                                                    {(typeof item.schedules === 'object' ? item.schedules : []).length > 3 && (
                                                        <span className="text-[10px] text-gray-400">+ ... lainnya</span>
                                                    )}
                                                </div>
                                            ) : item.date ? (
                                                <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-300 px-1.5 rounded w-fit">
                                                    <Calendar size={10}/> 
                                                    {parseMonths(item.month).length > 1 ? `Tgl ${new Date(item.date).getDate()} (Rutin)` : new Date(item.date).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="italic text-gray-500">{parseMonths(item.month).join(', ') || 'Semua Bulan'}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-800 dark:text-white text-right font-mono align-top">
                                        {formatCurrency(item.cost)}
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(item.status)}`}>
                                                {item.status === 'Planned' ? 'Rencana (Belum)' : item.status === 'In Progress' ? 'Berjalan' : 'Selesai'}
                                            </span>
                                            <div className="flex gap-2 mt-1">
                                                {item.proof_url && (
                                                    <button onClick={() => setInfoModal({isOpen: true, data: item, mode: 'PROOF'})} className="text-gray-400 hover:text-blue-500" title="Lihat Bukti Foto">
                                                        <Image size={14}/>
                                                    </button>
                                                )}
                                                {item.doc_url && (
                                                    <a href={item.doc_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500" title="Link Dokumen">
                                                        <ExternalLink size={14}/>
                                                    </a>
                                                )}
                                                {item.description && (
                                                    <button onClick={() => setInfoModal({isOpen: true, data: item, mode: 'DESC'})} className="text-gray-400 hover:text-blue-500" title="Deskripsi">
                                                        <FileText size={14}/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right align-top">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* NEW: Review Button */}
                                            <button onClick={() => handleOpenReview(item)} className="text-gray-400 hover:text-green-600 dark:hover:text-green-400" title="Buat Review / Laporan">
                                                <FileText size={18}/>
                                            </button>

                                            {!isSuperAdmin && (
                                                <>
                                                    <button onClick={() => handleOpen(item)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"><Edit size={18}/></button>
                                                    <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id})} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={18}/></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )})}
                            {filteredData.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Tidak ada program kerja.</td></tr>
                            )}
                        </tbody>
                    </table>
                  </div>
                  
                  {/* TABLE FOOTER FOR TOTAL & SUMMARY */}
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                      {/* Status Summary */}
                      <div className="flex items-center gap-4 text-xs font-bold">
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                              <PlayCircle size={12}/> Berjalan: {statusSummary.inProgress}
                          </span>
                          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">
                              <Clock size={12}/> Belum: {statusSummary.planned}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">
                              <Check size={12}/> Selesai: {statusSummary.completed}
                          </span>
                      </div>

                      <div className="flex items-center gap-6">
                          <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Total Anggaran:</span>
                          <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalCost)}</span>
                      </div>
                  </div>
              </div>
          )}

          {/* VIEW: SHEET (MATRIX) - REDESIGNED */}
          {viewMode === 'sheet' && (
              <div className="overflow-auto h-full bg-white dark:bg-dark-card rounded-lg shadow-sm">
                  {/* Zoom Controls */}
                  <div className="sticky top-0 left-0 z-20 flex justify-end items-center p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 gap-2">
                      <button onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ZoomOut size={16}/></button>
                      <span className="text-xs font-mono py-1">{Math.round(zoomLevel * 100)}%</span>
                      <button onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ZoomIn size={16}/></button>
                  </div>

                  <div style={{ fontSize: `${zoomLevel * 0.75}rem`, minWidth: '100%' }} className="p-2">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 text-xs">
                          <thead className="sticky top-10 z-10 text-white bg-emerald-600 dark:bg-emerald-800 font-bold uppercase shadow-md">
                              <tr>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-10 text-center">No</th>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-32 text-left">Bidang</th>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-48 text-left">Personil</th>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-10 text-center">No</th>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-64 text-left">Kegiatan</th>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-10 text-center">Bukti</th>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-32 text-left">Keterangan</th>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-28 text-right">Biaya</th>
                                  {/* Months 1-12 */}
                                  {Array.from({length: 12}).map((_, i) => (
                                      <th key={i} className="border border-emerald-700 dark:border-emerald-900 px-1 py-3 w-8 text-center">{i + 1}</th>
                                  ))}
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-12 text-center">JML</th>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-32 text-right">Total Biaya</th>
                                  <th className="border border-emerald-700 dark:border-emerald-900 px-2 py-3 w-16 text-center">Aksi</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-dark-card text-gray-800 dark:text-gray-200">
                              {sortedDivisionIds.map((divId, divIndex) => {
                                  const divPrograms = groupedData[divId];
                                  const divDetails = getDivisionDetails(divId);
                                  const divName = divDetails?.name || (divId === 'unknown' ? 'Lain-lain' : '-');
                                  const personnelList = divDetails?.members?.map(m => m.full_name).join(', ') || '-';
                                  
                                  return (
                                      <React.Fragment key={divId}>
                                          {divPrograms.map((item, progIndex) => {
                                              const itemMonths = parseMonths(item.month);
                                              const isFirstRow = progIndex === 0;
                                              const rowCount = divPrograms.length;
                                              
                                              // Frequency Logic for Sheet View
                                              let freq = 0;
                                              let specificDay = '';
                                              const hasDate = !!item.date;
                                              const monthCount = itemMonths.length;
                                              let isRecurring = false;
                                              let isCustom = !!item.schedules;
                                              let specificMonthIdx = -1;
                                              let customMap: Record<string, string> = {};

                                              if (isCustom) {
                                                  // Parse schedules to map
                                                  try {
                                                      const sArray: any[] = typeof item.schedules === 'string' ? JSON.parse(item.schedules) : item.schedules;
                                                      sArray.forEach(s => {
                                                          customMap[s.month] = new Date(s.date).getDate().toString();
                                                      });
                                                      freq = sArray.length;
                                                  } catch(e) {}
                                              }
                                              else if (hasDate) {
                                                  const d = new Date(item.date);
                                                  specificDay = d.getDate().toString();
                                                  
                                                  // If date exists AND multiple months -> Recurring
                                                  if (monthCount > 1) {
                                                      freq = monthCount;
                                                      isRecurring = true;
                                                  } else {
                                                      // Specific Date (One Time)
                                                      freq = 1;
                                                      specificMonthIdx = d.getMonth();
                                                  }
                                              } else {
                                                  // Flexible
                                                  freq = monthCount;
                                              }
                                              
                                              const itemTotalCost = item.cost * (freq || 1);

                                              return (
                                                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                      {/* Merged Columns for Division Info */}
                                                      {isFirstRow && (
                                                          <>
                                                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center font-bold bg-gray-50 dark:bg-gray-800 align-top" rowSpan={rowCount}>{divIndex + 1}</td>
                                                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 font-bold bg-gray-50 dark:bg-gray-800 align-top" rowSpan={rowCount}>{divName}</td>
                                                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-[10px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 align-top uppercase leading-relaxed" rowSpan={rowCount}>{personnelList}</td>
                                                          </>
                                                      )}
                                                      
                                                      {/* Program Columns */}
                                                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">{progIndex + 1}</td>
                                                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                                          <div className="font-medium text-gray-900 dark:text-white truncate" title={item.name}>{item.name}</div>
                                                          {item.status !== 'Planned' && (
                                                              <span className={`text-[9px] px-1 rounded ${item.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{item.status}</span>
                                                          )}
                                                      </td>
                                                      <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">
                                                          {item.proof_url ? (
                                                              <a href={item.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800"><Image size={14}/></a>
                                                          ) : '-'}
                                                      </td>
                                                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 truncate max-w-[150px]" title={item.description}>{item.description}</td>
                                                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-mono">{formatCurrency(item.cost)}</td>
                                                      
                                                      {/* Month Grid */}
                                                      {allMonths.map((m, i) => {
                                                          let cellContent = '';
                                                          let isActive = false;

                                                          if (isCustom) {
                                                              if (customMap[m]) {
                                                                  isActive = true;
                                                                  cellContent = customMap[m];
                                                              }
                                                          } else if (isRecurring) {
                                                              // Recurring: Check if month is in list, show Day
                                                              if (itemMonths.includes(m)) {
                                                                  isActive = true;
                                                                  cellContent = specificDay;
                                                              }
                                                          } else if (hasDate) {
                                                              // Specific: Check exact month index, show Day
                                                              if (i === specificMonthIdx) {
                                                                  isActive = true;
                                                                  cellContent = specificDay;
                                                              }
                                                          } else {
                                                              // Flexible: Check month list, show X
                                                              if (itemMonths.includes(m)) {
                                                                  isActive = true;
                                                                  cellContent = 'X';
                                                              }
                                                          }
                                                          
                                                          return (
                                                              <td key={i} className={`border border-gray-300 dark:border-gray-600 p-0 text-center text-[10px] font-bold ${isActive ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
                                                                  {cellContent}
                                                              </td>
                                                          )
                                                      })}
                                                      
                                                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center font-bold">{freq}</td>
                                                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-right font-bold font-mono">{formatCurrency(itemTotalCost)}</td>
                                                      
                                                      <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">
                                                          <div className="flex justify-center gap-1">
                                                              <button onClick={() => handleOpenReview(item)} className="text-gray-400 hover:text-green-600 dark:hover:text-green-400"><FileText size={14}/></button>
                                                              <button onClick={() => handleOpen(item)} className="text-blue-500 hover:text-blue-700"><Edit size={14}/></button>
                                                              <button onClick={() => setDeleteConfirm({isOpen: true, id: item.id})} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                                          </div>
                                                      </td>
                                                  </tr>
                                              )
                                          })}
                                      </React.Fragment>
                                  )
                              })}
                              {/* GRAND TOTAL ROW */}
                              <tr className="bg-emerald-50 dark:bg-emerald-900/20 font-bold border-t-2 border-gray-400">
                                  <td colSpan={20} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right">
                                      TOTAL ANGGARAN KESELURUHAN: <span className="text-lg ml-2 text-emerald-800 dark:text-emerald-400">{formatCurrency(grandTotalCost)}</span>
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-600"></td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {/* VIEW: CALENDAR */}
          {viewMode === 'calendar' && renderCalendarView()}

          {/* VIEW: DOCUMENT (PRINT FRIENDLY) */}
          {viewMode === 'document' && (
              <div className="p-8 bg-gray-100 overflow-y-auto h-full flex justify-center">
                  <div className="bg-white shadow-lg w-full max-w-[21cm] min-h-[29.7cm] p-[2cm] text-black">
                      <div className="text-center mb-8 border-b-2 border-black pb-4">
                          <h1 className="text-xl font-bold uppercase mb-1">{activeFoundation?.name || 'YAYASAN'}</h1>
                          <h2 className="text-lg">PROGRAM KERJA TAHUN {filterYear || new Date().getFullYear()}</h2>
                      </div>
                      
                      {divisions.map(div => {
                          const divPrograms = filteredData.filter(p => p.division_id === div.id);
                          if (divPrograms.length === 0) return null;
                          const divTotal = divPrograms.reduce((a,b) => {
                              // Re-calc cost for total
                              let freq = parseMonths(b.month).length;
                              if (b.date && freq <= 1) freq = 1;
                              if (b.schedules) {
                                  try { freq = (typeof b.schedules === 'string' ? JSON.parse(b.schedules) : b.schedules).length; } catch(e){}
                              }
                              if (freq === 0) freq = 1;
                              return a + (b.cost * freq);
                          }, 0);
                          const divDetails = getDivisionDetails(div.id);

                          return (
                              <div key={div.id} className="mb-6 break-inside-avoid">
                                  <div className="flex justify-between items-end border-b border-black pb-1 mb-2">
                                      <div>
                                          <h3 className="font-bold text-sm uppercase">BIDANG: {div.name}</h3>
                                          <p className="text-[10px] italic">Kepala: {divDetails?.headName} | {divDetails?.memberCount} Anggota</p>
                                      </div>
                                      <span className="font-bold text-sm">Total: {formatCurrency(divTotal)}</span>
                                  </div>
                                  
                                  <table className="w-full text-xs border-collapse border border-black mb-2">
                                      <thead>
                                          <tr className="bg-gray-100">
                                              <th className="border border-black p-1 w-8 text-center">No</th>
                                              <th className="border border-black p-1">Nama Program</th>
                                              <th className="border border-black p-1 w-24">Waktu</th>
                                              <th className="border border-black p-1 w-24 text-right">Anggaran</th>
                                              <th className="border border-black p-1 w-20 text-center">Status</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {divPrograms.map((p, idx) => (
                                              <tr key={p.id}>
                                                  <td className="border border-black p-1 text-center">{idx + 1}</td>
                                                  <td className="border border-black p-1">
                                                      {p.name}
                                                      {p.description && <div className="text-[10px] italic text-gray-600">{p.description}</div>}
                                                  </td>
                                                  <td className="border border-black p-1 text-center">
                                                      {p.schedules ? 'Jadwal Detail' : p.date ? new Date(p.date).toLocaleDateString() : parseMonths(p.month).join(', ')}
                                                  </td>
                                                  <td className="border border-black p-1 text-right">{formatCurrency(p.cost)}</td>
                                                  <td className="border border-black p-1 text-center">{p.status}</td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          )
                      })}

                      <div className="mt-8 pt-4 border-t-2 border-black flex justify-between font-bold">
                          <span>TOTAL ANGGARAN SELURUHNYA</span>
                          <span>{formatCurrency(grandTotalCost)}</span>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* --- MODAL FORM --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Program' : 'Tambah Program Kerja'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Program</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Contoh: Pengajian Akbar"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bidang</label>
                <select
                    required
                    value={divisionId}
                    onChange={e => setDivisionId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                    <option value="">Pilih Bidang</option>
                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tahun</label>
                <input
                    type="number"
                    value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organisasi (Opsional)</label>
            <select
                value={organizationId}
                onChange={e => setOrganizationId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
                <option value="">-- Umum / Semua --</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Biaya (Satuan/Per Bulan)</label>
                <div className="relative mt-1">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">Rp</span>
                    <input
                        type="number"
                        min="0"
                        value={costPerMonth}
                        onChange={e => setCostPerMonth(Number(e.target.value))}
                        className="block w-full pl-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                    <option value="Planned">Planned (Belum)</option>
                    <option value="In Progress">In Progress (Berjalan)</option>
                    <option value="Completed">Completed (Selesai)</option>
                </select>
              </div>
          </div>

          {/* DATE & MONTH SELECTION (UPDATED) */}
          <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Calendar size={16}/> Waktu Pelaksanaan
              </label>
              
              <div className="flex gap-2 mb-3 text-xs overflow-x-auto">
                  <button 
                    type="button"
                    onClick={() => setTimeType('SPECIFIC')} 
                    className={`flex-1 min-w-[70px] py-1.5 rounded border ${timeType === 'SPECIFIC' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 dark:text-gray-300'}`}
                  >
                      Satu Waktu
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTimeType('RECURRING')} 
                    className={`flex-1 min-w-[70px] py-1.5 rounded border ${timeType === 'RECURRING' ? 'bg-purple-100 border-purple-500 text-purple-700' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 dark:text-gray-300'}`}
                  >
                      Rutin
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTimeType('FLEXIBLE')} 
                    className={`flex-1 min-w-[70px] py-1.5 rounded border ${timeType === 'FLEXIBLE' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 dark:text-gray-300'}`}
                  >
                      Fleksibel
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTimeType('CUSTOM')} 
                    className={`flex-1 min-w-[70px] py-1.5 rounded border ${timeType === 'CUSTOM' ? 'bg-orange-100 border-orange-500 text-orange-700' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 dark:text-gray-300'}`}
                  >
                      Detail
                  </button>
              </div>

              {timeType === 'SPECIFIC' && (
                  <div className="mb-3 animate-in fade-in">
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Tanggal & Waktu</label>
                      <input 
                        type="datetime-local" 
                        value={specificDate}
                        onChange={(e) => setSpecificDate(e.target.value)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                      />
                  </div>
              )}

              {timeType === 'RECURRING' && (
                  <div className="mb-3 grid grid-cols-2 gap-2 animate-in fade-in">
                      <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Setiap Tanggal</label>
                          <input 
                            type="number" min="1" max="31"
                            value={recurDay}
                            onChange={(e) => setRecurDay(Number(e.target.value))}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                          />
                      </div>
                      <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Jam</label>
                          <input 
                            type="time" 
                            value={recurTime}
                            onChange={(e) => setRecurTime(e.target.value)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                          />
                      </div>
                  </div>
              )}

              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1 mt-2">
                  {timeType === 'SPECIFIC' ? 'Bulan (Otomatis terpilih dari tanggal)' : timeType === 'RECURRING' ? 'Pilih Bulan Pelaksanaan (Rutin)' : 'Pilih Bulan'}
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                  {allMonths.map(month => (
                      <div 
                        key={month}
                        onClick={() => toggleMonth(month)}
                        className={`text-center text-xs py-1.5 rounded cursor-pointer border transition ${
                            selectedMonths.includes(month) 
                            ? 'bg-primary-100 border-primary-500 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' 
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                          {month.substring(0,3)}
                      </div>
                  ))}
              </div>

              {/* CUSTOM SCHEDULE DETAILS */}
              {timeType === 'CUSTOM' && selectedMonths.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto border-t border-gray-200 dark:border-gray-700 pt-2 animate-in fade-in">
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Atur Tanggal & Jam per Bulan:</p>
                      {selectedMonths.sort((a,b) => allMonths.indexOf(a) - allMonths.indexOf(b)).map(m => (
                          <div key={m} className="flex items-center gap-2">
                              <span className="text-xs w-16 font-medium text-gray-600 dark:text-gray-400">{m}</span>
                              <input 
                                type="datetime-local" 
                                value={customSchedules[m] || ''}
                                onChange={(e) => updateCustomSchedule(m, e.target.value)}
                                className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs dark:text-white"
                              />
                          </div>
                      ))}
                  </div>
              )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          {/* Attachment Fields */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-500 uppercase">Lampiran & Bukti</p>
              <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1 flex items-center gap-1"><Image size={12}/> Link Foto Bukti</label>
                  <input type="text" value={proofUrl} onChange={e => setProofUrl(e.target.value)} className="w-full text-xs p-2 border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700 outline-none" placeholder="https://..." />
              </div>
              <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1 flex items-center gap-1"><Paperclip size={12}/> Link Dokumen (GDocs/Drive)</label>
                  <input type="text" value={docUrl} onChange={e => setDocUrl(e.target.value)} className="w-full text-xs p-2 border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700 outline-none" placeholder="https://..." />
              </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- REVIEW & REPORT MODAL (MULTI-REVIEW SUPPORT + MAXIMIZE) --- */}
      <Modal 
        isOpen={isReviewModalOpen} 
        onClose={() => setIsReviewModalOpen(false)} 
        title={`Review Kegiatan: ${reviewProgram?.name}`} 
        size={isReviewMaximized ? 'full' : '3xl'}
      >
          <div className={`flex flex-col md:flex-row overflow-hidden bg-gray-100 dark:bg-dark-bg p-4 gap-4 transition-all duration-300 ${isReviewMaximized ? 'h-[calc(100vh-80px)]' : 'h-[80vh] rounded-lg'}`}>
              
              {/* SIDEBAR: REVIEW HISTORY */}
              <div className="w-full md:w-1/3 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg flex flex-col overflow-hidden shrink-0">
                  <div className="p-3 border-b border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                      <h4 className="font-bold text-sm text-gray-800 dark:text-white">Riwayat Review</h4>
                      <button 
                        onClick={handleCreateReview}
                        className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 flex items-center gap-1"
                      >
                          <Plus size={12}/> Baru
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {currentReviewList.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">Belum ada review.</p>
                      ) : (
                          currentReviewList.map(item => (
                              <div 
                                key={item.id} 
                                onClick={() => handleEditReview(item)}
                                className={`p-2 rounded border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition ${selectedReviewId === item.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-100 dark:border-gray-700'}`}
                              >
                                  <div className="flex justify-between items-start mb-1">
                                      <span className="font-semibold text-xs text-gray-800 dark:text-white truncate flex-1">{item.title}</span>
                                      <span className="text-[10px] text-gray-500 whitespace-nowrap">{new Date(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{item.content}</p>
                              </div>
                          ))
                      )}
                  </div>
              </div>

              {/* MAIN: EDITOR / VIEWER */}
              <div className={`flex-1 overflow-y-auto bg-white dark:bg-gray-900 shadow-xl mx-auto w-full p-8 md:p-12 flex flex-col gap-6 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-dark-border relative rounded-lg transition-all duration-300 ${isReviewMaximized ? 'max-w-5xl' : 'max-w-3xl'}`}>
                  
                  {/* Floating Toolbar inside Editor */}
                  <div className="absolute top-4 right-4 flex gap-2 no-print">
                      <button 
                        onClick={() => setIsReviewMaximized(!isReviewMaximized)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full text-gray-500 transition"
                        title={isReviewMaximized ? "Kecilkan" : "Perbesar Layar"}
                      >
                          {isReviewMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                      </button>
                  </div>

                  {/* Header Doc */}
                  <div className="border-b-2 border-black dark:border-gray-600 pb-4 text-center mt-2">
                      <h2 className="text-xl font-bold uppercase">{activeFoundation?.name || 'YAYASAN'}</h2>
                      <h3 className="text-lg font-semibold mt-1">LAPORAN PERTANGGUNGJAWABAN KEGIATAN</h3>
                  </div>

                  {isEditingReview ? (
                      <div className="flex-1 flex flex-col gap-4 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 mb-1 block">Tanggal Pelaksanaan</label>
                                  <input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} className="w-full text-sm border p-2 rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700"/>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 mb-1 block">Judul Kegiatan / Laporan</label>
                                  <input type="text" value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} className="w-full text-sm border p-2 rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700" placeholder="Contoh: Kegiatan Januari"/>
                              </div>
                          </div>

                          <div className="flex-1 flex flex-col min-h-[300px]">
                              <label className="font-bold border-b border-gray-200 dark:border-gray-700 pb-1 mb-2 block">I. Evaluasi & Notulensi</label>
                              <textarea 
                                  value={reviewContent}
                                  onChange={(e) => setReviewContent(e.target.value)}
                                  className="flex-1 w-full p-4 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm leading-relaxed resize-none"
                                  placeholder="Tuliskan hasil kegiatan, evaluasi, kendala, dan pencapaian di sini..."
                              />
                          </div>

                          <div>
                              <label className="font-bold border-b border-gray-200 dark:border-gray-700 pb-1 mb-4 block">II. Dokumentasi Foto</label>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                  {reviewImages.map((img, idx) => (
                                      <div key={idx} className="relative group border rounded-lg overflow-hidden h-32 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                          <img src={img} alt={`Dokumentasi ${idx+1}`} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://placehold.co/400x300?text=Error')}/>
                                          <button onClick={() => handleRemoveReviewImage(idx)} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><Trash2 size={14}/></button>
                                      </div>
                                  ))}
                                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg h-32 flex flex-col items-center justify-center p-4 gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                      <Image size={24} className="text-gray-400"/>
                                      <input type="text" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="Paste Link Foto..." className="w-full text-xs p-1 border rounded text-center outline-none bg-transparent"/>
                                      <button onClick={handleAddReviewImage} className="text-xs bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition">+ Tambah</button>
                                  </div>
                              </div>
                          </div>
                          
                          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-auto sticky bottom-0 bg-white dark:bg-gray-900 py-2 z-10">
                              {selectedReviewId && (
                                  <button onClick={() => handleDeleteReviewItem(selectedReviewId)} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm mr-auto">Hapus Review Ini</button>
                              )}
                              <button onClick={() => setIsEditingReview(false)} className="px-4 py-2 bg-white dark:bg-gray-700 border rounded text-sm text-gray-700 dark:text-gray-200">Batal</button>
                              <button onClick={handleSaveReview} disabled={loading} className="px-6 py-2 bg-primary-600 text-white rounded text-sm font-bold hover:bg-primary-700 flex items-center gap-2">
                                  <Save size={16}/> {loading ? 'Menyimpan...' : 'Simpan'}
                              </button>
                          </div>
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[300px]">
                          <BookOpen size={48} className="mb-4 opacity-50"/>
                          <p>Pilih review dari riwayat di sebelah kiri atau buat baru.</p>
                      </div>
                  )}

                  <div className="text-right text-xs italic text-gray-500 mt-auto pt-4 border-t">
                      Dibuat otomatis oleh Sistem E-Yayasan
                  </div>
              </div>
          </div>
      </Modal>

      {/* --- INFO / PROOF MODAL --- */}
      <Modal 
        isOpen={infoModal.isOpen} 
        onClose={() => setInfoModal({isOpen: false, data: null, mode: 'DESC'})} 
        title={infoModal.mode === 'PROOF' ? "Bukti Kegiatan" : "Deskripsi Program"}
      >
          <div className="text-center p-2">
              {infoModal.mode === 'PROOF' && infoModal.data?.proof_url ? (
                  <div className="space-y-4">
                      <img src={infoModal.data.proof_url} alt="Bukti" className="max-w-full max-h-[60vh] rounded-lg shadow-md mx-auto object-contain" />
                      <a href={infoModal.data.proof_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-blue-600 hover:underline">Buka Gambar Asli</a>
                  </div>
              ) : infoModal.mode === 'DESC' ? (
                  <div className="text-left space-y-3">
                      <h3 className="font-bold text-lg">{infoModal.data?.name}</h3>
                      <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{infoModal.data?.description || 'Tidak ada deskripsi.'}</p>
                      {infoModal.data?.doc_url && (
                          <a href={infoModal.data.doc_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 mt-4 p-2 bg-blue-50 rounded border border-blue-100 hover:bg-blue-100 transition">
                              <ExternalLink size={16} /> Buka Dokumen Terlampir
                          </a>
                      )}
                  </div>
              ) : (
                  <p className="text-gray-500 italic">Tidak ada data untuk ditampilkan.</p>
              )}
          </div>
          <div className="mt-6 flex justify-end">
              <button onClick={() => setInfoModal({isOpen: false, data: null, mode: 'DESC'})} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300">Tutup</button>
          </div>
      </Modal>

      {/* --- DELETE CONFIRMATION --- */}
      <Modal isOpen={deleteConfirm.isOpen} onClose={() => setDeleteConfirm({isOpen: false, id: null})} title="Konfirmasi Hapus">
          <div className="text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-6">Yakin ingin menghapus program ini?</p>
              <div className="flex justify-center gap-3">
                  <button onClick={() => setDeleteConfirm({isOpen: false, id: null})} className="px-4 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600">Batal</button>
                  <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Hapus</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};
