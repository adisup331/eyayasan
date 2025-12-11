
export interface Foundation {
  id: string;
  name: string;
  slug?: string;
  address?: string;
  features: string[]; // List of enabled ViewState keys
  activation_pin?: string; 
  dashboard_config?: string[]; // Array of Widget IDs
}

export interface Role {
  id: string;
  name: string;
  permissions?: string[]; // Array of allowed ViewState keys
  foundation_id?: string;
  requires_service_period?: boolean; // NEW: Penanda wajib masa bakti
}

export interface Division {
  id: string;
  name: string;
  description?: string;
  foundation_id?: string;
  head_member_id?: string; // NEW: Kepala Bidang
  order_index?: number; // NEW: Urutan Tampilan
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  type: 'Education' | 'General' | 'TPQ'; // Added TPQ
  foundation_id?: string;
  // Joins
  foundations?: Foundation;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  foundation_id?: string;
  // Joins
  organizations?: Organization;
  foundations?: Foundation; // Added foundation join
}

export interface Member {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  // New Fields
  gender?: 'L' | 'P';
  origin?: string; // Asal
  birth_date?: string; // Tanggal Lahir
  grade?: 'Caberawit' | 'Praremaja' | 'Remaja' | 'Usia Nikah' | string; // NEW: Kelas/Jenjang
  member_type?: 'Generus' | 'Lima Unsur' | string; // NEW: Tipe Anggota
  service_period?: string; // Masa Bakti Display String
  service_end_date?: string; // New: Tanggal Habis Masa Bakti (ISO Date) for calculation
  status?: 'Active' | 'Inactive'; // New: Status Keaktifan
  
  role_id?: string;
  division_id?: string;
  organization_id?: string;
  group_id?: string; // New: Kelompok/Halaqah
  foundation_id?: string;
  // Joins
  roles?: Role;
  divisions?: Division;
  organizations?: Organization;
  groups?: Group; // Changed from groups?: Group to support single object join or ensure TS knows it has 'name'
  foundations?: Foundation;
}

// New Interface for Individual Review Item
export interface ReviewItem {
  id: string;
  date: string; // Date of the specific activity/review
  title: string; // e.g. "Kegiatan Bulan Januari"
  content: string; // HTML/Text content
  images: string[]; // Array of image URLs
  participants?: number;
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  cost: number; 
  month: string; // JSON string of array
  monthly_status?: string; // NEW: JSON Object { "Januari": "In Progress", ... }
  year: number;
  date?: string; // NEW: Specific Date (ISO string)
  division_id: string;
  organization_id?: string;
  foundation_id?: string;
  status: 'Planned' | 'In Progress' | 'Completed';
  // New Attachment Fields
  proof_url?: string; // Link Gambar Bukti
  doc_url?: string;   // Link GDocs / Catatan
  // New: Detailed Schedules
  schedules?: any; // JSONB Array: [{month: string, date: string}, ...]
  // Updated: Array of Reviews
  review_data?: ReviewItem[]; 
  // Joins
  divisions?: Division;
  organizations?: Organization;
}

export interface EventSession {
  id: string;
  name: string;
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
}

export interface Event {
  id: string;
  name: string;
  date: string; // ISO Date string (Scheduled)
  location?: string;
  description?: string;
  event_type?: 'Pengajian' | 'Rapat' | 'Acara Umum' | string; // NEW: Tipe Acara
  status: 'Upcoming' | 'Completed' | 'Cancelled';
  foundation_id?: string;
  // New Attendance Logic
  late_tolerance?: number; // In Minutes
  actual_start_time?: string; // ISO Date string (When admin clicked Start)
  sessions?: EventSession[]; // NEW: JSON Array of sessions
}

export interface EventAttendance {
  id: string;
  event_id: string;
  member_id: string;
  status: 'Present' | 'Excused' | 'Absent';
  check_in_time?: string; // ISO Date string (Main/First checkin)
  notes?: string;
  logs?: Record<string, string>; // NEW: JSON Object mapping session_id -> timestamp
  // Join for report
  members?: Member;
}

export type ViewState = 
  | 'DASHBOARD' 
  | 'MEMBERS' 
  | 'DIVISIONS' 
  | 'ORGANIZATIONS' 
  | 'GROUPS' 
  | 'PROGRAMS' 
  | 'ROLES' 
  | 'EVENTS' 
  | 'FINANCE' 
  | 'EDUCATORS'
  | 'PROFILE'
  | 'DOCUMENTATION' // New View
  | 'MASTER_FOUNDATION'
  | 'MEMBER_PORTAL'
  | 'SCANNER'; // New View for Dedicated Scanner
