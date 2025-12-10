
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
  groups?: Group;
  foundations?: Foundation;
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  cost: number; 
  month: string; // JSON string of array
  year: number;
  division_id: string;
  organization_id?: string;
  foundation_id?: string;
  status: 'Planned' | 'In Progress' | 'Completed';
  // New Attachment Fields
  proof_url?: string; // Link Gambar Bukti
  doc_url?: string;   // Link GDocs / Catatan
  // Joins
  divisions?: Division;
  organizations?: Organization;
}

export interface Event {
  id: string;
  name: string;
  date: string; // ISO Date string (Scheduled)
  location?: string;
  description?: string;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
  foundation_id?: string;
  // New Attendance Logic
  late_tolerance?: number; // In Minutes
  actual_start_time?: string; // ISO Date string (When admin clicked Start)
}

export interface EventAttendance {
  id: string;
  event_id: string;
  member_id: string;
  status: 'Present' | 'Excused' | 'Absent';
  check_in_time?: string; // ISO Date string
  notes?: string;
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
  | 'MASTER_FOUNDATION'; // New View for Super Admin
