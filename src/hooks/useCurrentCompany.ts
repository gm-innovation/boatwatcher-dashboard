import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usesLocalServer } from '@/lib/runtimeProfile';
import { localCompanies } from '@/lib/localServerProvider';

export interface CurrentCompanyAccess {
  companyId: string;
  company: any;
}

export const useCurrentCompany = (userId?: string) => {
  const isLocalRuntime = usesLocalServer();

  return useQuery({
    queryKey: ['current-company-access', userId, isLocalRuntime],
    queryFn: async (): Promise<CurrentCompanyAccess | null> => {
      if (!userId) return null;

      if (isLocalRuntime) {
        const data = await localCompanies.getCurrent(userId);
        if (!data?.company_id) return null;

        return {
          companyId: data.company_id,
          company: data.companies ?? null,
        };
      }

      const { data, error } = await supabase
        .from('user_companies')
        .select('company_id, companies(*)')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data?.company_id) return null;

      return {
        companyId: data.company_id,
        company: data.companies ?? null,
      };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
};
