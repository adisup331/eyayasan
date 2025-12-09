

export interface Foundation {
  id: string;
  name: string;
  slug?: string;
  address?: string;
  features: string[]; // List of enabled ViewState keys
}

export interface Role {
  id: string;
  name: string;
  permissions?: string[]; // Array of allowed ViewState keys
}

export interface Division {
  id: string;
  name: string;
  description?: string;
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  type: 'Education' | 'General'; // New Field
  foundation_id?: string;
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
  // Joins
  roles?: Role;
  divisions?: Division;
  organizations?: Organization;
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
  status: 'Planned' | 'In Progress' | 'Completed';
  // Joins
  divisions?: Division;
  organizations?: Organization;
}

export interface Event {
  id: string;
  name: string;
  date: string; // ISO Date string
  location?: string;
  description?: string;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
}

export interface EventAttendance {
  id: string;
  event_id: string;
  member_id: string;
  status: 'Present' | 'Excused' | 'Absent';
  notes?: string;
}

export type ViewState = 
  | 'DASHBOARD' 
  | 'MEMBERS' 
  | 'DIVISIONS' 
  | 'ORGANIZATIONS' 
  | 'PROGRAMS' 
  | 'ROLES' 
  | 'EVENTS' 
  | 'FINANCE' 
  | 'EDUCATORS'
  | 'MASTER_FOUNDATION'; // New View for Super Admin