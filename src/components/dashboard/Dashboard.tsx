import { useState, useCallback } from 'react';
import { useProjectById, useWorkersOnBoard, useCompaniesOnBoard } from '@/hooks/useSupabase';
import { useRealtimeAccessLogs } from '@/hooks/useRealtimeAccessLogs';
import { useProject } from '@/contexts/ProjectContext';
import { ProjectInfoCard } from './ProjectInfoCard';
import { StatisticsCards } from './StatisticsCards';
import { WorkersOnBoardTable, WorkerOnBoard } from './WorkersOnBoardTable';
import { CompaniesOnBoardList } from './CompaniesOnBoardList';
import { DeviceStatusPanel } from './DeviceStatusPanel';
import { RecentActivityFeed } from './RecentActivityFeed';
import { AlertsPanel } from './AlertsPanel';
import { QuickActionsPanel } from './QuickActionsPanel';
import { RefreshCw, ToggleLeft, ToggleRight, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

interface DashboardProps {
  projectId: string | null;
}

export const Dashboard = ({ projectId }: DashboardProps) => {
  const queryClient = useQueryClient();
  const { isFullscreenMode, toggleFullscreen } = useProject();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: project } = useProjectById(projectId);
  const { data: workersOnBoard = [], refetch: refetchWorkers } = useWorkersOnBoard(projectId);
  const companiesOnBoard = useCompaniesOnBoard(workersOnBoard);

  // Enable realtime updates
  useRealtimeAccessLogs({
    projectId,
    onNewLog: () => {
      if (autoRefresh) {
        refetchWorkers();
        setLastUpdate(new Date());
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

  const handleRefresh = useCallback(() => {
    refetchWorkers();
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['devices'] });
    queryClient.invalidateQueries({ queryKey: ['access-logs'] });
    setLastUpdate(new Date());
  }, [refetchWorkers, queryClient, projectId]);

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
      {/* Refresh Controls */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-4">
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
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="gap-2"
          >
            {isFullscreenMode ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {isFullscreenMode ? 'Sair' : 'Tela Cheia'}
          </Button>
        </div>
      </div>

      {/* Project Info Card */}
      <ProjectInfoCard project={project || null} />

      {/* Statistics Cards */}
      <StatisticsCards
        crewSize={project?.crew_size || 0}
        workersOnBoard={formattedWorkers.length}
        companiesOnBoard={companiesOnBoard.length}
      />

      {/* Quick Actions */}
      <QuickActionsPanel />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Workers Table - 2 columns */}
        <div className="xl:col-span-2">
          <WorkersOnBoardTable 
            workers={formattedWorkers}
            onExport={handleExport}
          />
        </div>

        {/* Companies List - 1 column */}
        <div className="xl:col-span-1">
          <CompaniesOnBoardList companies={companiesOnBoard} />
        </div>

        {/* Side Panel - 1 column */}
        <div className="xl:col-span-1 space-y-6">
          <DeviceStatusPanel />
          <AlertsPanel />
        </div>
      </div>

      {/* Recent Activity Feed - Full width */}
      <RecentActivityFeed projectId={projectId} />
    </div>
  );
};
