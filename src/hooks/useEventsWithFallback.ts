/**
 * Hook for accessing events data with fallback support
 * 
 * This hook provides access to events data from the Python microservice
 * with automatic fallback to Supabase functions if the microservice fails.
 */

import { useQuery } from '@tanstack/react-query';
import { getAccessEventsWithFallback } from '@/lib/api-fallback';

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

// Map of project IDs to their valid location IDs
const PROJECT_LOCATIONS: Record<string, string[]> = {
  'cb9babbc-c77f-40db-a0b7-f3187b4659fb': ['5e95cef20def48003a432b33'], // BEN MOINHOS SMART LIFE
  '38277272-7079-4492-830a-a78a9f006c67': ['5ef9fe97e5cab7002e9e78d3'], // BALN. RINCAO TERRENO MICHELS
  '7c52d6d7-aa0e-4f6c-b02d-4d91728f5753': ['5e726daabe7681002eb23399'], // NOVA ALAMEDA
  '9e8d7c6b-5a4f-3e2d-1c9b-8a7f6d5e4c3a': ['611a46720bb83e0021170d4f'], // SANTA MARIA
  'b2a1c9d8-7e6f-5d4c-3b2a-1f9e8d7c6b5a': ['5e7c9f17fccc9f002ea6c478'], // TORRES DE PRATA
  'd4c3b2a1-9e8f-7d6c-5b4a-3f2e1d9c8b7a': ['5ef9fe97e5cab7002e9e792e'], // LISSANDRA
  'f8d7a8e9-b3c1-4b5d-9e6f-2d8b1f3c4a5b': ['5e95cef20def48003a432b33'], // BEN MOINHOS SMART LIFE
};

/**
 * Hook for accessing events data with automatic fallback
 * @param projectId - The ID of the project to fetch events for
 * @returns Query result with events data
 */
export const useEventsWithFallback = (projectId?: string) => {
  return useQuery({
    queryKey: ['events-with-fallback', projectId],
    queryFn: async (): Promise<AccessEvent[]> => {
      if (!projectId) {
        console.log('No projectId provided, returning empty array');
        return [];
      }

      try {
        const startDate = '2024-02-01';
        const endDate = new Date().toISOString().split('T')[0];

        console.log('Fetching events with fallback mechanism:', { startDate, endDate, projectId });

        // Use the fallback mechanism to get events
        const events = await getAccessEventsWithFallback({
          start_date: startDate,
          end_date: endDate,
          project_id: projectId
        });

        console.log('Events received with fallback mechanism:', {
          totalEvents: events.length,
          sampleEvent: events[0]
        });

        // Apply filtering logic (same as in the original useInmetaApi hook)
        const validLocations = PROJECT_LOCATIONS[projectId] || [];
        
        const filteredEvents = events
          .filter(event => {
            const isValidType = event.tipo === 'ENTRADA' || event.tipo === 'ENTRADA_COM_PENDENCIAS';
            const isValidLocation = validLocations.includes(event.alvo._id);
            
            return isValidType && isValidLocation;
          })
          .map(event => ({
            tipo: event.tipo,
            data: event.data,
            nomePessoa: event.nomePessoa || '',
            cargoPessoa: event.cargoPessoa || '',
            vinculoColaborador: event.vinculoColaborador ? {
              empresa: event.vinculoColaborador?.empresa || 
                       event.vinculoColaborador?.nome || 
                       event.vinculoColaborador?.razaoSocial || 
                       (typeof event.vinculoColaborador === 'string' ? event.vinculoColaborador : '')
            } : null,
            alvo: event.alvo
          }));

        console.log('Filtered events for project:', { 
          projectId, 
          totalEvents: events.length,
          filteredCount: filteredEvents.length,
          sampleEvent: filteredEvents[0]
        });

        return filteredEvents;
      } catch (error) {
        console.error('Error in useEventsWithFallback:', error);
        return [];
      }
    },
    enabled: !!projectId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};