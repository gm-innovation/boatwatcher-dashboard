export interface Company {
  id: string;
  name: string;
  logo_url_light: string | null;
  logo_url_dark: string | null;
  logo_url_rotated: string | null;
  vessels: string[];
  project_managers: string[];
  cnpj: string | null;
  contact_email: string | null;
  status: string | null;
  type: string | null;
  api_password: string | null;
  api_environment: string | null;
  responsible_name: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: string;
  name: string;
  code: number;
  company_id: string | null;
  company?: string;
  role: string | null;
  status: string | null;
  document_number: string | null;
  photo_url: string | null;
  facial_template_data: any | null;
  allowed_project_ids: string[];
  devices_enrolled: string[];
  job_function_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  client_id: string | null;
  client?: Company;
  created_at: string;
  updated_at: string;
  allowed_worker_ids: string[] | null;
  start_date: string | null;
  crew_size: number | null;
  status: string | null;
  location: string | null;
  commander: string | null;
  chief_engineer: string | null;
  project_type: string | null;
  armador: string | null;
  api_project_id: string | null;
}

export type AppRole = 'admin' | 'moderator' | 'user' | 'company_admin';

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

export interface UserCompany {
  id: string;
  user_id: string;
  company_id: string;
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
  agent_id: string | null;
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

export interface JobFunction {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequiredDocument {
  id: string;
  job_function_id: string;
  document_name: string;
  validity_days: number | null;
  is_mandatory: boolean;
  created_at: string;
}

export interface WorkerDocument {
  id: string;
  worker_id: string;
  document_type: string;
  document_url: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: Record<string, any>;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface Notification {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  priority: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

export interface DocumentType {
  id: string;
  name: string;
  default_validity_days: number | null;
  description: string | null;
  created_at: string;
}

export interface PendingWorker {
  id: string;
  company_id: string;
  name: string;
  document_number: string | null;
  role: string | null;
  photo_url: string | null;
  job_function_id: string | null;
  submitted_by: string | null;
  status: string;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface GeneratedReport {
  id: string;
  report_type: string;
  project_id: string | null;
  filters: Record<string, any>;
  data: Record<string, any> | null;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
}
