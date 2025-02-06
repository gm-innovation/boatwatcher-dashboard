import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Worker[];
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
          company:companies!projects_client_id_fkey (
            name,
            vessels,
            project_managers
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }
      
      // Transform the data to match the expected Project type
      const transformedData = data.map((project: any) => ({
        ...project,
        vessel_name: project.company?.vessels?.[0] || '',
        engineer: project.company?.project_managers?.[0] || '',
        company: project.company?.name || ''
      }));
      
      return transformedData as Project[];
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
          company:companies!projects_client_id_fkey (
            name,
            vessels,
            project_managers
          )
        `)
        .eq('id', projectId)
        .single();
      
      if (error) {
        console.error('Error fetching project by id:', error);
        throw error;
      }

      // Transform the data to match the expected Project type
      const transformedData = {
        ...data,
        vessel_name: data.company?.vessels?.[0] || '',
        engineer: data.company?.project_managers?.[0] || '',
        company: data.company?.name || ''
      };
      
      return transformedData as Project;
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
        .select('logo_url')
        .eq('id', companyId)
        .single();
      
      if (error) throw error;
      return data?.logo_url;
    },
    enabled: !!companyId
  });
};