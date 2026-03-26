import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanies } from '@/hooks/useSupabase';
import { useAccessLogs } from '@/hooks/useControlID';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileDown, Search, Users, Building2 } from 'lucide-react';
import { exportReportPdf } from '@/utils/exportReportPdf';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkerTimeReportProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

interface WorkerTimeRow {
  workerId: string;
  workerName: string;
  role: string;
  companyId: string;
  companyName: string;
  firstEntry: Date | null;
  lastExit: Date | null;
  totalMinutes: number;
  isOnBoard: boolean;
}

export const WorkerTimeReport = ({ projectId, startDate, endDate }: WorkerTimeReportProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFunction, setSelectedFunction] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [onlyOnBoard, setOnlyOnBoard] = useState(false);

  const { data: companies = [] } = useCompanies();
  const { data: accessLogs = [], isLoading } = useAccessLogs(projectId, startDate, endDate, 1000);

  const { data: jobFunctions = [] } = useQuery({
    queryKey: ['job-functions-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('job_functions').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: workers = [] } = useQuery({
    queryKey: ['workers-full-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('id, name, role, company_id, job_function_id, companies(id, name), job_functions(id, name)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo<WorkerTimeRow[]>(() => {
    if (!accessLogs.length) return [];

    // Build worker lookup maps for hybrid matching
    const workerById = new Map<string, typeof workers[0]>();
    const workerByName = new Map<string, typeof workers[0]>();
    const workerByDoc = new Map<string, typeof workers[0]>();
    for (const w of workers) {
      workerById.set(w.id, w);
      if (w.name) workerByName.set(w.name.toLowerCase().trim(), w);
    }

    const findWorker = (log: any) => {
      if (log.worker_id && workerById.has(log.worker_id)) return workerById.get(log.worker_id)!;
      if (log.worker_name) {
        const byName = workerByName.get(log.worker_name.toLowerCase().trim());
        if (byName) return byName;
      }
      if (log.worker_document) {
        const byDoc = workers.find(w => w.name?.toLowerCase().trim() === log.worker_name?.toLowerCase().trim());
        if (byDoc) return byDoc;
      }
      return null;
    };

    // Resolve canonical key per log (prefer worker.id for dedup)
    const resolveKey = (log: any): string => {
      const w = findWorker(log);
      if (w) return w.id;
      return log.worker_id || log.worker_name || '';
    };

    // Group logs by resolved worker key
    const workerLogs = new Map<string, typeof accessLogs>();
    for (const log of accessLogs) {
      const key = resolveKey(log);
      if (!key) continue;
      if (!workerLogs.has(key)) workerLogs.set(key, []);
      workerLogs.get(key)!.push(log);
    }

    const results: WorkerTimeRow[] = [];

    workerLogs.forEach((logs, key) => {
      const sorted = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const entries = sorted.filter(l => l.direction === 'entry' && l.access_status === 'granted');
      const exits = sorted.filter(l => l.direction === 'exit' && l.access_status === 'granted');

      const firstEntry = entries.length > 0 ? new Date(entries[0].timestamp) : null;
      const lastExit = exits.length > 0 ? new Date(exits[exits.length - 1].timestamp) : null;

      // "a bordo" = last granted log is an entry
      const lastLog = sorted[sorted.length - 1];
      const isOnBoard = lastLog?.direction === 'entry' && lastLog?.access_status === 'granted';

      let totalMinutes = 0;
      if (firstEntry && lastExit && lastExit > firstEntry) {
        totalMinutes = differenceInMinutes(lastExit, firstEntry);
      }

      // Find worker info via hybrid matching
      const worker = workerById.get(key) || findWorker(logs[0]);
      const companyObj = worker?.companies as any;
      const jobObj = worker?.job_functions as any;

      results.push({
        workerId: worker?.id || key,
        workerName: worker?.name || logs[0]?.worker_name || 'Desconhecido',
        role: jobObj?.name || worker?.role || '-',
        companyId: companyObj?.id || worker?.company_id || '',
        companyName: companyObj?.name || 'Sem empresa',
        firstEntry,
        lastExit: isOnBoard ? null : lastExit,
        totalMinutes,
        isOnBoard,
      });
    });

    return results.sort((a, b) => a.companyName.localeCompare(b.companyName) || a.workerName.localeCompare(b.workerName));
  }, [accessLogs, workers]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!row.workerName.toLowerCase().includes(s)) return false;
      }
      if (selectedCompany !== 'all' && row.companyId !== selectedCompany) return false;
      if (selectedFunction !== 'all') {
        const worker = workers.find(w => w.id === row.workerId);
        if (worker?.job_function_id !== selectedFunction) return false;
      }
      if (onlyOnBoard && !row.isOnBoard) return false;
      return true;
    });
  }, [rows, searchTerm, selectedCompany, selectedFunction, onlyOnBoard, workers]);

  // Group by company
  const grouped = useMemo(() => {
    const map = new Map<string, WorkerTimeRow[]>();
    for (const row of filteredRows) {
      const key = row.companyName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries());
  }, [filteredRows]);

  const formatTime = (date: Date | null) => date ? format(date, 'HH:mm') : '-';
  const formatDuration = (mins: number) => {
    if (mins <= 0) return '-';
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const handleExportCsv = () => {
    const csvContent = [
      ['Nº', 'Nome', 'Função', 'Empresa', 'Entrada', 'Saída', 'Tempo Total', 'A bordo'].join(','),
      ...filteredRows.map((row, i) => [
        i + 1,
        row.workerName,
        row.role,
        row.companyName,
        formatTime(row.firstEntry),
        formatTime(row.lastExit),
        formatDuration(row.totalMinutes),
        row.isOnBoard ? 'Sim' : 'Não',
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trabalhadores-${startDate}-${endDate}.csv`;
    link.click();
  };

  const handleExportPdf = () => {
    exportReportPdf({
      title: 'Tempo de Trabalho por Trabalhador',
      subtitle: `Período: ${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`,
      columns: [
        { header: 'Nº', key: 'num', width: 10, align: 'center' },
        { header: 'Nome', key: 'name' },
        { header: 'Função', key: 'role', width: 25 },
        { header: 'Empresa', key: 'company', width: 25 },
        { header: 'Entrada', key: 'entry', width: 18, align: 'center' },
        { header: 'Saída', key: 'exit', width: 18, align: 'center' },
        { header: 'Total', key: 'total', width: 18, align: 'center' },
      ],
      data: filteredRows.map((row, i) => ({
        num: String(i + 1),
        name: row.workerName + (row.isOnBoard ? ' (A bordo)' : ''),
        role: row.role,
        company: row.companyName,
        entry: formatTime(row.firstEntry),
        exit: formatTime(row.lastExit),
        total: formatDuration(row.totalMinutes),
      })),
      filename: `trabalhadores-${startDate}-${endDate}.pdf`,
      summaryRows: [
        { label: 'Total trabalhadores', value: String(filteredRows.length) },
        { label: 'A bordo', value: String(filteredRows.filter(r => r.isOnBoard).length) },
      ],
    });
  };

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Selecione um projeto para ver o relatório de trabalhadores</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar trabalhador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedFunction} onValueChange={setSelectedFunction}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas funções</SelectItem>
            {jobFunctions.map(jf => (
              <SelectItem key={jf.id} value={jf.id}>{jf.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="onboard"
            checked={onlyOnBoard}
            onCheckedChange={(v) => setOnlyOnBoard(!!v)}
          />
          <label htmlFor="onboard" className="text-sm font-medium cursor-pointer">a Bordo</label>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExportPdf}>
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredRows.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <table className="w-full">
                <thead className="sticky top-0 bg-card border-b">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground w-12">Nº</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Função</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Empresa</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Entrada</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Saída</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Tempo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(([companyName, companyRows]) => (
                    <CompanyGroup key={companyName} companyName={companyName} rows={companyRows} startIndex={filteredRows.indexOf(companyRows[0])} formatTime={formatTime} formatDuration={formatDuration} />
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum registro encontrado no período</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function CompanyGroup({ companyName, rows, startIndex, formatTime, formatDuration }: {
  companyName: string;
  rows: WorkerTimeRow[];
  startIndex: number;
  formatTime: (d: Date | null) => string;
  formatDuration: (m: number) => string;
}) {
  return (
    <>
      <tr className="bg-muted/60">
        <td colSpan={7} className="p-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{companyName}</span>
            <Badge variant="secondary" className="ml-2">{rows.length}</Badge>
          </div>
        </td>
      </tr>
      {rows.map((row, i) => (
        <tr key={row.workerId} className="border-b hover:bg-muted/30">
          <td className="p-3 text-sm text-muted-foreground">{startIndex + i + 1}</td>
          <td className="p-3 text-sm font-medium">
            <div className="flex items-center gap-2">
              {row.workerName}
              {row.isOnBoard && (
                <Badge className="bg-green-500/15 text-green-600 border-green-500/20 text-xs">
                  A bordo
                </Badge>
              )}
            </div>
          </td>
          <td className="p-3 text-sm text-muted-foreground">{row.role}</td>
          <td className="p-3 text-sm text-muted-foreground">{row.companyName}</td>
          <td className="p-3 text-sm text-center">{formatTime(row.firstEntry)}</td>
          <td className="p-3 text-sm text-center">{formatTime(row.lastExit)}</td>
          <td className="p-3 text-center">
            {row.totalMinutes > 0 ? (
              <Badge variant="secondary">{formatDuration(row.totalMinutes)}</Badge>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
