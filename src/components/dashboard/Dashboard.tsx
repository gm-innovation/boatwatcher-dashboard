import { useState, useEffect } from 'react';
import { useProjectById, useWorkersOnBoard, useCompaniesOnBoard, useLastAccessLog, type DateFilter } from '@/hooks/useSupabase';
import { useRealtimeAccessLogs } from '@/hooks/useRealtimeAccessLogs';
import { useProject } from '@/contexts/ProjectContext';
import { ProjectInfoCard } from './ProjectInfoCard';
import { StatisticsCards } from './StatisticsCards';
import { WorkersOnBoardTable, WorkerOnBoard } from './WorkersOnBoardTable';
import { CompaniesOnBoardList } from './CompaniesOnBoardList';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DashboardProps {
  projectId: string | null;
}

export const Dashboard = ({ projectId }: DashboardProps) => {
  const queryClient = useQueryClient();
  const { autoRefresh, handleRefresh, registerRefreshCallback } = useProject();
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  const { data: project } = useProjectById(projectId);
  const { data: workersOnBoard = [], refetch: refetchWorkers } = useWorkersOnBoard(projectId, dateFilter);
  const companiesOnBoard = useCompaniesOnBoard(workersOnBoard);
  const { data: lastEventTimestamp } = useLastAccessLog(projectId);

  // Register query invalidation as a refresh callback
  useEffect(() => {
    const unregister = registerRefreshCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['workers-on-board'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['access-logs'] });
      queryClient.invalidateQueries({ queryKey: ['last-access-log'] });
    });
    return unregister;
  }, [registerRefreshCallback, queryClient, projectId]);

  // Enable realtime updates
  useRealtimeAccessLogs({
    projectId,
    onNewLog: () => {
      if (autoRefresh) {
        refetchWorkers();
        handleRefresh();
      }
    }
  });

  // Map workers to expected format
  const formattedWorkers: WorkerOnBoard[] = workersOnBoard.map((w: any) => ({
    id: w.id,
    name: w.name,
    location: w.location,
    role: w.role,
    company: w.company,
    entryTime: w.entryTime
  }));

  const handleExport = () => {
    const csvContent = [
      ['Nº', 'Nome', 'Local', 'Função', 'Empresa', 'Entrada'].join(','),
      ...formattedWorkers.map((w, i) => 
        [i + 1, w.name, w.location || '', w.role || '', w.company, format(new Date(w.entryTime), 'HH:mm')].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trabalhadores-a-bordo-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Selecione um projeto para visualizar o dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Info Card */}
      <ProjectInfoCard project={project || null} />

      {/* Period Selector + Last Event Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="w-[180px]">
              <CalendarClock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {lastEventTimestamp ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            <span>Último evento: {format(new Date(lastEventTimestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Nenhum evento registrado</span>
          </div>
        )}
      </div>

      {/* Empty state message when no workers for period */}
      {formattedWorkers.length === 0 && lastEventTimestamp && dateFilter === 'today' && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Nenhum acesso registrado hoje. Último evento em{' '}
            <strong>{format(new Date(lastEventTimestamp), 'dd/MM/yyyy', { locale: ptBR })}</strong>.
            Tente selecionar um período maior.
          </span>
        </div>
      )}

      {/* Statistics Cards */}
      <StatisticsCards
        crewSize={project?.crew_size || 0}
        workersOnBoard={formattedWorkers.length}
        companiesOnBoard={companiesOnBoard.length}
      />

      {/* Workers Table + Companies List */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <WorkersOnBoardTable 
            workers={formattedWorkers}
            onExport={handleExport}
          />
        </div>
        <div className="xl:col-span-2">
          <CompaniesOnBoardList companies={companiesOnBoard} />
        </div>
      </div>
    </div>
  );
};
