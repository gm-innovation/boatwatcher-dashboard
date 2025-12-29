import { useDevices } from '@/hooks/useControlID';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Server } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';

export const DeviceStatusPanel = () => {
  const { selectedProjectId } = useProject();
  const { data: devices = [], isLoading, refetch } = useDevices(selectedProjectId);

  const onlineDevices = devices.filter(d => d.status === 'online');
  const offlineDevices = devices.filter(d => d.status === 'offline');
  const errorDevices = devices.filter(d => d.status === 'error');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'offline': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'error': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Wifi className="h-3 w-3" />;
      case 'offline': return <WifiOff className="h-3 w-3" />;
      case 'error': return <AlertTriangle className="h-3 w-3" />;
      default: return <Server className="h-3 w-3" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Status dos Dispositivos</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-green-500">{onlineDevices.length} online</span>
          <span className="text-red-500">{offlineDevices.length} offline</span>
          {errorDevices.length > 0 && (
            <span className="text-orange-500">{errorDevices.length} erro</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : devices.length > 0 ? (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {devices.map((device) => (
                <div 
                  key={device.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{device.name}</p>
                      <p className="text-xs text-muted-foreground">{device.location || device.controlid_ip_address}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(device.status)}>
                    {getStatusIcon(device.status)}
                    <span className="ml-1 capitalize">{device.status}</span>
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhum dispositivo cadastrado
          </div>
        )}
      </CardContent>
    </Card>
  );
};
