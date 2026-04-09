import { useState, useEffect } from 'react';
import { fetchAccessLogs } from '@/hooks/useDataProvider';
import { useRealtimeAccessLogs } from '@/hooks/useRealtimeAccessLogs';
import { usesLocalServer } from '@/lib/runtimeProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, ArrowRight, ArrowLeft, Clock } from 'lucide-react';
import { formatBrtTimeFull } from '@/utils/brt';
import type { AccessLog } from '@/types/supabase';

interface RecentActivityFeedProps {
  projectId: string | null;
}

export const RecentActivityFeed = ({ projectId }: RecentActivityFeedProps) => {
  const [recentLogs, setRecentLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isLocalRuntime = usesLocalServer();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const fetchLogs = async () => {
      if (!projectId) {
        setRecentLogs([]);
        setIsLoading(false);
        return;
      }

      try {
        const data = await fetchAccessLogs({ projectId, limit: 20 });
        setRecentLogs((data || []) as AccessLog[]);
      } catch (err) {
        console.error('Error fetching recent logs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();

    if (isLocalRuntime) {
      interval = setInterval(fetchLogs, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [projectId, isLocalRuntime]);

  useRealtimeAccessLogs({
    projectId,
    onNewLog: (log) => {
      if (isLocalRuntime) return;
      setRecentLogs((prev) => [log, ...prev].slice(0, 20));
    },
  });

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'entry': return <ArrowRight className="h-3 w-3 text-primary" />;
      case 'exit': return <ArrowLeft className="h-3 w-3 text-accent" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    return status === 'granted'
      ? <Badge className="bg-primary/10 text-primary text-xs">Concedido</Badge>
      : <Badge className="bg-destructive/10 text-destructive text-xs">Negado</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : recentLogs.length > 0 ? (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors animate-fade-in"
                >
                  <Avatar className="h-8 w-8">
                    {log.photo_capture_url ? (
                      <AvatarImage src={log.photo_capture_url} alt={log.worker_name || ''} />
                    ) : (
                      <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{log.worker_name || 'Desconhecido'}</p>
                      {getDirectionIcon(log.direction)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{log.device_name || 'Dispositivo'}</span>
                      <span>•</span>
                      <span>{formatBrtTimeFull(log.timestamp)}</span>
                    </div>
                  </div>
                  {getStatusBadge(log.access_status)}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {projectId ? 'Nenhuma atividade recente' : 'Selecione um projeto'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
