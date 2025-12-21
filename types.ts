
export type ViewState = 'DASHBOARD' | 'MEMBERS' | 'DIVISIONS' | 'ORGANIZATIONS' | 'GROUPS' | 'PROGRAMS' | 'ROLES' | 'EVENTS' | 'FINANCE' | 'EDUCATORS' | 'MASTER_FOUNDATION' | 'PROFILE' | 'DOCUMENTATION' | 'SCANNER' | 'MEMBER_CARDS' | 'MEMBER_PORTAL';

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
  organization_id: string;
  foundation_id?: string;
  created_at?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  foundation_id?: string;
  requires_service_period?: boolean;
}

export interface Member {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role_id?: string;
  division_id?: string;
  organization_id?: string;
  foundation_id?: string;
  group_id?: string;
  status?: 'Active' | 'Inactive';
  member_type?: string;
  service_period?: string;
  service_end_date?: string;
  gender?: 'L' | 'P' | '';
  origin?: string;
  birth_date?: string;
  grade?: string;
  roles?: { name: string; permissions?: string[] };
  divisions?: { name: string };
  organizations?: { name: string };
  foundations?: { name: string };
  groups?: { name: string };
  daysLeft?: number;
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
  foundation_id?: string;
  parent_event_id?: string; 
  late_tolerance?: number; 
  actual_start_time?: string; 
  sessions?: EventSession[]; 
}

export interface EventAttendance {
  id: string;
  event_id: string;
  member_id: string;
  status: 'Present' | 'Excused' | 'Absent' | 'Excused Late' | 'Present Late';
  check_in_time?: string;
  leave_reason?: string;
  logs?: Record<string, string>; 
}
