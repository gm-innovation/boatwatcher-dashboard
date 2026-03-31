import { Wifi, WifiOff, RefreshCw, CloudUpload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSync: () => void;
}

export function OfflineIndicator({ isOnline, pendingCount, isSyncing, onSync }: OfflineIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {isOnline ? (
        <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 border-green-300 dark:text-green-400 dark:border-green-700">
          <Wifi className="h-3 w-3" />
          Online
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
          <WifiOff className="h-3 w-3" />
          Offline
        </Badge>
      )}
      {pendingCount > 0 && (
        <Badge variant="secondary" className="gap-1">
          <CloudUpload className="h-3 w-3" />
          {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
        </Badge>
      )}
      {isOnline && pendingCount > 0 && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSync} disabled={isSyncing}>
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}
