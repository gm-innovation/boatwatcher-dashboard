
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

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

function getDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6); // Últimos 6 meses
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

export const useInmetaEvents = (alvoId?: string) => {
  return useQuery({
    queryKey: ["inmeta-events", alvoId],
    queryFn: async (): Promise<InmetaEvent[]> => {
      try {
        // Se não houver alvoId selecionado, retornar array vazio
        if (!alvoId) {
          return [];
        }

        const { startDate, endDate } = getDateRange();

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
    enabled: !!alvoId, // Só executar a query quando houver um alvoId
  });
};
