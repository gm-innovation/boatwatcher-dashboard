export interface Company {
  id: string
  name: string
  entry_time: string
  workers_count: number
  created_at: string
  logo_url: string | null
  project_managers: string[]
  vessels: string[]
}

export interface Worker {
  id: string
  name: string
  company_id: string
  role: string
  arrival_time: string
  photo_url: string
  created_at: string
}

export interface Project {
  id: string
  vessel_name: string
  start_date: string
  project_type: string
  engineer: string
  company: string
  captain: string
  created_at: string
}