export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          access_status: Database["public"]["Enums"]["access_status"]
          created_at: string
          device_id: string | null
          device_name: string | null
          direction: Database["public"]["Enums"]["access_direction"] | null
          id: string
          photo_capture_url: string | null
          reason: string | null
          score: number | null
          timestamp: string
          worker_document: string | null
          worker_id: string | null
          worker_name: string | null
        }
        Insert: {
          access_status: Database["public"]["Enums"]["access_status"]
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          direction?: Database["public"]["Enums"]["access_direction"] | null
          id?: string
          photo_capture_url?: string | null
          reason?: string | null
          score?: number | null
          timestamp?: string
          worker_document?: string | null
          worker_id?: string | null
          worker_name?: string | null
        }
        Update: {
          access_status?: Database["public"]["Enums"]["access_status"]
          created_at?: string
          device_id?: string | null
          device_name?: string | null
          direction?: Database["public"]["Enums"]["access_direction"] | null
          id?: string
          photo_capture_url?: string | null
          reason?: string | null
          score?: number | null
          timestamp?: string
          worker_document?: string | null
          worker_id?: string | null
          worker_name?: string | null
        }
        Relationships: []
      }
      agent_commands: {
        Row: {
          agent_id: string
          command: string
          created_at: string
          created_by: string | null
          device_id: string
          error_message: string | null
          executed_at: string | null
          id: string
          payload: Json | null
          result: Json | null
          status: string
        }
        Insert: {
          agent_id: string
          command: string
          created_at?: string
          created_by?: string | null
          device_id: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string
        }
        Update: {
          agent_id?: string
          command?: string
          created_at?: string
          created_by?: string | null
          device_id?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_commands_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "local_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          api_environment: string | null
          api_password: string | null
          cnpj: string | null
          contact_email: string | null
          created_at: string
          id: string
          logo_url_dark: string | null
          logo_url_light: string | null
          logo_url_rotated: string | null
          name: string
          phone: string | null
          project_managers: string[] | null
          responsible_name: string | null
          status: string | null
          type: string
          updated_at: string
          vessels: string[] | null
        }
        Insert: {
          address?: string | null
          api_environment?: string | null
          api_password?: string | null
          cnpj?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_url_dark?: string | null
          logo_url_light?: string | null
          logo_url_rotated?: string | null
          name: string
          phone?: string | null
          project_managers?: string[] | null
          responsible_name?: string | null
          status?: string | null
          type?: string
          updated_at?: string
          vessels?: string[] | null
        }
        Update: {
          address?: string | null
          api_environment?: string | null
          api_password?: string | null
          cnpj?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_url_dark?: string | null
          logo_url_light?: string | null
          logo_url_rotated?: string | null
          name?: string
          phone?: string | null
          project_managers?: string[] | null
          responsible_name?: string | null
          status?: string | null
          type?: string
          updated_at?: string
          vessels?: string[] | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          company_id: string
          created_at: string | null
          document_type: string
          file_url: string | null
          filename: string
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          document_type: string
          file_url?: string | null
          filename: string
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          document_type?: string
          file_url?: string | null
          filename?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      connectivity_events: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_status: string
          previous_status: string | null
          project_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_status: string
          previous_status?: string | null
          project_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_status?: string
          previous_status?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connectivity_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      device_api_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          device_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_api_tokens_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          agent_id: string | null
          api_credentials: Json | null
          configuration: Json | null
          controlid_ip_address: string
          controlid_serial_number: string
          created_at: string
          id: string
          last_event_timestamp: string | null
          location: string | null
          name: string
          project_id: string | null
          status: Database["public"]["Enums"]["device_status"]
          type: Database["public"]["Enums"]["device_type"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          api_credentials?: Json | null
          configuration?: Json | null
          controlid_ip_address: string
          controlid_serial_number: string
          created_at?: string
          id?: string
          last_event_timestamp?: string | null
          location?: string | null
          name: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          type?: Database["public"]["Enums"]["device_type"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          api_credentials?: Json | null
          configuration?: Json | null
          controlid_ip_address?: string
          controlid_serial_number?: string
          created_at?: string
          id?: string
          last_event_timestamp?: string | null
          location?: string | null
          name?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          type?: Database["public"]["Enums"]["device_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "local_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          created_at: string
          default_validity_days: number | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_validity_days?: number | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_validity_days?: number | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      generated_reports: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json | null
          date_range_end: string | null
          date_range_start: string | null
          file_url: string | null
          filters: Json | null
          id: string
          project_id: string | null
          report_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json | null
          date_range_end?: string | null
          date_range_start?: string | null
          file_url?: string | null
          filters?: Json | null
          id?: string
          project_id?: string | null
          report_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json | null
          date_range_end?: string | null
          date_range_start?: string | null
          file_url?: string | null
          filters?: Json | null
          id?: string
          project_id?: string | null
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_functions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      known_locations: {
        Row: {
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      local_agents: {
        Row: {
          configuration: Json | null
          created_at: string
          created_by: string | null
          id: string
          ip_address: string | null
          last_seen_at: string | null
          last_sync_at: string | null
          name: string
          pending_sync_count: number | null
          project_id: string | null
          status: string
          sync_status: string | null
          token: string
          updated_at: string
          version: string | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string | null
          last_sync_at?: string | null
          name: string
          pending_sync_count?: number | null
          project_id?: string | null
          status?: string
          sync_status?: string | null
          token: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string | null
          last_sync_at?: string | null
          name?: string
          pending_sync_count?: number | null
          project_id?: string | null
          status?: string
          sync_status?: string | null
          token?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_agents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_access_points: {
        Row: {
          access_location: string
          auto_sync: boolean
          client_id: string | null
          created_at: string
          created_by: string | null
          direction_mode: string
          id: string
          is_active: boolean
          location_description: string | null
          name: string
          project_id: string | null
          recognition_method: string
          require_photo: boolean
        }
        Insert: {
          access_location?: string
          auto_sync?: boolean
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          direction_mode?: string
          id?: string
          is_active?: boolean
          location_description?: string | null
          name: string
          project_id?: string | null
          recognition_method?: string
          require_photo?: boolean
        }
        Update: {
          access_location?: string
          auto_sync?: boolean
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          direction_mode?: string
          id?: string
          is_active?: boolean
          location_description?: string | null
          name?: string
          project_id?: string | null
          recognition_method?: string
          require_photo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "manual_access_points_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_access_points_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string | null
          priority: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pending_workers: {
        Row: {
          company_id: string
          created_at: string
          document_number: string | null
          id: string
          job_function_id: string | null
          name: string
          photo_url: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string | null
          status: string
          submitted_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_number?: string | null
          id?: string
          job_function_id?: string | null
          name: string
          photo_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          status?: string
          submitted_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_number?: string | null
          id?: string
          job_function_id?: string | null
          name?: string
          photo_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          status?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_workers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_workers_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          allowed_worker_ids: string[] | null
          api_project_id: string | null
          armador: string | null
          chief_engineer: string | null
          client_id: string | null
          commander: string | null
          created_at: string
          crew_size: number | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          project_type: string | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          allowed_worker_ids?: string[] | null
          api_project_id?: string | null
          armador?: string | null
          chief_engineer?: string | null
          client_id?: string | null
          commander?: string | null
          created_at?: string
          crew_size?: number | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          project_type?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          allowed_worker_ids?: string[] | null
          api_project_id?: string | null
          armador?: string | null
          chief_engineer?: string | null
          client_id?: string | null
          commander?: string | null
          created_at?: string
          crew_size?: number | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          project_type?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string | null
          created_by: string | null
          filters: Json | null
          frequency: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          project_id: string | null
          recipients: string[]
          report_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          filters?: Json | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          project_id?: string | null
          recipients?: string[]
          report_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          filters?: Json | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          project_id?: string | null
          recipients?: string[]
          report_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      required_documents: {
        Row: {
          created_at: string
          document_name: string
          id: string
          is_mandatory: boolean | null
          job_function_id: string | null
          validity_days: number | null
        }
        Insert: {
          created_at?: string
          document_name: string
          id?: string
          is_mandatory?: boolean | null
          job_function_id?: string | null
          validity_days?: number | null
        }
        Update: {
          created_at?: string
          document_name?: string
          id?: string
          is_mandatory?: boolean | null
          job_function_id?: string | null
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "required_documents_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_companies: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_projects: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          checked_out_at: string | null
          company: string | null
          created_at: string
          document_number: string | null
          id: string
          name: string
          photo_url: string | null
          project_id: string | null
          reason: string | null
          status: string
          valid_until: string | null
        }
        Insert: {
          checked_out_at?: string | null
          company?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          name: string
          photo_url?: string | null
          project_id?: string | null
          reason?: string | null
          status?: string
          valid_until?: string | null
        }
        Update: {
          checked_out_at?: string | null
          company?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          project_id?: string | null
          reason?: string | null
          status?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_documents: {
        Row: {
          created_at: string
          document_type: string
          document_url: string | null
          expiry_date: string | null
          extracted_data: Json | null
          filename: string | null
          id: string
          issue_date: string | null
          status: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          document_url?: string | null
          expiry_date?: string | null
          extracted_data?: Json | null
          filename?: string | null
          id?: string
          issue_date?: string | null
          status?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          document_url?: string | null
          expiry_date?: string | null
          extracted_data?: Json | null
          filename?: string | null
          id?: string
          issue_date?: string | null
          status?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_documents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_strikes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          reason: string
          severity: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reason: string
          severity?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reason?: string
          severity?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_strikes_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          allowed_project_ids: string[] | null
          birth_date: string | null
          blood_type: string | null
          code: number
          company_id: string | null
          created_at: string
          devices_enrolled: string[] | null
          document_number: string | null
          facial_template_data: Json | null
          gender: string | null
          id: string
          job_function_id: string | null
          name: string
          observations: string | null
          photo_url: string | null
          rejection_reason: string | null
          role: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          allowed_project_ids?: string[] | null
          birth_date?: string | null
          blood_type?: string | null
          code?: number
          company_id?: string | null
          created_at?: string
          devices_enrolled?: string[] | null
          document_number?: string | null
          facial_template_data?: Json | null
          gender?: string | null
          id?: string
          job_function_id?: string | null
          name: string
          observations?: string | null
          photo_url?: string | null
          rejection_reason?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          allowed_project_ids?: string[] | null
          birth_date?: string | null
          blood_type?: string | null
          code?: number
          company_id?: string | null
          created_at?: string
          devices_enrolled?: string[] | null
          document_number?: string | null
          facial_template_data?: Json | null
          gender?: string | null
          id?: string
          job_function_id?: string | null
          name?: string
          observations?: string | null
          photo_url?: string | null
          rejection_reason?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_initial_admin: { Args: { _user_id: string }; Returns: boolean }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      needs_initial_setup: { Args: never; Returns: boolean }
    }
    Enums: {
      access_direction: "entry" | "exit" | "unknown"
      access_status: "granted" | "denied"
      app_role: "admin" | "moderator" | "user" | "company_admin" | "operator"
      device_status: "online" | "offline" | "error" | "configuring"
      device_type: "facial_reader" | "turnstile" | "terminal"
      worker_status: "active" | "inactive" | "blocked" | "pending_review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_direction: ["entry", "exit", "unknown"],
      access_status: ["granted", "denied"],
      app_role: ["admin", "moderator", "user", "company_admin", "operator"],
      device_status: ["online", "offline", "error", "configuring"],
      device_type: ["facial_reader", "turnstile", "terminal"],
      worker_status: ["active", "inactive", "blocked", "pending_review"],
    },
  },
} as const
