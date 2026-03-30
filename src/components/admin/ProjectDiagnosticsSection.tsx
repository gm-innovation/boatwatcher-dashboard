import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Wifi,
  Bot,
  Users,
  FileWarning,
  Activity,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProjectDiagnosticData {
  projectId: string;
  projectName: string;
  clientName: string | null;
  devices: { total: number; online: number; offline: number; error: number };
  agents: { total: number; online: number; version: string | null; lastSync: string | null; pipelineMetrics: any };
  workersCount: number;
  expiringDocsCount: number;
  lastAccessLog: { workerName: string | null; timestamp: string; direction: string | null } | null;
  overallStatus: 'ok' | 'warning' | 'error';
}

interface ProjectDiagnosticsSectionProps {
  onDiagnosticsReady: (items: { ok: number; warning: number; error: number }) => void;
  refreshKey: number;
}

export const ProjectDiagnosticsSection = ({ onDiagnosticsReady, refreshKey }: ProjectDiagnosticsSectionProps) => {
  const [projectDiags, setProjectDiags] = useState<ProjectDiagnosticData[]>([]);
  const [loading, setLoading] = useState(true);
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());

  const toggleProject = (pid: string) => {
    setOpenProjects(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // Fetch all projects with client info
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, client_id, companies:client_id(name)')
          .order('name');

        if (!projects || projects.length === 0) {
          setProjectDiags([]);
          onDiagnosticsReady({ ok: 0, warning: 0, error: 0 });
          setLoading(false);
          return;
        }

        // Fetch all devices, agents, workers in parallel
        const [
          { data: allDevices },
          { data: allAgents },
          { data: allWorkers },
        ] = await Promise.all([
          supabase.from('devices').select('id, status, project_id, last_event_timestamp'),
          supabase.from('local_agents').select('id, status, project_id, version, last_sync_at, configuration'),
          supabase.from('workers').select('id, allowed_project_ids'),
        ]);

        // Fetch expiring docs
        const today = new Date();
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        const { data: expiringDocs } = await supabase
          .from('worker_documents')
          .select('id, worker_id')
          .lt('expiry_date', thirtyDays.toISOString().split('T')[0])
          .gt('expiry_date', today.toISOString().split('T')[0]);

        // Fetch last access log per device (just get recent ones)
        const maxTs = new Date(Date.now() + 2 * 60 * 1000).toISOString();
        const { data: recentLogs } = await supabase
          .from('access_logs')
          .select('id, timestamp, worker_name, direction, device_id')
          .lte('timestamp', maxTs)
          .order('timestamp', { ascending: false })
          .limit(100);

        // Build device->project map
        const deviceProjectMap = new Map<string, string>();
        (allDevices || []).forEach(d => {
          if (d.project_id) deviceProjectMap.set(d.id, d.project_id);
        });

        // Build worker->projects map
        const workerProjectsMap = new Map<string, string[]>();
        (allWorkers || []).forEach(w => {
          workerProjectsMap.set(w.id, (w.allowed_project_ids as string[]) || []);
        });

        // Build expiring docs per project via worker
        const expiringDocsByProject = new Map<string, number>();
        (expiringDocs || []).forEach(doc => {
          const workerProjects = doc.worker_id ? workerProjectsMap.get(doc.worker_id) : null;
          if (workerProjects) {
            workerProjects.forEach(pid => {
              expiringDocsByProject.set(pid, (expiringDocsByProject.get(pid) || 0) + 1);
            });
          }
        });

        // Build last access per project
        const lastAccessByProject = new Map<string, typeof recentLogs extends (infer T)[] ? T : never>();
        (recentLogs || []).forEach(log => {
          const pid = log.device_id ? deviceProjectMap.get(log.device_id) : null;
          if (pid && !lastAccessByProject.has(pid)) {
            lastAccessByProject.set(pid, log);
          }
        });

        let totalOk = 0, totalWarning = 0, totalError = 0;

        const results: ProjectDiagnosticData[] = projects.map((p: any) => {
          const pid = p.id;
          const clientName = p.companies?.name || null;

          // Devices
          const projDevices = (allDevices || []).filter(d => d.project_id === pid);
          const devOnline = projDevices.filter(d => d.status === 'online').length;
          const devOffline = projDevices.filter(d => d.status === 'offline').length;
          const devError = projDevices.filter(d => d.status === 'error').length;

          // Agents
          const projAgents = (allAgents || []).filter(a => a.project_id === pid);
          const agOnline = projAgents.filter(a => a.status === 'online').length;
          const agVersion = projAgents[0]?.version || null;
          const agLastSync = projAgents[0]?.last_sync_at || null;
          const agConfig = projAgents[0]?.configuration as Record<string, unknown> | null;
          const pipelineMetrics = agConfig?.pipelineMetrics || null;

          // Workers
          const workersCount = (allWorkers || []).filter(w => {
            const pids = (w.allowed_project_ids as string[]) || [];
            return pids.includes(pid);
          }).length;

          // Docs
          const expiringCount = expiringDocsByProject.get(pid) || 0;

          // Last access
          const lastLog = lastAccessByProject.get(pid);
          const lastAccessLog = lastLog
            ? { workerName: lastLog.worker_name, timestamp: lastLog.timestamp, direction: lastLog.direction }
            : null;

          // Overall status
          let overallStatus: 'ok' | 'warning' | 'error' = 'ok';
          if (devError > 0) overallStatus = 'error';
          else if (devOffline > 0 || expiringCount > 0 || projAgents.length === 0) overallStatus = 'warning';

          if (overallStatus === 'ok') totalOk++;
          else if (overallStatus === 'warning') totalWarning++;
          else totalError++;

          return {
            projectId: pid,
            projectName: p.name,
            clientName,
            devices: { total: projDevices.length, online: devOnline, offline: devOffline, error: devError },
            agents: { total: projAgents.length, online: agOnline, version: agVersion, lastSync: agLastSync, pipelineMetrics },
            workersCount,
            expiringDocsCount: expiringCount,
            lastAccessLog,
            overallStatus,
          };
        });

        setProjectDiags(results);
        onDiagnosticsReady({ ok: totalOk, warning: totalWarning, error: totalError });
      } catch (err) {
        console.error('[ProjectDiagnostics] Error:', err);
        setProjectDiags([]);
        onDiagnosticsReady({ ok: 0, warning: 0, error: 0 });
      }
      setLoading(false);
    };

    run();
  }, [refreshKey]);

  const getStatusColor = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'warning': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'error': return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
  };

  const getStatusLabel = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok': return 'OK';
      case 'warning': return 'Atenção';
      case 'error': return 'Erro';
    }
  };

  return (
    <Card className="border-2 border-purple-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-purple-500" />
          Diagnóstico por Projeto
          <Badge variant="outline" className="ml-auto">
            {projectDiags.length} projeto(s)
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando diagnósticos por projeto...</p>
        ) : projectDiags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {projectDiags.map(pd => {
              const isOpen = openProjects.has(pd.projectId);
              return (
                <Collapsible key={pd.projectId} open={isOpen} onOpenChange={() => toggleProject(pd.projectId)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors cursor-pointer">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <div className="flex-1 text-left">
                        <span className="font-medium text-sm">{pd.projectName}</span>
                        {pd.clientName && (
                          <span className="text-xs text-muted-foreground ml-2">— {pd.clientName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{pd.devices.total} disp</span>
                        <span>•</span>
                        <span>{pd.agents.total} agente(s)</span>
                        <span>•</span>
                        <span>{pd.workersCount} trab</span>
                      </div>
                      <Badge className={getStatusColor(pd.overallStatus)}>
                        {getStatusLabel(pd.overallStatus)}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-7 mt-2 mb-3 space-y-3 p-4 rounded-lg border bg-muted/30">
                      {/* Devices */}
                      <div className="flex items-start gap-3">
                        <Wifi className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Dispositivos</p>
                          {pd.devices.total === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhum dispositivo vinculado</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {pd.devices.online}/{pd.devices.total} online
                              {pd.devices.offline > 0 && <span className="text-yellow-500"> • {pd.devices.offline} offline</span>}
                              {pd.devices.error > 0 && <span className="text-red-500"> • {pd.devices.error} com erro</span>}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Agent */}
                      <div className="flex items-start gap-3">
                        <Bot className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Agente Local</p>
                          {pd.agents.total === 0 ? (
                            <p className="text-xs text-yellow-500">Nenhum agente configurado</p>
                          ) : (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p>
                                {pd.agents.online}/{pd.agents.total} online
                                {pd.agents.version && <span> • v{pd.agents.version}</span>}
                              </p>
                              {pd.agents.lastSync && (
                                <p>Última sync: {new Date(pd.agents.lastSync).toLocaleString()}</p>
                              )}
                              {pd.agents.pipelineMetrics && (
                                <p>
                                  Pipeline: {(pd.agents.pipelineMetrics as any).capturedEventsCount ?? 0} capturados
                                  {(pd.agents.pipelineMetrics as any).unsyncedLogsCount > 0 && (
                                    <span className="text-yellow-500"> • {(pd.agents.pipelineMetrics as any).unsyncedLogsCount} pendentes</span>
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Workers */}
                      <div className="flex items-start gap-3">
                        <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Trabalhadores</p>
                          <p className="text-xs text-muted-foreground">{pd.workersCount} autorizados neste projeto</p>
                        </div>
                      </div>

                      {/* Expiring Docs */}
                      <div className="flex items-start gap-3">
                        <FileWarning className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Documentos a Vencer (30 dias)</p>
                          <p className={`text-xs ${pd.expiringDocsCount > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                            {pd.expiringDocsCount > 0
                              ? `${pd.expiringDocsCount} documento(s) vencendo`
                              : 'Nenhum documento próximo do vencimento'}
                          </p>
                        </div>
                      </div>

                      {/* Last Access */}
                      <div className="flex items-start gap-3">
                        <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Último Acesso</p>
                          {pd.lastAccessLog ? (
                            <p className="text-xs text-muted-foreground">
                              {pd.lastAccessLog.workerName || 'Sem nome'} — {pd.lastAccessLog.direction || '?'} — {new Date(pd.lastAccessLog.timestamp).toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Nenhum registro</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
