import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Wifi, WifiOff, Server, AlertTriangle, CheckCircle2, Clock, Activity,
  RefreshCw, Monitor, Radio, ShieldAlert, BarChart3, Maximize2, Minimize2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const REFRESH_INTERVAL = 30000;
const COLOR_ONLINE = '#22c55e';
const COLOR_OFFLINE = '#ef4444';
const COLOR_PARTIAL = '#eab308';

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
  const [isMaximized, setIsMaximized] = useState(false);

  // Escape to exit fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) setIsMaximized(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMaximized]);

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
      agentPct: agents.length > 0 ? Math.round((onlineAgents / agents.length) * 100) : 100,
    };
  }, [projects, devices, agents]);

  const globalHealthColor = stats.healthPct === 100 ? COLOR_ONLINE : stats.healthPct >= 50 ? COLOR_PARTIAL : COLOR_OFFLINE;
  const globalHealthText = stats.healthPct === 100 ? 'Sistema Operacional' : stats.healthPct >= 50 ? 'Atenção Necessária' : 'Sistema Crítico';

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

  const pieChartData = useMemo(() => [
    { name: 'Online', value: stats.onlineDevices, fill: COLOR_ONLINE },
    { name: 'Offline', value: stats.offlineDevices, fill: COLOR_OFFLINE },
  ].filter(d => d.value > 0), [stats]);

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return 1;
      if (a.status !== 'online' && b.status === 'online') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [devices]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aDevices = devicesByProject[a.id] || [];
      const bDevices = devicesByProject[b.id] || [];
      const aHealth = aDevices.length > 0 ? aDevices.filter(d => d.status === 'online').length / aDevices.length : -1;
      const bHealth = bDevices.length > 0 ? bDevices.filter(d => d.status === 'online').length / bDevices.length : -1;
      return aHealth - bHealth;
    });
  }, [projects, devicesByProject]);

  const alertsList = useMemo(() => {
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
    online: { label: 'Online', color: COLOR_ONLINE },
    offline: { label: 'Offline', color: COLOR_OFFLINE },
  };

  const pieChartConfig = {
    Online: { label: 'Online', color: COLOR_ONLINE },
    Offline: { label: 'Offline', color: COLOR_OFFLINE },
  };

  const progressColor = (pct: number) =>
    pct >= 80 ? COLOR_ONLINE : pct >= 50 ? COLOR_PARTIAL : COLOR_OFFLINE;

  // ─── Shared sub-components ───

  const renderHeader = (compact = false) => (
    <div className={`flex items-center justify-between ${compact ? 'px-4 py-3 border-b border-border/50 bg-muted/50' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: globalHealthColor }} />
        <div>
          <h2 className={`${compact ? 'text-base' : 'text-xl'} font-bold`}>{globalHealthText}</h2>
          <p className="text-xs text-muted-foreground">
            Atualizado {formatDistanceToNow(lastRefresh, { addSuffix: true, locale: ptBR })}
            {' · Auto-refresh 30s'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIsMaximized(!isMaximized)}>
          {isMaximized ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
          {isMaximized ? 'Minimizar' : 'Maximizar'}
        </Button>
      </div>
    </div>
  );

  const renderSummaryCards = (compact = false) => (
    <div className={`grid grid-cols-2 ${compact ? 'lg:grid-cols-4 gap-3' : 'lg:grid-cols-4 gap-4'}`}>
      {/* Projects */}
      <Card className="shadow-sm border-0">
        <CardContent className={`${compact ? 'p-3' : 'p-4'} flex items-center gap-3`}>
          <div className="rounded-full p-2 bg-green-100 dark:bg-green-900/30">
            <Monitor className="h-5 w-5" style={{ color: COLOR_ONLINE }} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Projetos</p>
            <p className="text-xl font-bold">{stats.totalProjects}</p>
          </div>
        </CardContent>
      </Card>

      {/* Devices */}
      <Card className="shadow-sm border-0">
        <CardContent className={`${compact ? 'p-3' : 'p-4'} flex items-center gap-3`}>
          <div className="rounded-full p-2 bg-blue-100 dark:bg-blue-900/30">
            <Wifi className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Dispositivos</p>
            <p className="text-xl font-bold">
              <span style={{ color: COLOR_ONLINE }}>{stats.onlineDevices}</span>
              <span className="text-muted-foreground text-sm">/{stats.totalDevices}</span>
            </p>
            <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${stats.healthPct}%`, backgroundColor: progressColor(stats.healthPct) }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agents */}
      <Card className="shadow-sm border-0">
        <CardContent className={`${compact ? 'p-3' : 'p-4'} flex items-center gap-3`}>
          <div className="rounded-full p-2 bg-purple-100 dark:bg-purple-900/30">
            <Server className="h-5 w-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Agentes</p>
            <p className="text-xl font-bold">
              <span style={{ color: COLOR_ONLINE }}>{stats.onlineAgents}</span>
              <span className="text-muted-foreground text-sm">/{stats.totalAgents}</span>
            </p>
            <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${stats.agentPct}%`, backgroundColor: progressColor(stats.agentPct) }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card className={`shadow-sm border-0 ${stats.alerts > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-green-50 dark:bg-green-950/20'}`}>
        <CardContent className={`${compact ? 'p-3' : 'p-4'} flex items-center gap-3`}>
          <div className={`rounded-full p-2 ${stats.alerts > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
            {stats.alerts > 0
              ? <ShieldAlert className="h-5 w-5" style={{ color: COLOR_OFFLINE }} />
              : <CheckCircle2 className="h-5 w-5" style={{ color: COLOR_ONLINE }} />
            }
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Alertas</p>
            <p className="text-xl font-bold" style={{ color: stats.alerts > 0 ? COLOR_OFFLINE : COLOR_ONLINE }}>
              {stats.alerts}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCharts = (height = 250) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2 shadow-sm border-0">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" style={{ color: COLOR_ONLINE }} />
            Dispositivos por Projeto
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {barChartData.length > 0 ? (
            <ChartContainer config={barChartConfig} className="w-full" style={{ height }}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="online" stackId="a" fill={COLOR_ONLINE} radius={[0, 0, 0, 0]} />
                <Bar dataKey="offline" stackId="a" fill={COLOR_OFFLINE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum projeto com dispositivos</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-0">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: '#3b82f6' }} />
            Distribuição Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center px-4 pb-3">
          {pieChartData.length > 0 ? (
            <ChartContainer config={pieChartConfig} className="w-full" style={{ height }}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={height * 0.2}
                  outerRadius={height * 0.35}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                  stroke="none"
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
  );

  const renderDeviceTable = (maxH?: string) => (
    <Card className="shadow-sm border-0 flex flex-col" style={maxH ? {} : { flex: 1, minHeight: 0 }}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className="h-4 w-4" style={{ color: '#3b82f6' }} />
          Todos os Dispositivos
        </CardTitle>
        <CardDescription className="text-xs">{devices.length} dispositivos · {projects.length} projetos</CardDescription>
      </CardHeader>
      <CardContent className={`px-4 pb-3 ${maxH ? '' : 'flex-1 overflow-auto min-h-0'}`}>
        {sortedDevices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum dispositivo cadastrado</p>
        ) : (
          <div className={maxH ? `overflow-auto ${maxH}` : 'overflow-auto h-full'}>
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
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: device.status === 'online' ? COLOR_ONLINE
                            : device.status === 'error' ? COLOR_OFFLINE
                            : '#9ca3af'
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{device.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{device.controlid_ip_address}</TableCell>
                    <TableCell className="whitespace-nowrap">{getProjectName(device.project_id)}</TableCell>
                    <TableCell className="whitespace-nowrap">{getAgentName(device.agent_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
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
  );

  const renderAlerts = () => {
    if (alertsList.length > 0) {
      return (
        <Card className="shadow-sm border-0" style={{ borderLeft: `3px solid ${COLOR_OFFLINE}` }}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: COLOR_OFFLINE }}>
              <AlertTriangle className="h-4 w-4" />
              Alertas ({alertsList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1.5 max-h-[200px] overflow-auto">
              {alertsList.map((alert, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {alert.type === 'device'
                      ? <WifiOff className="h-3.5 w-3.5" style={{ color: COLOR_OFFLINE }} />
                      : <Server className="h-3.5 w-3.5" style={{ color: COLOR_OFFLINE }} />
                    }
                    <span className="font-medium">{alert.name}</span>
                    <span className="text-muted-foreground">({alert.project})</span>
                  </div>
                  <span className="text-muted-foreground">{alert.detail}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }
    if (stats.totalDevices > 0) {
      return (
        <Card className="shadow-sm border-0" style={{ borderLeft: `3px solid ${COLOR_ONLINE}` }}>
          <CardContent className="py-3 px-4 flex items-center gap-2 text-sm" style={{ color: COLOR_ONLINE }}>
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Todos os dispositivos e agentes estão operacionais</span>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  // ─── MAXIMIZED LAYOUT ───
  if (isMaximized) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden">
        {/* Monitor Header */}
        {renderHeader(true)}

        {/* Body: 2-column grid */}
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_1fr] gap-3 p-4 overflow-hidden">
          {/* Left column */}
          <div className="flex flex-col gap-3 overflow-auto min-h-0">
            {renderSummaryCards(true)}
            {renderCharts(180)}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col">
              {renderDeviceTable()}
            </div>
            {renderAlerts()}
          </div>
        </div>
      </div>
    );
  }

  // ─── NORMAL LAYOUT ───
  return (
    <div className="space-y-6">
      {renderHeader()}
      {renderSummaryCards()}
      {(stats.totalDevices > 0 || projects.length > 0) && renderCharts()}
      {renderDeviceTable('max-h-[400px]')}

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
                ? <Badge variant="outline" className="text-xs" style={{ backgroundColor: `${COLOR_ONLINE}15`, color: COLOR_ONLINE, borderColor: `${COLOR_ONLINE}40` }}>Operacional</Badge>
                : health === 'yellow'
                ? <Badge variant="outline" className="text-xs" style={{ backgroundColor: `${COLOR_PARTIAL}15`, color: COLOR_PARTIAL, borderColor: `${COLOR_PARTIAL}40` }}>Parcial</Badge>
                : health === 'red'
                ? <Badge variant="outline" className="text-xs" style={{ backgroundColor: `${COLOR_OFFLINE}15`, color: COLOR_OFFLINE, borderColor: `${COLOR_OFFLINE}40` }}>Crítico</Badge>
                : <Badge variant="outline" className="text-xs text-muted-foreground">Sem dispositivos</Badge>;

              const lastEvent = pDevices
                .filter(d => d.last_event_timestamp)
                .sort((a, b) => new Date(b.last_event_timestamp!).getTime() - new Date(a.last_event_timestamp!).getTime())[0];

              return (
                <Card key={project.id} className="shadow-sm" style={{
                  borderLeft: health === 'red' ? `3px solid ${COLOR_OFFLINE}` :
                    health === 'yellow' ? `3px solid ${COLOR_PARTIAL}` :
                    health === 'green' ? `3px solid ${COLOR_ONLINE}` : undefined
                }}>
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
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.status === 'online' ? COLOR_ONLINE : COLOR_OFFLINE }} />
                              <span>{d.name}</span>
                              <span className="text-muted-foreground font-mono">{d.controlid_ip_address}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Agente Local</p>
                      {pAgents.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Sem agente configurado</p>
                      ) : pAgents.map(a => {
                        const online = isAgentOnline(a);
                        return (
                          <div key={a.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: online ? COLOR_ONLINE : COLOR_OFFLINE }} />
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

      {renderAlerts()}
    </div>
  );
}
