import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanies } from '@/hooks/useSupabase';
import { useAccessLogs } from '@/hooks/useControlID';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Calendar, Clock, User, FileDown } from 'lucide-react';
import { exportReportPdf } from '@/utils/exportReportPdf';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PresenceReportProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

export const PresenceReport = ({ projectId, startDate, endDate }: PresenceReportProps) => {
  const { data: companies = [] } = useCompanies();
  const { data: accessLogs = [], isLoading } = useAccessLogs(projectId || null, startDate, endDate, 1000);

  const { data: workers = [] } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workers').select('id, name, company_id').order('name');
      if (error) throw error;
      return data;
    },
  });

  const presenceData = useMemo(() => {
    if (!accessLogs.length) return [];

    const grouped: Record<string, Record<string, { entries: Date[]; exits: Date[] }>> = {};

    accessLogs.forEach((log: any) => {
      const workerId = log.worker_id || 'unknown';
      const dateKey = format(new Date(log.timestamp), 'yyyy-MM-dd');

      if (!grouped[workerId]) grouped[workerId] = {};
      if (!grouped[workerId][dateKey]) grouped[workerId][dateKey] = { entries: [], exits: [] };

      if (log.direction === 'entry' && log.access_status === 'granted') {
        grouped[workerId][dateKey].entries.push(new Date(log.timestamp));
      } else if (log.direction === 'exit' && log.access_status === 'granted') {
        grouped[workerId][dateKey].exits.push(new Date(log.timestamp));
      }
    });

    const results: any[] = [];
    Object.entries(grouped).forEach(([workerId, dates]) => {
      Object.entries(dates).forEach(([date, times]) => {
        const firstEntry = times.entries.length > 0 ? Math.min(...times.entries.map(d => d.getTime())) : null;
        const lastExit = times.exits.length > 0 ? Math.max(...times.exits.map(d => d.getTime())) : null;

        let totalMinutes = 0;
        if (firstEntry && lastExit) {
          totalMinutes = differenceInMinutes(lastExit, firstEntry);
        }

        const worker = workers.find(w => w.id === workerId);

        results.push({
          workerId,
          workerName: worker?.name || 'Desconhecido',
          companyName: companies.find(c => c.id === worker?.company_id)?.name || '-',
          date,
          firstEntry: firstEntry ? new Date(firstEntry) : null,
          lastExit: lastExit ? new Date(lastExit) : null,
          totalMinutes,
          totalHours: Math.floor(totalMinutes / 60),
          remainingMinutes: totalMinutes % 60,
        });
      });
    });

    return results.sort((a, b) => a.date.localeCompare(b.date) || a.workerName.localeCompare(b.workerName));
  }, [accessLogs, workers, companies]);

  const totalHoursAll = presenceData.reduce((sum: number, row: any) => sum + row.totalMinutes, 0);

  const handleExport = () => {
    const csvContent = [
      ['Data', 'Trabalhador', 'Empresa', 'Entrada', 'Saída', 'Total Horas'].join(','),
      ...presenceData.map((row: any) => [
        format(new Date(row.date), 'dd/MM/yyyy'),
        row.workerName,
        row.companyName,
        row.firstEntry ? format(row.firstEntry, 'HH:mm') : '-',
        row.lastExit ? format(row.lastExit, 'HH:mm') : '-',
        `${row.totalHours}h ${row.remainingMinutes}m`,
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-presenca-${startDate}-${endDate}.csv`;
    link.click();
  };

  const handleExportPdf = () => {
    exportReportPdf({
      title: 'Relatório de Presença',
      subtitle: `Período: ${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`,
      columns: [
        { header: 'Data', key: 'data', width: 25 },
        { header: 'Trabalhador', key: 'trabalhador' },
        { header: 'Empresa', key: 'empresa' },
        { header: 'Entrada', key: 'entrada', width: 18, align: 'center' },
        { header: 'Saída', key: 'saida', width: 18, align: 'center' },
        { header: 'Total', key: 'total', width: 20, align: 'center' },
      ],
      data: presenceData.map((row: any) => ({
        data: format(new Date(row.date), 'dd/MM/yyyy'),
        trabalhador: row.workerName,
        empresa: row.companyName,
        entrada: row.firstEntry ? format(row.firstEntry, 'HH:mm') : '-',
        saida: row.lastExit ? format(row.lastExit, 'HH:mm') : '-',
        total: `${row.totalHours}h ${row.remainingMinutes}m`,
      })),
      filename: `relatorio-presenca-${startDate}-${endDate}.pdf`,
      summaryRows: [
        { label: 'Total registros', value: String(presenceData.length) },
        { label: 'Total horas', value: `${Math.floor(totalHoursAll / 60)}h ${totalHoursAll % 60}m` },
      ],
    });
  };

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Selecione um projeto para ver o relatório de presença</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Visão Geral de Presença</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportPdf} variant="outline" disabled={presenceData.length === 0}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button onClick={handleExport} disabled={presenceData.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{presenceData.length} registros</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Total: {Math.floor(totalHoursAll / 60)}h {totalHoursAll % 60}m
            </span>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : presenceData.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Trabalhador</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Empresa</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground">Entrada</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground">Saída</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {presenceData.map((row: any, index: number) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-3 text-sm">
                      {format(new Date(row.date), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="p-3 text-sm font-medium">{row.workerName}</td>
                    <td className="p-3 text-sm text-muted-foreground">{row.companyName}</td>
                    <td className="p-3 text-sm text-center">
                      {row.firstEntry ? format(row.firstEntry, 'HH:mm') : '-'}
                    </td>
                    <td className="p-3 text-sm text-center">
                      {row.lastExit ? format(row.lastExit, 'HH:mm') : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="secondary">
                        {row.totalHours}h {row.remainingMinutes}m
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum registro encontrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
