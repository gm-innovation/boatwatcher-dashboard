import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Stethoscope, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Database,
  Server,
  Wifi,
  Clock
} from 'lucide-react';

interface DiagnosticItem {
  id: string;
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  lastCheck: Date;
}

export const DiagnosticsPanel = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([
    {
      id: '1',
      name: 'Conexão com Banco de Dados',
      status: 'ok',
      message: 'Conexão estabelecida com sucesso',
      lastCheck: new Date()
    },
    {
      id: '2',
      name: 'Serviço de Autenticação',
      status: 'ok',
      message: 'Serviço funcionando normalmente',
      lastCheck: new Date()
    },
    {
      id: '3',
      name: 'Edge Functions',
      status: 'ok',
      message: 'Todas as funções respondendo',
      lastCheck: new Date()
    },
    {
      id: '4',
      name: 'Armazenamento de Arquivos',
      status: 'ok',
      message: 'Bucket acessível',
      lastCheck: new Date()
    },
    {
      id: '5',
      name: 'Dispositivos ControlID',
      status: 'warning',
      message: '2 dispositivos offline',
      lastCheck: new Date()
    }
  ]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    // Simular diagnóstico
    await new Promise(resolve => setTimeout(resolve, 2000));
    setDiagnostics(prev => prev.map(d => ({ ...d, lastCheck: new Date() })));
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok': return <Badge className="bg-green-500/10 text-green-500">OK</Badge>;
      case 'warning': return <Badge className="bg-yellow-500/10 text-yellow-500">Atenção</Badge>;
      case 'error': return <Badge className="bg-red-500/10 text-red-500">Erro</Badge>;
      default: return null;
    }
  };

  const getIcon = (name: string) => {
    if (name.includes('Banco')) return <Database className="h-5 w-5" />;
    if (name.includes('Autenticação')) return <Server className="h-5 w-5" />;
    if (name.includes('Edge')) return <Server className="h-5 w-5" />;
    if (name.includes('Armazenamento')) return <Database className="h-5 w-5" />;
    if (name.includes('Dispositivos')) return <Wifi className="h-5 w-5" />;
    return <Stethoscope className="h-5 w-5" />;
  };

  const okCount = diagnostics.filter(d => d.status === 'ok').length;
  const warningCount = diagnostics.filter(d => d.status === 'warning').length;
  const errorCount = diagnostics.filter(d => d.status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Diagnóstico do Sistema</h2>
          <p className="text-sm text-muted-foreground">Verificação de saúde dos serviços</p>
        </div>
        <Button onClick={runDiagnostics} disabled={isRunning} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Executando...' : 'Executar Diagnóstico'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Funcionando</p>
                <p className="text-3xl font-bold">{okCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Atenção</p>
                <p className="text-3xl font-bold">{warningCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="text-3xl font-bold">{errorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diagnostics List */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados do Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {diagnostics.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      {getIcon(item.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.lastCheck.toLocaleTimeString()}
                      </div>
                    </div>
                    {getStatusIcon(item.status)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
