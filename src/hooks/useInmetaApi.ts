import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

interface InmetaEvent {
  id: string;
  name: string;
  role: string;
  arrival_time: string;
  photo_url: string;
  vinculoColaborador: {
    empresa: string;
  };
}

export const useInmetaEvents = () => {
  return useQuery({
    queryKey: ["inmeta-events"],
    queryFn: async (): Promise<InmetaEvent[]> => {
      try {
        const today = new Date();
        const startDate = today.toISOString().split('T')[0];
        const endDate = today.toISOString().split('T')[0];

        console.log('Fetching Inmeta events for dates:', { startDate, endDate });

        const { data, error } = await supabase.functions.invoke("inmeta-api", {
          method: "POST",
          body: {
            action: "getAccessEvents",
            startDate,
            endDate
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

        console.log('Successfully fetched Inmeta events:', data);
        
        // Garantir que data é um array
        if (!Array.isArray(data)) {
          console.warn('Inmeta events data is not an array:', data);
          return [];
        }

        return data.map(event => ({
          id: event.id || '',
          name: event.name || '',
          role: event.role || '',
          arrival_time: event.arrival_time || '',
          photo_url: event.photo_url || '',
          vinculoColaborador: {
            empresa: event.vinculoColaborador?.empresa || ''
          }
        }));
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
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
