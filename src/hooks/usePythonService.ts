import { useQuery } from '@tanstack/react-query';
import { pythonServiceApi } from '@/integrations/python-service/client';
import { toast } from '@/components/ui/use-toast';

interface AccessEvent {
  tipo: string;
  data: string;
  nomePessoa: string;
  cargoPessoa: string;
  vinculoColaborador: {
    empresa: string;
  };
  alvo: {
    _id: string;
    nome: string;
  };
}

export const useAccessEvents = (projectId?: string) => {
  return useQuery({
    queryKey: ['python-service', 'events', projectId],
    queryFn: async (): Promise<AccessEvent[]> => {
      if (!projectId) {
        console.log('No projectId provided, returning empty array');
        return [];
      }

      try {
        const startDate = '2024-02-01';
        const endDate = new Date().toISOString().split('T')[0];

        console.log('Fetching events with params:', { startDate, endDate, projectId });

        const response = await pythonServiceApi.events.getAccessEvents({
          start_date: startDate,
          end_date: endDate,
          project_id: projectId
        });

        const events = response.data.events || [];

        console.log('Events received:', {
          totalEvents: events.length,
          sampleEvent: events[0]
        });

        return events;
      } catch (error) {
        console.error('Error fetching events:', error);
        toast({
          title: 'Erro ao buscar eventos',
          description: 'Não foi possível obter os eventos. Por favor, tente novamente mais tarde.',
          variant: 'destructive',
        });
        return [];
      }
    },
    enabled: !!projectId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useProjects = ({
  skip = 0,
  limit = 100,
  search,
  status,
  client,
  forceRefresh = false,
}: {
  skip?: number;
  limit?: number;
  search?: string;
  status?: string;
  client?: string;
  forceRefresh?: boolean;
} = {}) => {
  return useQuery({
    queryKey: ['python-service', 'projects', { skip, limit, search, status, client }],
    queryFn: async () => {
      try {
        const response = await pythonServiceApi.projects.list({
          skip,
          limit,
          search,
          status,
          client,
          force_refresh: forceRefresh,
        });

        return response.data;
      } catch (error) {
        console.error('Error fetching projects:', error);
        toast({
          title: 'Erro ao buscar projetos',
          description: 'Não foi possível obter a lista de projetos. Por favor, tente novamente mais tarde.',
          variant: 'destructive',
        });
        throw error;
      }
    },
  });
};

export const useProject = (projectId: string, forceRefresh: boolean = false) => {
  return useQuery({
    queryKey: ['python-service', 'project', projectId],
    queryFn: async () => {
      try {
        const response = await pythonServiceApi.projects.getById(projectId, forceRefresh);
        return response.data;
      } catch (error) {
        console.error('Error fetching project:', error);
        toast({
          title: 'Erro ao buscar projeto',
          description: 'Não foi possível obter os detalhes do projeto. Por favor, tente novamente mais tarde.',
          variant: 'destructive',
        });
        throw error;
      }
    },
  });
};