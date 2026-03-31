import { ResolvedAvatar } from '@/components/ResolvedAvatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CachedWorker } from '@/hooks/useOfflineAccessControl';

interface WorkerCardProps {
  worker: CachedWorker;
}

export function WorkerCard({ worker }: WorkerCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Informações do Trabalhador</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <ResolvedAvatar
            photoUrl={worker.photo_url}
            name={worker.name}
            fallback="initials"
            className="h-20 w-20 text-xl"
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{worker.name}</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              <Badge className="bg-green-600 text-white text-xs">Ativo</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex justify-between border-b pb-1">
            <span className="text-muted-foreground">Código</span>
            <span className="font-semibold">{worker.code}</span>
          </div>
          {worker.document_number && (
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Documento</span>
              <span className="font-semibold">{worker.document_number}</span>
            </div>
          )}
          {worker.company_name && (
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Empresa</span>
              <span className="font-semibold">{worker.company_name}</span>
            </div>
          )}
          {worker.job_function_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Função</span>
              <span className="font-semibold">{worker.job_function_name}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
