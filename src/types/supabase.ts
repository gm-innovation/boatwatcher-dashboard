export interface Company {
  id: string;
  name: string;
  logo_url_light: string | null;
  logo_url_dark: string | null;
  vessels: string[];
  project_managers: string[];
  cnpj: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: string;
  name: string;
  company_id: string | null;
  company?: string;
  role: string | null;
  status: string | null;
  document_number: string | null;
  photo_url: string | null;
  facial_template_data: any | null;
  allowed_project_ids: string[];
  devices_enrolled: string[];
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  client_id: string | null;
  status: string | null;
  location: string | null;
  allowed_worker_ids: string[];
  created_at: string;
  updated_at: string;
  client?: {
    name: string;
    vessels: string[];
    project_managers: string[];
    logo_url_light: string | null;
    logo_url_dark: string | null;
  } | null;
}

export type AppRole = 'admin' | 'moderator' | 'user';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface UserProject {
  id: string;
  user_id: string;
  project_id: string;
  created_at: string;
}

export type DeviceType = 'facial_reader' | 'turnstile' | 'terminal';
export type DeviceStatus = 'online' | 'offline' | 'error' | 'configuring';
export type AccessStatus = 'granted' | 'denied';
export type AccessDirection = 'entry' | 'exit' | 'unknown';
export type WorkerStatus = 'active' | 'inactive' | 'blocked' | 'pending_review';

export interface Device {
  id: string;
  controlid_serial_number: string;
  controlid_ip_address: string;
  name: string;
  location: string | null;
  type: DeviceType;
  status: DeviceStatus;
  project_id: string | null;
  configuration: Record<string, any>;
  api_credentials: Record<string, any>;
  last_event_timestamp: string | null;
  created_at: string;
  updated_at: string;
  project?: Project | null;
}

export interface AccessLog {
  id: string;
  worker_id: string | null;
  device_id: string | null;
  timestamp: string;
  access_status: AccessStatus;
  reason: string | null;
  photo_capture_url: string | null;
  direction: AccessDirection;
  score: number | null;
  worker_name: string | null;
  worker_document: string | null;
  device_name: string | null;
  created_at: string;
  worker?: Worker | null;
  device?: Device | null;
}
