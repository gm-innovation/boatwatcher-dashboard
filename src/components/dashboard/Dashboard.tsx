import { useState, useCallback } from 'react';
import { useProjectById, useWorkersOnBoard, useCompaniesOnBoard } from '@/hooks/useSupabase';
import { ProjectInfoCard } from './ProjectInfoCard';
import { StatisticsCards } from './StatisticsCards';
import { WorkersOnBoardTable, WorkerOnBoard } from './WorkersOnBoardTable';
import { CompaniesOnBoardList } from './CompaniesOnBoardList';
import { RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

interface DashboardProps {
  projectId: string | null;
}

export const Dashboard = ({ projectId }: DashboardProps) => {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: project } = useProjectById(projectId);
  const { data: workersOnBoard = [], refetch: refetchWorkers } = useWorkersOnBoard(projectId);
  const companiesOnBoard = useCompaniesOnBoard(workersOnBoard);

  // Map workers to expected format
  const formattedWorkers: WorkerOnBoard[] = workersOnBoard.map((w: any) => ({
    id: w.id,
    name: w.name,
    location: w.location,
    role: w.role,
    company: w.company,
    entryTime: w.entryTime
  }));

  const handleRefresh = useCallback(() => {
    refetchWorkers();
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    setLastUpdate(new Date());
  }, [refetchWorkers, queryClient, projectId]);

  const handleExport = () => {
    // Export logic - pode ser expandido
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
      {/* Refresh Controls */}
      <div className="flex items-center justify-end gap-4">
        <span className="text-sm text-muted-foreground">
          Atualizado: {format(lastUpdate, 'HH:mm:ss')}
        </span>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="gap-2"
        >
          {autoRefresh ? (
            <ToggleRight className="h-5 w-5 text-primary" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
          )}
          Auto
        </Button>
      </div>

      {/* Project Info Card */}
      <ProjectInfoCard project={project || null} />

      {/* Statistics Cards */}
      <StatisticsCards
        crewSize={project?.crew_size || 0}
        workersOnBoard={formattedWorkers.length}
        companiesOnBoard={companiesOnBoard.length}
      />

      {/* Workers Table and Companies List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[400px]">
        <div className="lg:col-span-2">
          <WorkersOnBoardTable 
            workers={formattedWorkers}
            onExport={handleExport}
          />
        </div>
        <div className="lg:col-span-1">
          <CompaniesOnBoardList companies={companiesOnBoard} />
        </div>
      </div>
    </div>
  );
};