
export type ViewState = 'DASHBOARD' | 'MEMBERS' | 'DIVISIONS' | 'ORGANIZATIONS' | 'GROUPS' | 'WORKPLACES' | 'VILLAGES' | 'PROGRAMS' | 'ROLES' | 'EVENTS' | 'FORUMS' | 'FINANCE' | 'EDUCATORS' | 'MASTER_FOUNDATION' | 'PROFILE' | 'DOCUMENTATION' | 'SCANNER' | 'MEMBER_CARDS' | 'MEMBER_PORTAL';

export interface Workplace {
  id: string;
  name: string;
  description?: string;
  address?: string;
  foundation_id?: string;
  parent_workplace_id?: string; // For outlets/branches
  created_at?: string;
}

export interface Village {
  id: string;
  name: string;
  description?: string;
  foundation_id?: string;
  created_at?: string;
}

export interface Foundation {
  id: string;
  name: string;
  address?: string;
  activation_pin?: string;
  features?: string[];
  dashboard_config?: string[];
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  type: 'General' | 'Education' | 'TPQ';
  foundation_id?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  pin?: string; // PIN for password reset
  organization_id: string;
  village_id?: string;
  foundation_id?: string;
  created_at?: string;
  villages?: { name: string };
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  foundation_id?: string;
  workplace_id?: string;
  requires_service_period?: boolean;
}

export interface Member {
  id: string;
  full_name: string;
  nickname?: string;
  email: string;
  phone?: string;
  role_id?: string;
  division_id?: string;
  organization_id?: string;
  foundation_id?: string;
  group_id?: string;
  workplace_id?: string;
  status?: 'Active' | 'Inactive';
  member_type?: string;
  service_period?: string;
  service_end_date?: string;
  gender?: 'L' | 'P' | '';
  origin?: string;
  birth_date?: string;
  employment_status?: 'Pribumi' | 'Karyawan' | string;
  workplace?: string;
  grade?: string;
  roles?: { name: string; permissions?: string[] };
  divisions?: { name: string };
  organizations?: { name: string };
  foundations?: { name: string };
  groups?: { name: string };
  daysLeft?: number;
}

export interface MemberMutation {
  id: string;
  member_id: string;
  type: string;
  description?: string;
  mutation_date: string;
  foundation_id?: string;
  created_at?: string;
}

export interface Division {
  id: string;
  name: string;
  description?: string;
  foundation_id?: string;
  head_member_id?: string;
  order_index?: number;
}

export interface ReviewItem {
  id: string;
  date: string;
  title: string;
  content: string;
  result_status: 'Success' | 'Warning' | 'Failed' | 'Pending';
  images: string[];
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  cost: number;
  month: string; 
  year: number;
  division_id: string;
  organization_id?: string;
  foundation_id?: string;
  status: 'Planned' | 'In Progress' | 'Completed';
  proof_url?: string;
  doc_url?: string;
  review_data?: ReviewItem[];
  schedules?: any;
  date?: string;
}

export interface ParentEvent {
  id: string;
  name: string;
  description?: string;
  foundation_id?: string;
  created_at?: string;
}

export interface EventSession {
  id: string;
  name: string;
  startTime?: string;
  endTime?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  location?: string;
  description?: string;
  event_type?: 'Pengajian' | 'Rapat' | 'Acara Umum' | string; 
  status: 'Upcoming' | 'Completed' | 'Cancelled';
  is_active: boolean;
  is_exclusive: boolean;
  foundation_id?: string;
  parent_event_id?: string; 
  forum_id?: string;
  late_tolerance?: number; 
  actual_start_time?: string; 
  sessions?: EventSession[]; 
  division_id?: string;
  divisions?: { name: string };
  forums?: { name: string };
}

export interface Forum {
  id: string;
  name: string;
  description?: string;
  foundation_id?: string;
  created_at?: string;
}

export interface ForumMember {
  id: string;
  forum_id: string;
  member_id: string;
  created_at?: string;
  members?: { full_name: string; nickname?: string };
}

export interface EventAttendance {
  id: string;
  event_id: string;
  member_id: string;
  status: 'Present' | 'Excused' | 'Absent' | 'izin_telat' | 'Present Late';
  check_in_time?: string;
  leave_reason?: string;
  logs?: Record<string, string>; 
}
