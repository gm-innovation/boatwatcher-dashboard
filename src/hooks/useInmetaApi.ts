
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

interface InmetaObra {
  id: string;
  nome: string;
}

function getDateRange() {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 7); // Últimos 7 dias
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0]
  };
}

export const useInmetaObras = () => {
  return useQuery({
    queryKey: ["inmeta-obras"],
    queryFn: async (): Promise<InmetaObra[]> => {
      try {
        console.log('Buscando obras do Inmeta...');
        const { startDate, endDate } = getDateRange();
        
        const { data: events, error } = await supabase.functions.invoke("inmeta-api", {
          method: "POST",
          body: JSON.stringify({
            action: "getAccessEvents",
            startDate,
            endDate
          })
        });

        if (error) {
          console.error("Erro ao buscar eventos Inmeta:", error);
          toast({
            title: "Erro ao buscar obras",
            description: "Não foi possível obter as obras do Inmeta. Por favor, tente novamente mais tarde.",
            variant: "destructive",
          });
          throw error;
        }

        if (!Array.isArray(events)) {
          console.error("Formato de resposta inválido da API Inmeta:", events);
          return [];
        }

        // Extrair obras únicas dos eventos
        const obrasUnicas = new Map<string, InmetaObra>();
        events.forEach(event => {
          if (event.alvo?.id && event.alvo?.nome) {
            obrasUnicas.set(event.alvo.id, {
              id: event.alvo.id,
              nome: event.alvo.nome
            });
          }
        });

        const obras = Array.from(obrasUnicas.values());
        console.log('Obras encontradas:', obras);
        return obras;
      } catch (error) {
        console.error("Erro em useInmetaObras:", error);
        toast({
          title: "Erro ao buscar obras",
          description: "Ocorreu um erro ao buscar as obras do Inmeta. Por favor, tente novamente mais tarde.",
          variant: "destructive",
        });
        return [];
      }
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useInmetaEvents = (alvoId?: string) => {
  return useQuery({
    queryKey: ["inmeta-events", alvoId],
    queryFn: async (): Promise<InmetaEvent[]> => {
      try {
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
        return data;
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
  });
};
