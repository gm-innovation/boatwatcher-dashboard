import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanies, useProjects } from '@/hooks/useSupabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Calendar, Clock, User, Building2 } from 'lucide-react';
import { format, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const PresenceReport = () => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');

  const { data: companies = [] } = useCompanies();

  const { data: workers = [] } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workers').select('id, name, company_id').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: presenceData = [], isLoading } = useQuery({
    queryKey: ['presence-report', startDate, endDate, selectedWorkerId, selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('access_logs')
        .select('*')
        .gte('timestamp', startOfDay(new Date(startDate)).toISOString())
        .lte('timestamp', endOfDay(new Date(endDate)).toISOString())
        .order('timestamp', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // Group by worker and date
      const grouped: Record<string, Record<string, { entries: Date[]; exits: Date[] }>> = {};
      
      data.forEach((log: any) => {
        const workerId = log.worker_id || 'unknown';
        const workerName = log.worker_name || 'Desconhecido';
        const dateKey = format(new Date(log.timestamp), 'yyyy-MM-dd');

        if (!grouped[workerId]) {
          grouped[workerId] = {};
        }
        if (!grouped[workerId][dateKey]) {
          grouped[workerId][dateKey] = { entries: [], exits: [] };
        }

        if (log.direction === 'entry' && log.access_status === 'granted') {
          grouped[workerId][dateKey].entries.push(new Date(log.timestamp));
        } else if (log.direction === 'exit' && log.access_status === 'granted') {
          grouped[workerId][dateKey].exits.push(new Date(log.timestamp));
        }
      });

      // Calculate hours for each worker/date
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
          
          // Apply filters
          if (selectedWorkerId !== 'all' && workerId !== selectedWorkerId) return;
          if (selectedCompanyId !== 'all' && worker?.company_id !== selectedCompanyId) return;

          results.push({
            workerId,
            workerName: worker?.name || 'Desconhecido',
            companyId: worker?.company_id,
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

      return results.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.workerName.localeCompare(b.workerName);
      });
    },
    enabled: !!startDate && !!endDate,
  });

  const handleExport = () => {
    const csvContent = [
      ['Data', 'Trabalhador', 'Empresa', 'Entrada', 'Saída', 'Total Horas'].join(','),
      ...presenceData.map(row => [
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

  const totalHoursAll = presenceData.reduce((sum, row) => sum + row.totalMinutes, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Relatório de Presença</CardTitle>
          <Button onClick={handleExport} disabled={presenceData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Trabalhador</Label>
            <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {workers.map(worker => (
                  <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

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
                {presenceData.map((row, index) => (
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
