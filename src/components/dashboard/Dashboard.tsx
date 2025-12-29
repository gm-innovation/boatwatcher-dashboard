import { useEffect, useState } from 'react';
import { useAccessLogs, useDevices, useRealtimeAccessLogs } from '@/hooks/useControlID';
import { useWorkers, useCompanies } from '@/hooks/useSupabase';
import { format, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Building, 
  Server, 
  Wifi, 
  WifiOff, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';
import type { AccessLog } from '@/types/supabase';

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color,
  subValue,
  subLabel 
}: { 
  title: string;
  value: number | string;
  icon: any;
  color: string;
  subValue?: number | string;
  subLabel?: string;
}) => (
  <div className="bg-card/80 backdrop-blur-sm rounded-lg border p-6 hover:shadow-lg transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {subValue !== undefined && (
          <p className="text-sm text-muted-foreground mt-1">
            {subLabel}: <span className="font-medium">{subValue}</span>
          </p>
        )}
      </div>
      <div className={`p-3 rounded-full ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </div>
);

interface DashboardProps {
  projectId: string | null;
}

export const Dashboard = ({ projectId }: DashboardProps) => {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const { data: workers = [] } = useWorkers();
  const { data: companies = [] } = useCompanies();
  const { data: devices = [] } = useDevices(projectId);
  const { data: accessLogs = [], refetch: refetchLogs } = useAccessLogs(projectId, today, today, 50);
  const [realtimeLogs, setRealtimeLogs] = useState<AccessLog[]>([]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = useRealtimeAccessLogs((newLog) => {
      setRealtimeLogs(prev => [newLog, ...prev].slice(0, 20));
      refetchLogs();
    });
    return () => unsubscribe();
  }, [refetchLogs]);

  // Combine realtime logs with fetched logs
  const allLogs = [...realtimeLogs, ...accessLogs]
    .filter((log, index, self) => 
      index === self.findIndex(l => l.id === log.id)
    )
    .slice(0, 20);

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const offlineDevices = devices.filter(d => d.status !== 'online').length;
  const todayGranted = accessLogs.filter(l => l.access_status === 'granted').length;
  const todayDenied = accessLogs.filter(l => l.access_status === 'denied').length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Trabalhadores"
          value={workers.length}
          icon={Users}
          color="bg-purple-500"
          subValue={workers.filter(w => w.status === 'active').length}
          subLabel="Ativos"
        />
        <StatCard
          title="Empresas"
          value={companies.length}
          icon={Building}
          color="bg-emerald-500"
        />
        <StatCard
          title="Dispositivos"
          value={devices.length}
          icon={Server}
          color="bg-blue-500"
          subValue={`${onlineDevices} online`}
          subLabel="Status"
        />
        <StatCard
          title="Acessos Hoje"
          value={todayGranted + todayDenied}
          icon={Activity}
          color="bg-orange-500"
          subValue={`${todayGranted} liberados`}
          subLabel="Status"
        />
      </div>

      {/* Devices Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-card rounded-lg border p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Server className="h-5 w-5" />
            Status dos Dispositivos
          </h3>
          <div className="space-y-3">
            {devices.slice(0, 5).map(device => (
              <div key={device.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {device.status === 'online' ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{device.name}</p>
                    <p className="text-xs text-muted-foreground">{device.controlid_ip_address}</p>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={device.status === 'online' 
                    ? 'bg-green-500/10 text-green-500' 
                    : 'bg-red-500/10 text-red-500'
                  }
                >
                  {device.status}
                </Badge>
              </div>
            ))}
            {devices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum dispositivo cadastrado
              </p>
            )}
          </div>
        </div>

        {/* Recent Access Logs - Realtime */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Últimos Acessos
            <Badge variant="outline" className="ml-2 animate-pulse">
              Tempo Real
            </Badge>
          </h3>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {allLogs.map(log => (
                <div 
                  key={log.id} 
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    log.access_status === 'granted' 
                      ? 'bg-green-500/5 border border-green-500/10' 
                      : 'bg-red-500/5 border border-red-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {log.direction === 'entry' ? (
                      <ArrowRight className="h-4 w-4 text-green-500" />
                    ) : log.direction === 'exit' ? (
                      <ArrowLeft className="h-4 w-4 text-orange-500" />
                    ) : (
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {log.worker_name || 'Não identificado'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.device_name || 'Dispositivo'} • {format(new Date(log.timestamp), 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                  {log.access_status === 'granted' ? (
                    <Badge className="bg-green-500/10 text-green-500 border-0">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Liberado
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-500 border-0">
                      <XCircle className="h-3 w-3 mr-1" />
                      {log.reason || 'Negado'}
                    </Badge>
                  )}
                </div>
              ))}
              {allLogs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum acesso registrado hoje
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};
