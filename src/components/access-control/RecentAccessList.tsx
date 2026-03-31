import { LogIn, LogOut } from 'lucide-react';
import type { PendingAccessLog } from '@/hooks/useOfflineAccessControl';
import { format } from 'date-fns';

interface RecentAccessListProps {
  logs: Array<PendingAccessLog & { synced?: boolean }>;
}

export function RecentAccessList({ logs }: RecentAccessListProps) {
  if (logs.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-muted-foreground mb-2">Registros recentes</h4>
      <div className="space-y-1 max-h-[200px] overflow-y-auto">
        {logs.slice().reverse().map((log, i) => (
          <div key={log.id || i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
            {log.direction === 'entry' ? (
              <LogIn className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <LogOut className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span className="truncate flex-1">{log.worker_name || 'Desconhecido'}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {format(new Date(log.timestamp), 'HH:mm:ss')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
