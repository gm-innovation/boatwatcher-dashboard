import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Company, Worker, Project } from '@/types/supabase';

export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Company[];
    }
  });
};

export const useWorkers = () => {
  return useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select(`
          *,
          companies (
            name
          )
        `)
        .order('name');
      
      if (error) throw error;
      
      return data.map((worker: any) => ({
        ...worker,
        company: worker.companies?.name || 'N/A'
      })) as Worker[];
    }
  });
};

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:companies (
            name,
            vessels,
            project_managers,
            logo_url_light,
            logo_url_dark
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }
      
      return data as Project[];
    }
  });
};

export const useProjectById = (projectId: string | null) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:companies (
            name,
            vessels,
            project_managers,
            logo_url_light,
            logo_url_dark
          )
        `)
        .eq('id', projectId)
        .single();
      
      if (error) {
        console.error('Error fetching project by id:', error);
        throw error;
      }

      return data as Project;
    },
    enabled: !!projectId
  });
};

export const useCompanyLogo = (companyId: string | null) => {
  return useQuery({
    queryKey: ['company-logo', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('companies')
        .select('logo_url_light, logo_url_dark')
        .eq('id', companyId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId
  });
};
