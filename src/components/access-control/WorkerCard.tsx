import { ResolvedAvatar } from '@/components/ResolvedAvatar';
import { Badge } from '@/components/ui/badge';
import type { CachedWorker } from '@/hooks/useOfflineAccessControl';

interface WorkerCardProps {
  worker: CachedWorker;
}

export function WorkerCard({ worker }: WorkerCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
      <ResolvedAvatar
        src={worker.photo_url}
        fallback={worker.name.slice(0, 2).toUpperCase()}
        className="h-16 w-16 text-lg"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-lg truncate">{worker.name}</p>
        <p className="text-sm text-muted-foreground">Matrícula: {worker.code}</p>
        {worker.document_number && (
          <p className="text-sm text-muted-foreground">Doc: {worker.document_number}</p>
        )}
        <div className="flex gap-2 mt-1 flex-wrap">
          {worker.company_name && <Badge variant="secondary">{worker.company_name}</Badge>}
          {worker.job_function_name && <Badge variant="outline">{worker.job_function_name}</Badge>}
        </div>
      </div>
    </div>
  );
}
