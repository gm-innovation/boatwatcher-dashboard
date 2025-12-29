
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { startOfDay, subDays, subMonths, format } from "date-fns";

interface InmetaEvent {
  id: string;
  tipo: string;
  data: string;
  alvo: {
    id: string;
    nome: string;
  };
  agente: string;
  cpfPessoa: string;
  tipoPessoa: string;
  nomePessoa: string;
  cargoPessoa: string;
  observacoes: string;
  vinculoColaborador: {
    empresa: string;
  };
}

function getDateRange(period: string) {
  const endDate = new Date();
  let startDate: Date;

  switch (period) {
    case 'today':
      startDate = startOfDay(endDate);
      break;
    case 'yesterday':
      startDate = startOfDay(subDays(endDate, 1));
      endDate.setHours(0, 0, 0, 0);
      break;
    case '7days':
      startDate = subDays(endDate, 7);
      break;
    case '1month':
      startDate = subMonths(endDate, 1);
      break;
    case 'all':
      startDate = new Date(2020, 0, 1); // Uma data bem antiga para pegar todo o histórico
      break;
    default:
      startDate = subMonths(endDate, 6); // 6 meses por padrão
  }
  
  return {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd')
  };
}

export const useInmetaEvents = (alvoId?: string | null, period: string = '1month') => {
  return useQuery({
    queryKey: ["inmeta-events", alvoId, period],
    queryFn: async (): Promise<InmetaEvent[]> => {
      try {
        if (!alvoId) {
          return [];
        }

        const { startDate, endDate } = getDateRange(period);

        console.log('Buscando eventos Inmeta:', { startDate, endDate, alvoId });

        const { data, error } = await supabase.functions.invoke("inmeta-api", {
          method: "POST",
          body: JSON.stringify({
            action: "getAccessEvents",
            startDate,
            endDate,
            alvoId
          })
        });

        if (error) {
          console.error("Erro ao buscar eventos:", error);
          toast({
            title: "Erro ao buscar eventos",
            description: "Não foi possível obter os eventos do Inmeta. Por favor, tente novamente mais tarde.",
            variant: "destructive",
          });
          throw error;
        }

        if (!Array.isArray(data)) {
          console.error("Dados recebidos não são um array:", data);
          return [];
        }

        console.log('Eventos encontrados:', data);
        
        // Filtrar apenas eventos de entrada
        const entryEvents = data.filter(event => 
          event.tipo.toLowerCase().includes('entrada') || 
          event.tipo.toLowerCase().includes('pendência')
        );

        return entryEvents;
      } catch (error) {
        console.error("Erro em useInmetaEvents:", error);
        toast({
          title: "Erro ao buscar eventos",
          description: "Ocorreu um erro ao buscar os eventos do Inmeta. Por favor, tente novamente mais tarde.",
          variant: "destructive",
        });
        return [];
      }
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!alvoId,
  });
};
