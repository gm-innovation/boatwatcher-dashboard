import { useDevices } from '@/hooks/useControlID';
import { useExpiredDocuments, useWorkersWithExpiringDocuments } from '@/hooks/useWorkerDocuments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, AlertCircle, FileWarning, Wifi } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';

interface Alert {
  id: string;
  type: 'device_offline' | 'document_expired' | 'document_expiring' | 'access_denied';
  title: string;
  message: string;
  priority: 'high' | 'normal' | 'low';
  timestamp: Date;
}

export const AlertsPanel = () => {
  const { selectedProjectId } = useProject();
  const { data: devices = [] } = useDevices(selectedProjectId);
  const { data: expiredDocs = [] } = useExpiredDocuments();
  const { data: expiringDocs = [] } = useWorkersWithExpiringDocuments(30);

  // Build alerts from different sources
  const alerts: Alert[] = [];

  // Offline devices
  devices.filter(d => d.status === 'offline').forEach(device => {
    alerts.push({
      id: `device-${device.id}`,
      type: 'device_offline',
      title: 'Dispositivo Offline',
      message: `${device.name} está offline`,
      priority: 'high',
      timestamp: device.last_event_timestamp ? new Date(device.last_event_timestamp) : new Date(),
    });
  });

  // Expired documents
  expiredDocs.forEach((doc: any) => {
    alerts.push({
      id: `expired-${doc.id}`,
      type: 'document_expired',
      title: 'Documento Vencido',
      message: `${doc.document_type} de ${doc.worker?.name || 'Trabalhador'} venceu`,
      priority: 'high',
      timestamp: new Date(doc.expiry_date),
    });
  });

  // Expiring documents
  expiringDocs.forEach((doc: any) => {
    alerts.push({
      id: `expiring-${doc.id}`,
      type: 'document_expiring',
      title: 'Documento Vencendo',
      message: `${doc.document_type} de ${doc.worker?.name || 'Trabalhador'} vence em breve`,
      priority: 'normal',
      timestamp: new Date(doc.expiry_date),
    });
  });

  // Sort by priority and timestamp
  alerts.sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (b.priority === 'high' && a.priority !== 'high') return 1;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'device_offline': return <Wifi className="h-4 w-4 text-red-500" />;
      case 'document_expired': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'document_expiring': return <FileWarning className="h-4 w-4 text-yellow-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'normal': return 'border-l-yellow-500';
      default: return 'border-l-blue-500';
    }
  };

  const highPriorityCount = alerts.filter(a => a.priority === 'high').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
          </CardTitle>
          {highPriorityCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {highPriorityCount} crítico{highPriorityCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length > 0 ? (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {alerts.slice(0, 10).map((alert) => (
                <div 
                  key={alert.id} 
                  className={`flex items-start gap-3 p-2 rounded-lg bg-muted/50 border-l-4 ${getPriorityColor(alert.priority)}`}
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum alerta ativo
          </div>
        )}
      </CardContent>
    </Card>
  );
};
