import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Wifi, WifiOff, Server, AlertTriangle, CheckCircle2, Clock, Activity,
  RefreshCw, Monitor, Radio, ShieldAlert, BarChart3
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const REFRESH_INTERVAL = 30000;

const isAgentOnline = (agent: { status: string; last_seen_at: string | null }) => {
  if (agent.status !== 'online') return false;
  if (!agent.last_seen_at) return true;
  return new Date(agent.last_seen_at).getTime() > Date.now() - 60000;
};

type ProjectWithClient = {
  id: string;
  name: string;
  status: string | null;
  location: string | null;
  companies: { name: string; logo_url_light: string | null } | null;
};

export function ConnectivityDashboard() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ['monitoring-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, status, location, companies!client_id(name, logo_url_light)')
        .order('name');
      return (data || []) as unknown as ProjectWithClient[];
    },
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: devices = [], refetch: refetchDevices } = useQuery({
    queryKey: ['monitoring-devices'],
    queryFn: async () => {
      const { data } = await supabase.from('devices').select('*');
      return data || [];
    },
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: agents = [], refetch: refetchAgents } = useQuery({
    queryKey: ['monitoring-agents'],
    queryFn: async () => {
      const { data } = await supabase.from('local_agents').select('*');
      return data || [];
    },
    refetchInterval: REFRESH_INTERVAL,
  });

  const handleRefresh = () => {
    refetchProjects();
    refetchDevices();
    refetchAgents();
    setLastRefresh(new Date());
  };

  // Group by project
  const devicesByProject = useMemo(() => {
    const map: Record<string, typeof devices> = {};
    for (const d of devices) {
      const pid = d.project_id || '_unassigned';
      if (!map[pid]) map[pid] = [];
      map[pid].push(d);
    }
    return map;
  }, [devices]);

  const agentsByProject = useMemo(() => {
    const map: Record<string, typeof agents> = {};
    for (const a of agents) {
      const pid = a.project_id || '_unassigned';
      if (!map[pid]) map[pid] = [];
      map[pid].push(a);
    }
    return map;
  }, [agents]);

  // Global stats
  const stats = useMemo(() => {
    const onlineDevices = devices.filter(d => d.status === 'online').length;
    const onlineAgents = agents.filter(isAgentOnline).length;
    const offlineDevices = devices.filter(d => d.status !== 'online').length;
    const offlineAgents = agents.filter(a => !isAgentOnline(a)).length;
    return {
      totalProjects: projects.length,
      totalDevices: devices.length,
      onlineDevices,
      offlineDevices,
      totalAgents: agents.length,
      onlineAgents,
      offlineAgents,
      alerts: offlineDevices + offlineAgents,
      healthPct: devices.length > 0 ? Math.round((onlineDevices / devices.length) * 100) : 100,
    };
  }, [projects, devices, agents]);

  // Health color
  const globalHealthColor = stats.healthPct === 100 ? 'bg-green-500' : stats.healthPct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  const globalHealthText = stats.healthPct === 100 ? 'Sistema Operacional' : stats.healthPct >= 50 ? 'Atenção Necessária' : 'Sistema Crítico';

  // Bar chart data
  const barChartData = useMemo(() => {
    return projects.map(p => {
      const pDevices = devicesByProject[p.id] || [];
      return {
        name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name,
        online: pDevices.filter(d => d.status === 'online').length,
        offline: pDevices.filter(d => d.status !== 'online').length,
      };
    });
  }, [projects, devicesByProject]);

  // Pie chart data
  const pieChartData = useMemo(() => [
    { name: 'Online', value: stats.onlineDevices, fill: 'hsl(var(--chart-2))' },
    { name: 'Offline', value: stats.offlineDevices, fill: 'hsl(var(--chart-5))' },
  ].filter(d => d.value > 0), [stats]);

  // Device table sorted offline first
  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return 1;
      if (a.status !== 'online' && b.status === 'online') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [devices]);

  // Project cards sorted by health (worst first)
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aDevices = devicesByProject[a.id] || [];
      const bDevices = devicesByProject[b.id] || [];
      const aHealth = aDevices.length > 0 ? aDevices.filter(d => d.status === 'online').length / aDevices.length : -1;
      const bHealth = bDevices.length > 0 ? bDevices.filter(d => d.status === 'online').length / bDevices.length : -1;
      return aHealth - bHealth;
    });
  }, [projects, devicesByProject]);

  // Alerts list
  const alerts = useMemo(() => {
    const items: { type: 'device' | 'agent'; name: string; project: string; detail: string }[] = [];
    for (const d of devices) {
      if (d.status !== 'online') {
        const proj = projects.find(p => p.id === d.project_id);
        items.push({
          type: 'device',
          name: d.name,
          project: proj?.name || 'Sem projeto',
          detail: d.last_event_timestamp
            ? `offline ${formatDistanceToNow(new Date(d.last_event_timestamp), { addSuffix: false, locale: ptBR })}`
            : 'nunca conectado',
        });
      }
    }
    for (const a of agents) {
      if (!isAgentOnline(a)) {
        const proj = projects.find(p => p.id === a.project_id);
        items.push({
          type: 'agent',
          name: a.name,
          project: proj?.name || 'Sem projeto',
          detail: a.last_seen_at
            ? `offline ${formatDistanceToNow(new Date(a.last_seen_at), { addSuffix: false, locale: ptBR })}`
            : 'nunca visto',
        });
      }
    }
    return items;
  }, [devices, agents, projects]);

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return '—';
    return projects.find(p => p.id === projectId)?.name || '—';
  };

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return '—';
    return agents.find(a => a.id === agentId)?.name || '—';
  };

  const barChartConfig = {
    online: { label: 'Online', color: 'hsl(var(--chart-2))' },
    offline: { label: 'Offline', color: 'hsl(var(--chart-5))' },
  };

  const pieChartConfig = {
    Online: { label: 'Online', color: 'hsl(var(--chart-2))' },
    Offline: { label: 'Offline', color: 'hsl(var(--chart-5))' },
  };

  return (
    <div className="space-y-6">
      {/* Global Health Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${globalHealthColor} animate-pulse`} />
          <div>
            <h2 className="text-xl font-bold">{globalHealthText}</h2>
            <p className="text-xs text-muted-foreground">
              Atualizado {formatDistanceToNow(lastRefresh, { addSuffix: true, locale: ptBR })}
              {' · Auto-refresh a cada 30s'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> Projetos</CardDescription>
            <CardTitle className="text-2xl">{stats.totalProjects}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">monitorados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Wifi className="h-3.5 w-3.5" /> Dispositivos</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className="text-green-500">{stats.onlineDevices}</span>
              <span className="text-muted-foreground text-base">/ {stats.totalDevices}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stats.healthPct} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{stats.healthPct}% online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Server className="h-3.5 w-3.5" /> Agentes</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className="text-green-500">{stats.onlineAgents}</span>
              <span className="text-muted-foreground text-base">/ {stats.totalAgents}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress
              value={stats.totalAgents > 0 ? Math.round((stats.onlineAgents / stats.totalAgents) * 100) : 100}
              className="h-2"
            />
          </CardContent>
        </Card>

        <Card className={stats.alerts > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" /> Alertas
            </CardDescription>
            <CardTitle className={`text-2xl ${stats.alerts > 0 ? 'text-destructive' : 'text-green-500'}`}>
              {stats.alerts}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.alerts > 0 ? 'requerem atenção' : 'tudo operacional'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      {(stats.totalDevices > 0 || projects.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Dispositivos por Projeto
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barChartData.length > 0 ? (
                <ChartContainer config={barChartConfig} className="h-[250px] w-full">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="online" stackId="a" fill="var(--color-online)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="offline" stackId="a" fill="var(--color-offline)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum projeto com dispositivos</p>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Distribuição Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {pieChartData.length > 0 ? (
                <ChartContainer config={pieChartConfig} className="h-[250px] w-full">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dispositivos</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Device Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Todos os Dispositivos
          </CardTitle>
          <CardDescription>{devices.length} dispositivos em {projects.length} projetos</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum dispositivo cadastrado</p>
          ) : (
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Agente</TableHead>
                    <TableHead>Último Evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDevices.map(device => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className={`w-2.5 h-2.5 rounded-full ${device.status === 'online' ? 'bg-green-500' : device.status === 'error' ? 'bg-red-500' : 'bg-muted-foreground/40'}`} />
                      </TableCell>
                      <TableCell className="font-medium">{device.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{device.controlid_ip_address}</TableCell>
                      <TableCell>{getProjectName(device.project_id)}</TableCell>
                      <TableCell>{getAgentName(device.agent_id)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {device.last_event_timestamp ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(device.last_event_timestamp), { addSuffix: true, locale: ptBR })}
                          </span>
                        ) : 'Nunca'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Cards Grid */}
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          Projetos
        </h3>
        {sortedProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedProjects.map(project => {
              const pDevices = devicesByProject[project.id] || [];
              const pAgents = agentsByProject[project.id] || [];
              const onlineCount = pDevices.filter(d => d.status === 'online').length;
              const health = pDevices.length === 0 ? 'none' : onlineCount === pDevices.length ? 'green' : onlineCount > 0 ? 'yellow' : 'red';
              const healthBadge = health === 'green'
                ? <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Operacional</Badge>
                : health === 'yellow'
                ? <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Parcial</Badge>
                : health === 'red'
                ? <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Crítico</Badge>
                : <Badge variant="outline" className="text-muted-foreground">Sem dispositivos</Badge>;

              const lastEvent = pDevices
                .filter(d => d.last_event_timestamp)
                .sort((a, b) => new Date(b.last_event_timestamp!).getTime() - new Date(a.last_event_timestamp!).getTime())[0];

              return (
                <Card key={project.id} className={
                  health === 'red' ? 'border-red-500/30' :
                  health === 'yellow' ? 'border-yellow-500/30' : ''
                }>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">{project.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {project.companies?.name || 'Sem cliente'}
                          {project.location ? ` · ${project.location}` : ''}
                        </CardDescription>
                      </div>
                      {healthBadge}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Devices mini list */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Dispositivos ({onlineCount}/{pDevices.length})
                      </p>
                      {pDevices.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Nenhum dispositivo</p>
                      ) : (
                        <div className="space-y-1">
                          {pDevices.map(d => (
                            <div key={d.id} className="flex items-center gap-2 text-xs">
                              <div className={`w-1.5 h-1.5 rounded-full ${d.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span>{d.name}</span>
                              <span className="text-muted-foreground font-mono">{d.controlid_ip_address}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Agent status */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Agente Local</p>
                      {pAgents.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Sem agente configurado</p>
                      ) : pAgents.map(a => {
                        const online = isAgentOnline(a);
                        return (
                          <div key={a.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span>{a.name}</span>
                              {a.version && <span className="text-muted-foreground">v{a.version}</span>}
                            </div>
                            <span className="text-muted-foreground">
                              {a.last_seen_at
                                ? formatDistanceToNow(new Date(a.last_seen_at), { addSuffix: true, locale: ptBR })
                                : 'nunca visto'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Last event */}
                    {lastEvent && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1 border-t border-border/50">
                        <Clock className="h-3 w-3" />
                        Último evento: {formatDistanceToNow(new Date(lastEvent.last_event_timestamp!), { addSuffix: true, locale: ptBR })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Alertas de Conectividade ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {alert.type === 'device' ? <WifiOff className="h-3.5 w-3.5 text-destructive" /> : <Server className="h-3.5 w-3.5 text-destructive" />}
                    <span className="font-medium">{alert.name}</span>
                    <span className="text-muted-foreground">({alert.project})</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{alert.detail}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All clear */}
      {alerts.length === 0 && stats.totalDevices > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4 flex items-center justify-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Todos os dispositivos e agentes estão operacionais</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
