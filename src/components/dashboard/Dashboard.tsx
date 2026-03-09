import { useEffect } from 'react';
import { useProjectById, useWorkersOnBoard, useCompaniesOnBoard } from '@/hooks/useSupabase';
import { useRealtimeAccessLogs } from '@/hooks/useRealtimeAccessLogs';
import { useProject } from '@/contexts/ProjectContext';
import { ProjectInfoCard } from './ProjectInfoCard';
import { StatisticsCards } from './StatisticsCards';
import { WorkersOnBoardTable, WorkerOnBoard } from './WorkersOnBoardTable';
import { CompaniesOnBoardList } from './CompaniesOnBoardList';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

interface DashboardProps {
  projectId: string | null;
}

export const Dashboard = ({ projectId }: DashboardProps) => {
  const queryClient = useQueryClient();
  const { autoRefresh, handleRefresh, registerRefreshCallback } = useProject();

  const { data: project } = useProjectById(projectId);
  const { data: workersOnBoard = [], refetch: refetchWorkers } = useWorkersOnBoard(projectId);
  const companiesOnBoard = useCompaniesOnBoard(workersOnBoard);

  // Register query invalidation as a refresh callback
  useEffect(() => {
    const unregister = registerRefreshCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['workers-on-board'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['access-logs'] });
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
