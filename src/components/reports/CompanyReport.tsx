import { useState, useMemo } from 'react';
import { useAccessLogs } from '@/hooks/useControlID';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportCompanyReportPdf } from '@/utils/exportReportPdf';
import { loadImageAsDataUrl } from '@/utils/exportWorkerReportPdf';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import { Badge } from '@/components/ui/badge';
import { Download, Building2, Search } from 'lucide-react';
import { differenceInMinutes, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CompanyReportProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

interface CompanyData {
  name: string;
  totalWorkers: number;
  onBoardNow: number;
  firstEntry: Date | null;
  lastExit: Date | null;
  allExited: boolean;
  totalMinutes: number;
  dayWorkers: number;
  nightWorkers: number;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function classifyShift(hour: number): 'day' | 'night' {
  return hour >= 5 && hour <= 18 ? 'day' : 'night';
}

export const CompanyReport = ({ projectId, startDate, endDate }: CompanyReportProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: accessLogs = [], isLoading } = useAccessLogs(projectId, startDate, endDate, 1000);
  const { data: systemLogoSetting } = useSystemSetting('system_logo');

  const { data: project } = useQuery({
    queryKey: ['project-for-company-report', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, location, client_id, companies(id, name, logo_url_light)')
        .eq('id', projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ['workers-with-companies-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('id, name, company:companies(id, name)');
      if (error) throw error;
      return data;
    },
  });

  const clientLogoUrl = project?.companies && typeof project.companies === 'object' && 'logo_url_light' in project.companies
    ? (project.companies as any).logo_url_light : null;

  const companyData = useMemo<CompanyData[]>(() => {
    if (!accessLogs.length || !workers.length) return [];

    const workerById = new Map(workers.map((w: any) => [w.id, w]));
    const workerByName = new Map(workers.map((w: any) => [w.name?.toLowerCase().trim(), w]));

    const findWorker = (log: any) => {
      if (log.worker_id && workerById.has(log.worker_id)) return workerById.get(log.worker_id)!;
      if (log.worker_name) return workerByName.get(log.worker_name.toLowerCase().trim()) || null;
      return null;
    };

    const getCompanyName = (w: any) => {
      if (!w) return 'Sem empresa';
      const comp = w.company && typeof w.company === 'object' && 'name' in w.company
        ? (w.company as { name: string }).name : 'Sem empresa';
      return comp;
    };

    // Group logs by worker
    const workerLogs = new Map<string, typeof accessLogs>();
    for (const log of accessLogs) {
      const w = findWorker(log);
      const key = w?.id || log.worker_id || log.worker_name || '';
      if (!key) continue;
      if (!workerLogs.has(key)) workerLogs.set(key, []);
      workerLogs.get(key)!.push(log);
    }

    const companyStats = new Map<string, {
      workers: Set<string>;
      onBoardNow: number;
      firstEntry: Date | null;
      lastExit: Date | null;
      totalMinutes: number;
      dayWorkers: number;
      nightWorkers: number;
      workerExitStatus: Map<string, boolean>;
    }>();

    workerLogs.forEach((logs, workerId) => {
      const worker = workerById.get(workerId) || null;
      const companyName = getCompanyName(worker);
      if (!companyStats.has(companyName)) {
        companyStats.set(companyName, {
          workers: new Set(),
          onBoardNow: 0,
          firstEntry: null,
          lastExit: null,
          totalMinutes: 0,
          dayWorkers: 0,
          nightWorkers: 0,
          workerExitStatus: new Map(),
        });
      }
      const stats = companyStats.get(companyName)!;
      stats.workers.add(workerId);

      const sorted = [...logs]
        .filter(l => l.access_status === 'granted' && (l.direction === 'entry' || l.direction === 'exit'))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (sorted.length === 0) return;

      // First entry for this worker
      const firstEntryLog = sorted.find(l => l.direction === 'entry');
      if (firstEntryLog) {
        const entryDate = new Date(firstEntryLog.timestamp);
        if (!stats.firstEntry || entryDate < stats.firstEntry) {
          stats.firstEntry = entryDate;
        }
        // Classify shift
        const shift = classifyShift(entryDate.getHours());
        if (shift === 'day') stats.dayWorkers++;
        else stats.nightWorkers++;
      }

      // Check if worker is on board (last action = entry)
      const lastLog = sorted[sorted.length - 1];
      const isOnBoard = lastLog.direction === 'entry';
      stats.workerExitStatus.set(workerId, !isOnBoard);
      if (isOnBoard) stats.onBoardNow++;

      // Track last exit for this worker
      const exitLogs = sorted.filter(l => l.direction === 'exit');
      if (exitLogs.length > 0) {
        const lastExitDate = new Date(exitLogs[exitLogs.length - 1].timestamp);
        if (!stats.lastExit || lastExitDate > stats.lastExit) {
          stats.lastExit = lastExitDate;
        }
      }
    });

    return Array.from(companyStats.entries()).map(([name, stats]) => {
      const allExited = stats.onBoardNow === 0;
      const endTime = allExited ? stats.lastExit : new Date();
      const totalMinutes = stats.firstEntry && endTime
        ? differenceInMinutes(endTime, stats.firstEntry)
        : 0;
      return {
        name,
        totalWorkers: stats.workers.size,
        onBoardNow: stats.onBoardNow,
        firstEntry: stats.firstEntry,
        lastExit: stats.lastExit,
        allExited,
        totalMinutes: Math.max(0, totalMinutes),
        dayWorkers: stats.dayWorkers,
        nightWorkers: stats.nightWorkers,
      };
    }).sort((a, b) => b.totalWorkers - a.totalWorkers);
  }, [accessLogs, workers]);

  const filtered = useMemo(() => {
    if (!searchTerm) return companyData;
    return companyData.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [companyData, searchTerm]);

  const totalWorkers = companyData.reduce((sum, c) => sum + c.totalWorkers, 0);
  const totalOnBoard = companyData.reduce((sum, c) => sum + c.onBoardNow, 0);
  const totalDay = companyData.reduce((sum, c) => sum + c.dayWorkers, 0);
  const totalNight = companyData.reduce((sum, c) => sum + c.nightWorkers, 0);

  const handleExportCsv = () => {
    const csvContent = [
      ['Empresa', 'Funcionários', 'A Bordo', 'Entrada', 'Saída', 'Permanência'].join(','),
      ...filtered.map(c => [
        c.name,
        c.totalWorkers,
        c.onBoardNow,
        c.firstEntry ? format(c.firstEntry, 'dd/MM/yyyy HH:mm') : '-',
        c.allExited ? (c.lastExit ? format(c.lastExit, 'dd/MM/yyyy HH:mm') : 'Todos saíram') : 'A bordo',
        formatDuration(c.totalMinutes),
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-empresa-${startDate}-${endDate}.csv`;
    link.click();
  };

  const handleExportPdf = async () => {
    let clientLogoDataUrl: string | undefined;
    let systemLogoDataUrl: string | undefined;

    if (clientLogoUrl) {
      const loaded = await loadImageAsDataUrl(clientLogoUrl);
      if (loaded) clientLogoDataUrl = loaded;
    }

    const sysLogoUrl = systemLogoSetting?.value && typeof systemLogoSetting.value === 'object'
      ? (systemLogoSetting.value as any).light_url || (systemLogoSetting.value as any).url
      : null;
    if (sysLogoUrl) {
      const loaded = await loadImageAsDataUrl(sysLogoUrl);
      if (loaded) systemLogoDataUrl = loaded;
    }

    exportCompanyReportPdf({
      companies: filtered,
      startDate,
      endDate,
      projectName: project?.name,
      projectLocation: project?.location || undefined,
      clientLogoDataUrl,
      systemLogoDataUrl,
    });
  };

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Selecione um projeto para ver o relatório por empresa</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Title + Client Logo */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">Tempo de Trabalho por Empresa</h2>
        {clientLogoUrl && (
          <img src={clientLogoUrl} alt="Logo do cliente" className="h-8 object-contain" />
        )}
      </div>

      {/* Search + Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={handleExportPdf}>
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <ScrollArea className="h-[500px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Empresa</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground">Funcionários</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground">Entrada</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground">Saída</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground">Permanência</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((company, index) => (
                  <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{company.name}</span>
                        {company.onBoardNow > 0 && (
                          <Badge className="border border-green-500 text-green-600 bg-green-50 hover:bg-green-100 text-[10px] px-1.5 py-0">
                            {company.onBoardNow} a bordo
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-semibold">{company.totalWorkers}</span>
                    </td>
                    <td className="p-3 text-center text-sm">
                      {company.firstEntry
                        ? format(company.firstEntry, "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : '-'}
                    </td>
                    <td className="p-3 text-center">
                      {company.allExited ? (
                        <span className="text-sm text-muted-foreground">
                          {company.lastExit ? format(company.lastExit, "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Todos saíram'}
                        </span>
                      ) : (
                        <Badge className="border border-green-500 text-green-600 bg-transparent hover:bg-green-50 text-[10px] px-1.5 py-0">
                          A bordo
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`font-mono text-xs ${company.onBoardNow > 0 ? 'border-green-500 text-green-600 bg-green-50' : ''}`}>
                        {formatDuration(company.totalMinutes)}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {/* TOTAL row */}
                <tr className="bg-muted/50 font-semibold border-t-2">
                  <td className="p-3">TOTAL</td>
                  <td className="p-3 text-center">{totalWorkers}</td>
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center text-[11px] leading-tight">
                      <span className="text-red-500 font-bold">Diurno: {totalDay}</span>
                      <span className="text-muted-foreground">Noturno: {totalNight}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {totalOnBoard > 0 && (
                      <Badge className="border border-green-500 text-green-600 bg-green-50 hover:bg-green-100 text-xs">
                        A bordo agora: {totalOnBoard}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-center">—</td>
                </tr>
              </tbody>
            </table>
          </ScrollArea>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado de acesso encontrado no período</p>
        </div>
      )}
    </div>
  );
};
