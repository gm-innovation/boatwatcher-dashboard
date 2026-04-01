import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccessLogs } from '@/hooks/useControlID';
import { useWorkers, useCompanies } from '@/hooks/useSupabase';
import { useJobFunctions } from '@/hooks/useJobFunctions';
import { FileText, Download, Search, Users } from 'lucide-react';
import { exportAccessLogsToPdf, exportAccessLogsToExcel } from '@/utils/exportReports';
import type { AccessLog } from '@/types/supabase';

interface ReportsListProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

interface UniqueWorker {
  workerId: string;
  code: number | null;
  name: string;
  document: string;
  companyId: string | null;
  companyName: string;
  jobFunction: string;
}

export const ReportsList = ({ projectId, startDate, endDate }: ReportsListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: accessLogs = [], isLoading: logsLoading } = useAccessLogs(projectId || null, startDate, endDate, 5000);
  const { data: workers = [], isLoading: workersLoading } = useWorkers();
  const { data: companies = [] } = useCompanies();
  const { data: jobFunctions = [] } = useJobFunctions();

  const isLoading = logsLoading || workersLoading;

  // Deduplicate: extract unique workers who had granted access
  const { uniqueWorkers, groupedByCompany } = useMemo(() => {
    const grantedLogs = accessLogs.filter(log => log.access_status === 'granted' && log.worker_id);
    const workerIdSet = new Set<string>();
    const workerMap = new Map<string, UniqueWorker>();

    for (const log of grantedLogs) {
      const wId = log.worker_id!;
      if (workerIdSet.has(wId)) continue;
      workerIdSet.add(wId);

      const worker = workers.find(w => w.id === wId);
      const companyId = worker?.company_id || null;
      const company = companyId ? companies.find(c => c.id === companyId) : null;
      const jf = worker?.job_function_id ? jobFunctions.find(j => j.id === worker.job_function_id) : null;

      workerMap.set(wId, {
        workerId: wId,
        code: worker?.code ?? null,
        name: log.worker_name || worker?.name || 'Não identificado',
        document: log.worker_document || worker?.document_number || '-',
        companyId,
        companyName: company?.name || 'Sem empresa',
        jobFunction: jf?.name || worker?.role || '-',
      });
    }

    const allWorkers = Array.from(workerMap.values());

    // Group by company
    const grouped = new Map<string, { companyName: string; workers: UniqueWorker[] }>();
    for (const w of allWorkers) {
      const key = w.companyId || '__none__';
      if (!grouped.has(key)) {
        grouped.set(key, { companyName: w.companyName, workers: [] });
      }
      grouped.get(key)!.workers.push(w);
    }

    // Sort workers inside each group by code
    for (const group of grouped.values()) {
      group.workers.sort((a, b) => (a.code ?? 9999) - (b.code ?? 9999));
    }

    return { uniqueWorkers: allWorkers, groupedByCompany: grouped };
  }, [accessLogs, workers, companies, jobFunctions]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedByCompany;

    const search = searchTerm.toLowerCase();
    const filtered = new Map<string, { companyName: string; workers: UniqueWorker[] }>();

    for (const [key, group] of groupedByCompany) {
      const matchingWorkers = group.workers.filter(w =>
        w.name.toLowerCase().includes(search) ||
        w.document.toLowerCase().includes(search) ||
        w.companyName.toLowerCase().includes(search) ||
        w.jobFunction.toLowerCase().includes(search)
      );
      if (matchingWorkers.length > 0) {
        filtered.set(key, { companyName: group.companyName, workers: matchingWorkers });
      }
    }

    return filtered;
  }, [groupedByCompany, searchTerm]);

  const filteredTotal = useMemo(() => {
    let count = 0;
    for (const group of filteredGroups.values()) count += group.workers.length;
    return count;
  }, [filteredGroups]);

  const handleExportPdf = () => {
    // Re-use existing function with the raw granted logs
    const grantedLogs = accessLogs.filter(log => log.access_status === 'granted');
    exportAccessLogsToPdf(grantedLogs, 'Relatório de Trabalhadores', startDate, endDate);
  };

  const handleExportExcel = () => {
    const grantedLogs = accessLogs.filter(log => log.access_status === 'granted');
    exportAccessLogsToExcel(grantedLogs, 'Relatório de Trabalhadores', startDate, endDate);
  };

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Selecione um projeto para ver os trabalhadores com acesso</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF, empresa, função..."
              className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="gap-1 whitespace-nowrap">
            <Users className="h-3 w-3" />
            {filteredTotal} trabalhadores
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button size="sm" className="gap-2" onClick={handleExportPdf}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTotal > 0 ? (
            <div className="divide-y">
              {Array.from(filteredGroups.entries()).map(([companyKey, group]) => (
                <div key={companyKey}>
                  {/* Company header */}
                  <div className="bg-muted/50 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {group.companyName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-sm">{group.companyName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({group.workers.length} {group.workers.length === 1 ? 'trabalhador' : 'trabalhadores'})
                      </span>
                    </div>
                  </div>

                  {/* Workers table */}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-16">Nº</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Nome</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Empresa</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">CPF</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Função</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.workers.map((worker) => (
                        <tr key={worker.workerId} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-4 py-2 text-sm font-mono text-muted-foreground">{worker.code ?? '-'}</td>
                          <td className="px-4 py-2 text-sm font-medium">{worker.name}</td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{worker.companyName}</td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{worker.document}</td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{worker.jobFunction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum trabalhador com acesso registrado no período</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
