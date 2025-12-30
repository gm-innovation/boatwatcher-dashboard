import { useMemo } from 'react';
import { useDevices } from '@/hooks/useControlID';
import { useLocalAgents } from '@/hooks/useLocalAgents';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  Server, 
  Camera, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ConnectivityDashboard() {
  const { selectedProjectId } = useProject();
  const { data: devices = [] } = useDevices(selectedProjectId);
  const { agents } = useLocalAgents(selectedProjectId);

  const stats = useMemo(() => {
    const onlineDevices = devices.filter(d => d.status === 'online');
    const offlineDevices = devices.filter(d => d.status !== 'online');
    const onlineAgents = agents.filter(a => {
      const isRecent = a.last_seen_at && new Date(a.last_seen_at) > new Date(Date.now() - 60000);
      return a.status === 'online' && isRecent;
    });
    
    const devicesWithAgent = devices.filter(d => d.agent_id);
    const devicesWithoutAgent = devices.filter(d => !d.agent_id);

    return {
      totalDevices: devices.length,
      onlineDevices: onlineDevices.length,
      offlineDevices: offlineDevices.length,
      totalAgents: agents.length,
      onlineAgents: onlineAgents.length,
      devicesWithAgent: devicesWithAgent.length,
      devicesWithoutAgent: devicesWithoutAgent.length,
      healthPercentage: devices.length > 0 
        ? Math.round((onlineDevices.length / devices.length) * 100) 
        : 0
    };
  }, [devices, agents]);

  const recentEvents = useMemo(() => {
    return devices
      .filter(d => d.last_event_timestamp)
      .sort((a, b) => new Date(b.last_event_timestamp!).getTime() - new Date(a.last_event_timestamp!).getTime())
      .slice(0, 5);
  }, [devices]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Dashboard de Conectividade</h2>
        <p className="text-sm text-muted-foreground">
          Visão geral do status de dispositivos e agentes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Dispositivos Online</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-500" />
              {stats.onlineDevices} / {stats.totalDevices}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stats.healthPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.healthPercentage}% operacional
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Dispositivos Offline</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-red-500" />
              {stats.offlineDevices}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.offlineDevices > 0 ? (
              <div className="flex items-center gap-1 text-xs text-orange-500">
                <AlertTriangle className="h-3 w-3" />
                Requer atenção
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <CheckCircle2 className="h-3 w-3" />
                Tudo funcionando
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Agentes Locais</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              {stats.onlineAgents} / {stats.totalAgents}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.devicesWithAgent} dispositivos com agente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sem Agente</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Camera className="h-5 w-5 text-muted-foreground" />
              {stats.devicesWithoutAgent}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Dispositivos usando apenas webhook
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Device Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Últimos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum evento recente
              </p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((device) => (
                  <div key={device.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="text-sm font-medium">{device.name}</p>
                        <p className="text-xs text-muted-foreground">{device.controlid_ip_address}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(device.last_event_timestamp!), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              Status dos Agentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum agente configurado
              </p>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => {
                  const isOnline = agent.status === 'online' && agent.last_seen_at && 
                    new Date(agent.last_seen_at) > new Date(Date.now() - 60000);
                  
                  return (
                    <div key={agent.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="text-sm font-medium">{agent.name}</p>
                          {agent.ip_address && (
                            <p className="text-xs text-muted-foreground">{agent.ip_address}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={isOnline ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}>
                        {isOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {stats.offlineDevices > 0 && (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-4 w-4" />
              Alertas de Conectividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {devices.filter(d => d.status !== 'online').map((device) => (
                <div key={device.id} className="flex items-center justify-between text-sm">
                  <span>{device.name} está offline</span>
                  <span className="text-muted-foreground">
                    {device.last_event_timestamp 
                      ? `Último evento: ${formatDistanceToNow(new Date(device.last_event_timestamp), { addSuffix: true, locale: ptBR })}`
                      : 'Nunca conectado'
                    }
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}