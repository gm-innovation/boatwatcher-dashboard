import { useState, useEffect } from 'react';
import { isElectron, getElectronAPI } from '@/lib/dataProvider';
import { supabase } from '@/integrations/supabase/client';
import { fetchAccessLogs } from '@/hooks/useDataProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, ArrowRight, ArrowLeft, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { AccessLog } from '@/types/supabase';

interface RecentActivityFeedProps {
  projectId: string | null;
}

export const RecentActivityFeed = ({ projectId }: RecentActivityFeedProps) => {
  const [recentLogs, setRecentLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!projectId) {
        setRecentLogs([]);
        setIsLoading(false);
        return;
      }

      try {
        if (isElectron()) {
          const data = await fetchAccessLogs({ limit: 20 });
          setRecentLogs((data || []) as AccessLog[]);
        } else {
          const { data, error } = await supabase
            .from('access_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(20);

          if (!error && data) {
            setRecentLogs(data as AccessLog[]);
          }
        }
      } catch (err) {
        console.error('Error fetching recent logs:', err);
      }
      setIsLoading(false);
    };

    fetchLogs();

    // Realtime subscription (web only) or polling (Electron)
    if (isElectron()) {
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    } else {
      const channel = supabase
        .channel('recent-access-logs')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'access_logs' },
          (payload) => {
            setRecentLogs(prev => [payload.new as AccessLog, ...prev].slice(0, 20));
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [projectId]);

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'entry': return <ArrowRight className="h-3 w-3 text-green-500" />;
      case 'exit': return <ArrowLeft className="h-3 w-3 text-blue-500" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    return status === 'granted' 
      ? <Badge className="bg-green-500/10 text-green-500 text-xs">Concedido</Badge>
      : <Badge className="bg-red-500/10 text-red-500 text-xs">Negado</Badge>;
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
                      <span>{format(new Date(log.timestamp), 'HH:mm:ss')}</span>
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
