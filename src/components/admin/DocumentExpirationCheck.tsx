import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, FileWarning, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usesLocalAuth, usesLocalServer } from '@/lib/runtimeProfile';
import { fetchExpiredDocuments, fetchWorkersWithExpiringDocuments } from '@/hooks/useDataProvider';

interface CheckStats {
  expired: number;
  expiring7days: number;
  expiring15days: number;
  expiring30days: number;
  notificationsCreated: number;
  skippedDuplicates: number;
}

export const DocumentExpirationCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [stats, setStats] = useState<CheckStats | null>(null);
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      if (isLocalRuntime) {
        const [expired, expiring30] = await Promise.all([
          fetchExpiredDocuments(),
          fetchWorkersWithExpiringDocuments(30),
        ]);

        const localStats: CheckStats = {
          expired: expired.length,
          expiring7days: expiring30.filter((doc: any) => {
            if (!doc.expiry_date) return false;
            const days = Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return days >= 0 && days <= 7;
          }).length,
          expiring15days: expiring30.filter((doc: any) => {
            if (!doc.expiry_date) return false;
            const days = Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return days >= 0 && days <= 15;
          }).length,
          expiring30days: expiring30.length,
          notificationsCreated: 0,
          skippedDuplicates: 0,
        };

        setStats(localStats);
        setLastCheck(new Date());
        toast({
          title: 'Verificação concluída',
          description: `${localStats.expired} vencidos e ${localStats.expiring30days} documentos a vencer em até 30 dias`,
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-expiring-documents', {
        method: 'POST',
      });

      if (error) throw error;

      if (data.success) {
        setStats(data.stats);
        setLastCheck(new Date());
        toast({
          title: 'Verificação concluída',
          description: `${data.stats.notificationsCreated} notificações criadas`,
        });
      } else {
        throw new Error(data.error || 'Erro na verificação');
      }
    } catch (error: any) {
      console.error('Error checking documents:', error);
      toast({
        title: 'Erro na verificação',
        description: error.message || 'Não foi possível verificar os documentos',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5" />
              Verificação de Documentos
            </CardTitle>
            <CardDescription>
              Verifica documentos próximos do vencimento e cria notificações
            </CardDescription>
          </div>
          <Button onClick={handleCheck} disabled={isChecking}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Verificando...' : 'Verificar Agora'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {lastCheck && (
          <p className="text-sm text-muted-foreground mb-4">
            Última verificação: {lastCheck.toLocaleString('pt-BR')}
          </p>
        )}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium">Vencidos</p>
                <p className="text-2xl font-bold text-destructive">{stats.expired}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary text-secondary-foreground">
              <Clock className="h-5 w-5 text-foreground" />
              <div>
                <p className="text-sm font-medium">Vencem em 7 dias</p>
                <p className="text-2xl font-bold">{stats.expiring7days}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary text-secondary-foreground">
              <Clock className="h-5 w-5 text-foreground" />
              <div>
                <p className="text-sm font-medium">Vencem em 15 dias</p>
                <p className="text-2xl font-bold">{stats.expiring15days}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Vencem em 30 dias</p>
                <p className="text-2xl font-bold">{stats.expiring30days}</p>
              </div>
            </div>
          </div>
        )}

        {stats && (
          <div className="mt-4 flex gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {isLocalRuntime ? 'Consulta local concluída' : `${stats.notificationsCreated} notificações criadas`}
            </Badge>
            {!isLocalRuntime && stats.skippedDuplicates > 0 && (
              <Badge variant="secondary" className="gap-1">
                {stats.skippedDuplicates} duplicadas ignoradas
              </Badge>
            )}
          </div>
        )}

        {!stats && !isChecking && (
          <p className="text-sm text-muted-foreground">
            {isLocalRuntime
              ? 'Clique em "Verificar Agora" para consultar vencimentos diretamente no servidor local.'
              : 'Clique em "Verificar Agora" para iniciar a verificação manual de documentos. A verificação automática ocorre diariamente às 08:00.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
