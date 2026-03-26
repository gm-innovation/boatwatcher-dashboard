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
import { Download, FileDown, Search, Users, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { exportReportPdf } from '@/utils/exportReportPdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkerTimeReportProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

interface RawLog {
  direction: string;
  device_name: string;
  timestamp: string;
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
  rawLogs: RawLog[];
}

export const WorkerTimeReport = ({ projectId, startDate, endDate }: WorkerTimeReportProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFunction, setSelectedFunction] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [onlyOnBoard, setOnlyOnBoard] = useState(false);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());

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
        .select('id, name, role, company_id, job_function_id, document_number, companies(id, name), job_functions(id, name)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo<WorkerTimeRow[]>(() => {
    if (!accessLogs.length) return [];

    const workerById = new Map<string, typeof workers[0]>();
    const workerByName = new Map<string, typeof workers[0]>();
    const workerByDoc = new Map<string, typeof workers[0]>();
    for (const w of workers) {
      workerById.set(w.id, w);
      if (w.name) workerByName.set(w.name.toLowerCase().trim(), w);
      if (w.document_number) workerByDoc.set(w.document_number.trim(), w);
    }

    const findWorker = (log: any) => {
      if (log.worker_id && workerById.has(log.worker_id)) return workerById.get(log.worker_id)!;
      if (log.worker_name) {
        const byName = workerByName.get(log.worker_name.toLowerCase().trim());
        if (byName) return byName;
      }
      if (log.worker_document) {
        const byDoc = workerByDoc.get(log.worker_document.trim());
        if (byDoc) return byDoc;
      }
      return null;
    };

    const resolveKey = (log: any): string => {
      const w = findWorker(log);
      if (w) return w.id;
      return log.worker_id || log.worker_name || '';
    };

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

      const grantedSorted = sorted.filter(l => l.access_status === 'granted' && (l.direction === 'entry' || l.direction === 'exit'));
      const alternating = normalizeAlternatingLogs(grantedSorted);

      const firstEntry = alternating.length > 0 && alternating[0].direction === 'entry' ? new Date(alternating[0].timestamp) : null;
      const lastLog = alternating.length > 0 ? alternating[alternating.length - 1] : null;
      const isOnBoard = lastLog?.direction === 'entry';
      const lastExit = lastLog?.direction === 'exit' ? new Date(lastLog.timestamp) : null;

      const firstEntryLog = alternating.find(l => l.direction === 'entry');
      const lastExitLog = [...alternating].reverse().find(l => l.direction === 'exit');
      let totalMinutes = 0;
      if (firstEntryLog && lastExitLog) {
        const diffMs = new Date(lastExitLog.timestamp).getTime() - new Date(firstEntryLog.timestamp).getTime();
        totalMinutes = diffMs > 0 ? Math.round(diffMs / 60000) : 0;
      }

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
        rawLogs: normalizeAlternatingLogs(
          sorted.filter(l => l.access_status === 'granted' && (l.direction === 'entry' || l.direction === 'exit'))
        ).map(l => ({
          direction: l.direction || 'unknown',
          device_name: l.device_name || '-',
          timestamp: l.timestamp,
        })),
      });
    });

    return results.sort((a, b) => a.companyName.localeCompare(b.companyName) || a.workerName.localeCompare(b.workerName));
  }, [accessLogs, workers]);

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

  const grouped = useMemo(() => {
    const map = new Map<string, WorkerTimeRow[]>();
    for (const row of filteredRows) {
      const key = row.companyName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries());
  }, [filteredRows]);

  const toggleExpanded = (workerId: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const formatTime = (date: Date | null) => date ? format(date, 'dd/MM HH:mm') : '-';
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
                <thead className="sticky top-0 bg-card border-b z-10">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground w-10"></th>
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
                    <CompanyGroup
                      key={companyName}
                      companyName={companyName}
                      rows={companyRows}
                      startIndex={filteredRows.indexOf(companyRows[0])}
                      formatTime={formatTime}
                      formatDuration={formatDuration}
                      expandedWorkers={expandedWorkers}
                      onToggleExpand={toggleExpanded}
                    />
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

/* ─── Helpers ─── */

function normalizeAlternatingLogs<T extends { direction: string }>(sorted: T[]): T[] {
  const result: T[] = [];
  let expectEntry = true;
  for (const log of sorted) {
    if (expectEntry && log.direction === 'entry') {
      result.push(log);
      expectEntry = false;
    } else if (!expectEntry && log.direction === 'exit') {
      result.push(log);
      expectEntry = true;
    }
  }
  return result;
}

function isDaytime(timestamp: string): boolean {
  const hour = new Date(timestamp).getHours();
  return hour >= 5 && hour <= 18;
}

function classifyLogs(rawLogs: RawLog[]) {
  const day: RawLog[] = [];
  const night: RawLog[] = [];
  for (const log of rawLogs) {
    if (isDaytime(log.timestamp)) day.push(log);
    else night.push(log);
  }
  return { day, night };
}

/* ─── Company Group ─── */

function CompanyGroup({ companyName, rows, startIndex, formatTime, formatDuration, expandedWorkers, onToggleExpand }: {
  companyName: string;
  rows: WorkerTimeRow[];
  startIndex: number;
  formatTime: (d: Date | null) => string;
  formatDuration: (m: number) => string;
  expandedWorkers: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <>
      <tr className="bg-muted/60">
        <td colSpan={8} className="p-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{companyName}</span>
            <Badge variant="secondary" className="ml-2">{rows.length}</Badge>
          </div>
        </td>
      </tr>
      {rows.map((row, i) => {
        const isExpanded = expandedWorkers.has(row.workerId);
        return (
          <WorkerRow
            key={row.workerId}
            row={row}
            index={startIndex + i + 1}
            isExpanded={isExpanded}
            onToggle={() => onToggleExpand(row.workerId)}
            formatTime={formatTime}
            formatDuration={formatDuration}
          />
        );
      })}
    </>
  );
}

/* ─── Worker Row ─── */

function WorkerRow({ row, index, isExpanded, onToggle, formatTime, formatDuration }: {
  row: WorkerTimeRow;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  formatTime: (d: Date | null) => string;
  formatDuration: (m: number) => string;
}) {
  const { day, night } = useMemo(() => classifyLogs(row.rawLogs), [row.rawLogs]);

  return (
    <>
      <tr className="border-b hover:bg-muted/30 cursor-pointer" onClick={onToggle}>
        <td className="p-3 text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="p-3 text-sm text-muted-foreground">{index}</td>
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
        <td className="p-3 text-sm text-center">
          {row.isOnBoard ? (
            <Badge className="bg-green-500/15 text-green-600 border-green-500/20 text-xs">A bordo</Badge>
          ) : formatTime(row.lastExit)}
        </td>
        <td className="p-3 text-center">
          {row.totalMinutes > 0 ? (
            <Badge variant="secondary">{formatDuration(row.totalMinutes)}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <ExpandedDetails row={row} dayLogs={day} nightLogs={night} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Expanded Details ─── */

function ExpandedDetails({ row, dayLogs, nightLogs }: {
  row: WorkerTimeRow;
  dayLogs: RawLog[];
  nightLogs: RawLog[];
}) {
  return (
    <div className="bg-muted/20 border-t border-b p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span><strong>Nome:</strong> {row.workerName}</span>
        <span><strong>Função:</strong> {row.role}</span>
        <span><strong>Empresa:</strong> {row.companyName}</span>
      </div>

      {/* Day / Night grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PeriodTable title="Período Diurno (05:00 - 18:59)" logs={dayLogs} />
        <PeriodTable title="Período Noturno (19:00 - 04:59)" logs={nightLogs} emptyMessage="Nenhum registro noturno." />
      </div>
    </div>
  );
}

/* ─── Period Table ─── */

function PeriodTable({ title, logs, emptyMessage }: {
  title: string;
  logs: RawLog[];
  emptyMessage?: string;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <Badge variant="secondary" className="text-xs">{logs.length} registros</Badge>
      </div>
      {logs.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Evento</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Dispositivo</th>
              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Data/Horário</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => {
              const isEntry = log.direction === 'entry';
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-1.5">
                    <Badge
                      className={
                        isEntry
                          ? 'bg-green-500/15 text-green-600 border-green-500/20 text-xs'
                          : 'bg-orange-500/15 text-orange-600 border-orange-500/20 text-xs'
                      }
                    >
                      {isEntry ? 'ENTRADA' : 'SAÍDA'}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{log.device_name}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground px-3 py-4 text-center">{emptyMessage || 'Nenhum registro.'}</p>
      )}
    </div>
  );
}
