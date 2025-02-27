import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

interface InmetaEvent {
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

const PROJECT_LOCATIONS: Record<string, string[]> = {
  'cb9babbc-c77f-40db-a0b7-f3187b4659fb': ['5e95cef20def48003a432b33'], // BEN MOINHOS SMART LIFE
  '38277272-7079-4492-830a-a78a9f006c67': ['5ef9fe97e5cab7002e9e78d3'], // BALN. RINCAO TERRENO MICHELS
  '7c52d6d7-aa0e-4f6c-b02d-4d91728f5753': ['5e726daabe7681002eb23399'], // NOVA ALAMEDA
  '9e8d7c6b-5a4f-3e2d-1c9b-8a7f6d5e4c3a': ['611a46720bb83e0021170d4f'], // SANTA MARIA
  'b2a1c9d8-7e6f-5d4c-3b2a-1f9e8d7c6b5a': ['5e7c9f17fccc9f002ea6c478'], // TORRES DE PRATA
  'd4c3b2a1-9e8f-7d6c-5b4a-3f2e1d9c8b7a': ['5ef9fe97e5cab7002e9e792e'], // LISSANDRA
  'f8d7a8e9-b3c1-4b5d-9e6f-2d8b1f3c4a5b': ['5e95cef20def48003a432b33'], // BEN MOINHOS SMART LIFE
};

const formatDateToYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const useInmetaEvents = (projectId?: string) => {
  return useQuery({
    queryKey: ["inmeta-events", projectId],
    queryFn: async (): Promise<InmetaEvent[]> => {
      // Se não houver projectId, retorna array vazio
      if (!projectId) {
        console.log('No projectId provided, returning empty array');
        return [];
      }

      try {
        const startDate = '2024-02-01';
        const endDate = formatDateToYYYYMMDD(new Date());

        console.log('Fetching Inmeta events with params:', { startDate, endDate, projectId });

        const { data: response, error } = await supabase.functions.invoke("inmeta-api", {
          method: "POST",
          body: {
            action: "getAccessEvents",
            startDate,
            endDate,
            projectId
          }
        });

        if (error) {
          console.error("Error fetching Inmeta events:", error);
          toast({
            title: "Erro ao buscar eventos",
            description: "Não foi possível obter os eventos do Inmeta. Por favor, tente novamente mais tarde.",
            variant: "destructive",
          });
          return [];
        }

        console.log('Raw response from Inmeta API:', response);
        
        if (!response) {
          console.warn('No response data received');
          return [];
        }

        let events: InmetaEvent[] = [];

        // Verificar se a resposta tem a propriedade data
        if (response.data && Array.isArray(response.data)) {
          console.log('Found data array in response.data:', response.data);
          console.log('Sample complete event structure:', JSON.stringify(response.data[0], null, 2));
          events = response.data;
        }
        // Verificar se a própria resposta é um array
        else if (Array.isArray(response)) {
          console.log('Response is an array:', response);
          console.log('Sample complete event structure:', JSON.stringify(response[0], null, 2));
          events = response;
        }
        // Se chegou aqui, tentar acessar a propriedade eventos
        else if (response.eventos && Array.isArray(response.eventos)) {
          console.log('Found data in response.eventos:', response.eventos);
          console.log('Sample complete event structure:', JSON.stringify(response.eventos[0], null, 2));
          events = response.eventos;
        }
        else {
          console.warn('Unexpected response format:', response);
          return [];
        }

        // Filtrar eventos por tipo e local
        const validLocations = PROJECT_LOCATIONS[projectId] || [];
        
        // Log das datas dos eventos
        const eventDates = events.map(event => new Date(event.data));
        const minDate = new Date(Math.min(...eventDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...eventDates.map(d => d.getTime())));
        
        console.log('Event date range:', {
          requestedStartDate: startDate,
          requestedEndDate: endDate,
          actualFirstDate: minDate.toISOString(),
          actualLastDate: maxDate.toISOString(),
          totalEvents: events.length
        });

        const filteredEvents = events
          .filter(event => {
            const isValidType = event.tipo === 'ENTRADA' || event.tipo === 'ENTRADA_COM_PENDENCIAS';
            const isValidLocation = validLocations.includes(event.alvo._id);
            
            console.log('Event info:', {
              eventType: event.tipo,
              locationId: event.alvo._id,
              locationName: event.alvo.nome,
              validLocations,
              isValidType,
              isValidLocation
            });
            
            return isValidType && isValidLocation;
          })
          .map(event => ({
            tipo: event.tipo,
            data: event.data,
            nomePessoa: event.nomePessoa || '',
            cargoPessoa: event.cargoPessoa || '',
            vinculoColaborador: {
              empresa: event.vinculoColaborador?.empresa || ''
            },
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
        console.error("Error in useInmetaEvents:", error);
        toast({
          title: "Erro ao buscar eventos",
          description: "Ocorreu um erro ao buscar os eventos. Por favor, tente novamente mais tarde.",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: !!projectId,
    refetchInterval: 30000,
  });
};
