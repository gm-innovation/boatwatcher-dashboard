export interface Company {
  id: string;
  name: string;
  logo_url_light: string | null;
  logo_url_dark: string | null;
  vessels: string[];
  project_managers: string[];
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
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  client_id: string | null;
  status: string | null;
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
