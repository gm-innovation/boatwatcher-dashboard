import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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
      const { data, error } = await supabase.functions.invoke("inmeta-api", {
        method: "GET",
      });

      if (error) {
        console.error("Error fetching Inmeta events:", error);
        throw error;
      }

      return data || [];
    },
  });
};