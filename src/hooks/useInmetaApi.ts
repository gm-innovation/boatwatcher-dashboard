
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

interface InmetaProject {
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

export const useInmetaProjects = () => {
  return useQuery({
    queryKey: ["inmeta-projects"],
    queryFn: async (): Promise<InmetaProject[]> => {
      try {
        console.log('Fetching Inmeta projects...');
        const { data, error } = await supabase.functions.invoke("inmeta-api", {
          method: "POST",
          body: JSON.stringify({
            action: "getProjects"
          })
        });

        if (error) {
          console.error("Error fetching Inmeta projects:", error);
          toast({
            title: "Erro ao buscar obras",
            description: "Não foi possível obter as obras do Inmeta. Por favor, tente novamente mais tarde.",
            variant: "destructive",
          });
          throw error;
        }

        if (!Array.isArray(data)) {
          console.error("Invalid response format from Inmeta API:", data);
          return [];
        }

        console.log('Successfully fetched Inmeta projects:', data);
        return data;
      } catch (error) {
        console.error("Error in useInmetaProjects:", error);
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

        console.log('Fetching Inmeta events for dates:', { startDate, endDate, alvoId });

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
          console.error("Error fetching Inmeta events:", error);
          toast({
            title: "Erro ao buscar eventos",
            description: "Não foi possível obter os eventos do Inmeta. Por favor, tente novamente mais tarde.",
            variant: "destructive",
          });
          throw error;
        }

        // Garantir que data é um array
        if (!Array.isArray(data)) {
          console.error("Received non-array data from API:", data);
          return [];
        }

        console.log('Successfully fetched Inmeta events:', data);
        return data;
      } catch (error) {
        console.error("Error in useInmetaEvents:", error);
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
