
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

export const useProject = () => {
  return useQuery({
    queryKey: ['project'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as Project;
    }
  });
};
