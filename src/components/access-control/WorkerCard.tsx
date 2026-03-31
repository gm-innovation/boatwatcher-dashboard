import { ResolvedAvatar } from '@/components/ResolvedAvatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { CachedWorker } from '@/hooks/useOfflineAccessControl';
import { cn } from '@/lib/utils';

interface WorkerCardProps {
  worker: CachedWorker;
  borderStatus?: 'granted' | 'blocked' | 'pending' | null;
}

const borderColorMap: Record<string, string> = {
  granted: 'border-green-500',
  blocked: 'border-red-500',
  pending: 'border-yellow-500',
};

const statusLabelMap: Record<string, { label: string; className: string }> = {
  granted: { label: 'Autorizado', className: 'bg-green-600 text-white' },
  blocked: { label: 'Bloqueado', className: 'bg-red-600 text-white' },
  pending: { label: 'Pendente', className: 'bg-yellow-500 text-white' },
};

export function WorkerCard({ worker, borderStatus }: WorkerCardProps) {
  const borderClass = borderStatus ? borderColorMap[borderStatus] : 'border-border';
  const statusInfo = borderStatus ? statusLabelMap[borderStatus] : null;

  return (
    <Card className={cn('border-2', borderClass)}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <ResolvedAvatar
            photoUrl={worker.photo_url}
            name={worker.name}
            fallback="initials"
            className="h-32 w-32 text-3xl"
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-2xl truncate">{worker.name}</p>
            {statusInfo && (
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge className={cn('text-xs', statusInfo.className)}>{statusInfo.label}</Badge>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex justify-between border-b pb-1">
            <span className="text-muted-foreground">Código</span>
            <span className="font-semibold">{worker.code}</span>
          </div>
          {worker.company_name && (
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Empresa</span>
              <span className="font-semibold">{worker.company_name}</span>
            </div>
          )}
          {worker.job_function_name && (
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Função</span>
              <span className="font-semibold">{worker.job_function_name}</span>
            </div>
          )}
          {(worker as any).role && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cargo</span>
              <span className="font-semibold">{(worker as any).role}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
