/**
 * Paginated worker fetcher — fetches ALL workers from Supabase
 * using .range() loop to bypass the 1000-row PostgREST limit.
 */
import { supabase } from '@/integrations/supabase/client';
import type { CachedWorker } from '@/hooks/useOfflineAccessControl';

const PAGE_SIZE = 1000;

export async function fetchAllWorkers(companyFilter?: string | null): Promise<CachedWorker[]> {
  // 1. Fetch all workers with pagination
  let allRows: any[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('workers')
      .select('id, name, code, document_number, photo_url, company_id, status, job_function_id, role, rejection_reason, allowed_project_ids')
      .order('code', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (companyFilter && companyFilter !== 'all') {
      query = query.eq('company_id', companyFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);

    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }

  if (allRows.length === 0) return [];

  // 2. Fetch lookup tables (companies + job functions)
  const { data: companies } = await supabase.from('companies').select('id, name');
  const { data: jobFunctions } = await supabase.from('job_functions').select('id, name');

  const companiesMap = new Map((companies || []).map(c => [c.id, c.name]));
  const jobFunctionsMap = new Map((jobFunctions || []).map(j => [j.id, j.name]));

  // 3. Map to CachedWorker
  return allRows.map(w => ({
    id: w.id,
    name: w.name,
    code: w.code,
    document_number: w.document_number,
    photo_url: w.photo_url,
    company_id: w.company_id,
    company_name: w.company_id ? companiesMap.get(w.company_id) || undefined : undefined,
    job_function_name: w.job_function_id ? jobFunctionsMap.get(w.job_function_id) || undefined : undefined,
    status: w.status,
    role: w.role,
    rejection_reason: w.rejection_reason,
    allowed_project_ids: w.allowed_project_ids,
  }));
}
