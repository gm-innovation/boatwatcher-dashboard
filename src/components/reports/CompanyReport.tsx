import { useMemo } from 'react';
import { useAccessLogs } from '@/hooks/useControlID';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { exportReportPdf } from '@/utils/exportReportPdf';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Building2, Users, Clock } from 'lucide-react';
import { differenceInMinutes, parseISO } from 'date-fns';

interface CompanyReportProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

interface CompanyData {
  name: string;
  totalWorkers: number;
  totalHours: number;
  entries: number;
}

export const CompanyReport = ({ projectId, startDate, endDate }: CompanyReportProps) => {
  const { data: accessLogs = [], isLoading } = useAccessLogs(projectId, startDate, endDate, 1000);

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

  const companyData = useMemo<CompanyData[]>(() => {
    if (!accessLogs.length || !workers.length) return [];

    // Build hybrid lookup
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

    // Group logs by resolved worker key
    const companyStats = new Map<string, { workers: Set<string>; entries: number; totalMinutes: number }>();

    const workerLogs = new Map<string, typeof accessLogs>();
    for (const log of accessLogs) {
      const w = findWorker(log);
      const key = w?.id || log.worker_id || log.worker_name || '';
      if (!key) continue;
      if (!workerLogs.has(key)) workerLogs.set(key, []);
      workerLogs.get(key)!.push(log);
    }

    workerLogs.forEach((logs, workerId) => {
      const companyName = workerCompanyMap.get(workerId) || 'Sem empresa';
      if (!companyStats.has(companyName)) {
        companyStats.set(companyName, { workers: new Set(), entries: 0, totalMinutes: 0 });
      }
      const stats = companyStats.get(companyName)!;
      stats.workers.add(workerId);

      // Sort chronologically
      const sorted = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Pair entries with exits
      let lastEntry: string | null = null;
      for (const log of sorted) {
        if (log.direction === 'entry') {
          stats.entries++;
          lastEntry = log.timestamp;
        } else if (log.direction === 'exit' && lastEntry) {
          const mins = differenceInMinutes(parseISO(log.timestamp), parseISO(lastEntry));
          if (mins > 0 && mins < 1440) { // max 24h sanity check
            stats.totalMinutes += mins;
          }
          lastEntry = null;
        }
      }
    });

    return Array.from(companyStats.entries()).map(([name, stats]) => ({
      name,
      totalWorkers: stats.workers.size,
      totalHours: Math.round(stats.totalMinutes / 60),
      entries: stats.entries,
    })).sort((a, b) => b.entries - a.entries);
  }, [accessLogs, workers]);

  const totalWorkers = companyData.reduce((sum, c) => sum + c.totalWorkers, 0);
  const totalEntries = companyData.reduce((sum, c) => sum + c.entries, 0);

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Selecione um projeto para ver o relatório por empresa</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Empresas</p>
                <p className="text-3xl font-bold">{companyData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Trabalhadores</p>
                <p className="text-3xl font-bold">{totalWorkers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Acessos</p>
                <p className="text-3xl font-bold">{totalEntries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" className="gap-2" onClick={() => {
          const csvContent = [
            ['Empresa', 'Trabalhadores', 'Horas', 'Acessos'].join(','),
            ...companyData.map(c => [c.name, c.totalWorkers, c.totalHours, c.entries].join(','))
          ].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `relatorio-empresa-${startDate}-${endDate}.csv`;
          link.click();
        }}>
          <Download className="h-4 w-4" />
          CSV
        </Button>
        <Button className="gap-2" onClick={() => {
          exportReportPdf({
            title: 'Relatório por Empresa',
            subtitle: `Período: ${startDate} a ${endDate}`,
            columns: [
              { header: 'Empresa', key: 'name' },
              { header: 'Trabalhadores', key: 'totalWorkers', width: 30, align: 'center' },
              { header: 'Horas', key: 'totalHours', width: 25, align: 'center' },
              { header: 'Acessos', key: 'entries', width: 25, align: 'center' },
            ],
            data: companyData,
            filename: `relatorio-empresa-${startDate}-${endDate}.pdf`,
            summaryRows: [
              { label: 'Empresas', value: String(companyData.length) },
              { label: 'Total trabalhadores', value: String(totalWorkers) },
              { label: 'Total acessos', value: String(totalEntries) },
            ],
          });
        }}>
          <Download className="h-4 w-4" />
          PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relatório por Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : companyData.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <table className="w-full">
                <thead className="sticky top-0 bg-card border-b">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Trabalhadores</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Horas Totais</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Entradas</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Média Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {companyData.map((company, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium">{company.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="secondary">{company.totalWorkers}</Badge>
                      </td>
                      <td className="p-4 text-center">{company.totalHours}h</td>
                      <td className="p-4 text-center">{company.entries}</td>
                      <td className="p-4 text-center">
                        {company.totalWorkers > 0 ? Math.round(company.totalHours / company.totalWorkers) : 0}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado de acesso encontrado no período</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
