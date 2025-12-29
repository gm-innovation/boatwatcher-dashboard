import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Stethoscope, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Database,
  Server,
  Wifi,
  Clock,
  FileWarning,
  HardDrive,
  LogOut,
  User,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSessionDiagnostics, forceLogout } from '@/utils/ensureValidSession';

interface DiagnosticItem {
  id: string;
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  lastCheck: Date;
}

interface AuthDiagnostics {
  hasLocalSession: boolean;
  serverValidation: 'ok' | 'error' | 'no_session';
  userEmail: string | null;
  expiresAt: Date | null;
  errorMessage: string | null;
}

export const DiagnosticsPanel = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);
  const [authDiagnostics, setAuthDiagnostics] = useState<AuthDiagnostics | null>(null);
  const [isTestingAuth, setIsTestingAuth] = useState(false);

  const runAuthDiagnostics = async () => {
    setIsTestingAuth(true);
    const result = await getSessionDiagnostics();
    setAuthDiagnostics(result);
    setIsTestingAuth(false);
  };

  const handleForceLogout = async () => {
    await forceLogout('Logout forçado pelo administrador.');
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticItem[] = [];

    // Also run auth diagnostics
    await runAuthDiagnostics();

    // 1. Testar conexão com banco de dados
    try {
      const start = Date.now();
      const { error } = await supabase.from('system_settings').select('id').limit(1);
      const duration = Date.now() - start;
      results.push({
        id: 'db',
        name: 'Conexão com Banco de Dados',
        status: error ? 'error' : 'ok',
        message: error ? `Erro: ${error.message}` : `Conexão estabelecida (${duration}ms)`,
        lastCheck: new Date()
      });
    } catch (e) {
      results.push({
        id: 'db',
        name: 'Conexão com Banco de Dados',
        status: 'error',
        message: 'Falha crítica na conexão',
        lastCheck: new Date()
      });
    }

    // 2. Testar serviço de autenticação (usando getUser para validação server-side)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      let status: 'ok' | 'warning' | 'error' = 'ok';
      let message = '';
      
      if (userError) {
        status = 'error';
        message = `JWT inválido: ${userError.message}`;
      } else if (!session) {
        status = 'warning';
        message = 'Nenhuma sessão ativa';
      } else if (user) {
        status = 'ok';
        message = `Sessão válida: ${user.email}`;
      }
      
      results.push({
        id: 'auth',
        name: 'Autenticação (Server-Validated)',
        status,
        message,
        lastCheck: new Date()
      });
    } catch (e) {
      results.push({
        id: 'auth',
        name: 'Autenticação (Server-Validated)',
        status: 'error',
        message: 'Falha ao verificar autenticação',
        lastCheck: new Date()
      });
    }

    // 3. Verificar dispositivos ControlID
    try {
      const { data: devices, error: devicesError } = await supabase
        .from('devices')
        .select('id, status, last_event_timestamp');
      
      if (devicesError) {
        results.push({
          id: 'devices',
          name: 'Dispositivos ControlID',
          status: 'error',
          message: `Erro ao consultar: ${devicesError.message}`,
          lastCheck: new Date()
        });
      } else {
        const totalDevices = devices?.length || 0;
        const offlineDevices = devices?.filter(d => d.status === 'offline').length || 0;
        const errorDevices = devices?.filter(d => d.status === 'error').length || 0;
        
        let status: 'ok' | 'warning' | 'error' = 'ok';
        if (errorDevices > 0) status = 'error';
        else if (offlineDevices > 0) status = 'warning';
        
        results.push({
          id: 'devices',
          name: 'Dispositivos ControlID',
          status: totalDevices === 0 ? 'warning' : status,
          message: totalDevices === 0 
            ? 'Nenhum dispositivo cadastrado'
            : `${totalDevices - offlineDevices - errorDevices}/${totalDevices} online${offlineDevices > 0 ? `, ${offlineDevices} offline` : ''}${errorDevices > 0 ? `, ${errorDevices} com erro` : ''}`,
          lastCheck: new Date()
        });
      }
    } catch (e) {
      results.push({
        id: 'devices',
        name: 'Dispositivos ControlID',
        status: 'error',
        message: 'Falha ao verificar dispositivos',
        lastCheck: new Date()
      });
    }

    // 4. Verificar armazenamento de arquivos
    try {
      const { error: storageError } = await supabase.storage
        .from('worker-photos')
        .list('', { limit: 1 });
      
      results.push({
        id: 'storage',
        name: 'Armazenamento de Arquivos',
        status: storageError ? 'error' : 'ok',
        message: storageError ? `Erro: ${storageError.message}` : 'Bucket acessível e operacional',
        lastCheck: new Date()
      });
    } catch (e) {
      results.push({
        id: 'storage',
        name: 'Armazenamento de Arquivos',
        status: 'error',
        message: 'Falha ao acessar storage',
        lastCheck: new Date()
      });
    }

    // 5. Verificar documentos vencendo em 30 dias
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const { data: expiringDocs, error: docsError } = await supabase
        .from('worker_documents')
        .select('id')
        .lt('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .gt('expiry_date', today.toISOString().split('T')[0]);
      
      const expiringCount = expiringDocs?.length || 0;
      
      results.push({
        id: 'docs',
        name: 'Documentos a Vencer (30 dias)',
        status: docsError ? 'error' : expiringCount > 0 ? 'warning' : 'ok',
        message: docsError 
          ? `Erro: ${docsError.message}` 
          : expiringCount > 0 
            ? `${expiringCount} documento(s) vencendo nos próximos 30 dias`
            : 'Nenhum documento próximo do vencimento',
        lastCheck: new Date()
      });
    } catch (e) {
      results.push({
        id: 'docs',
        name: 'Documentos a Vencer',
        status: 'error',
        message: 'Falha ao verificar documentos',
        lastCheck: new Date()
      });
    }

    // 6. Verificar integridade dos dados (trabalhadores e empresas)
    try {
      const { count: workersCount, error: workersError } = await supabase
        .from('workers')
        .select('id', { count: 'exact', head: true });
      
      const { count: companiesCount, error: companiesError } = await supabase
        .from('companies')
        .select('id', { count: 'exact', head: true });
      
      const { count: projectsCount, error: projectsError } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true });
      
      const hasError = workersError || companiesError || projectsError;
      
      results.push({
        id: 'data',
        name: 'Integridade dos Dados',
        status: hasError ? 'error' : 'ok',
        message: hasError 
          ? 'Erro ao verificar integridade'
          : `${workersCount || 0} trabalhadores, ${companiesCount || 0} empresas, ${projectsCount || 0} projetos`,
        lastCheck: new Date()
      });
    } catch (e) {
      results.push({
        id: 'data',
        name: 'Integridade dos Dados',
        status: 'error',
        message: 'Falha ao verificar dados',
        lastCheck: new Date()
      });
    }

    setDiagnostics(results);
    setLastRunTime(new Date());
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

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
      case 'ok': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">OK</Badge>;
      case 'warning': return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Atenção</Badge>;
      case 'error': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Erro</Badge>;
      default: return null;
    }
  };

  const getIcon = (id: string) => {
    switch (id) {
      case 'db': return <Database className="h-5 w-5" />;
      case 'auth': return <Server className="h-5 w-5" />;
      case 'devices': return <Wifi className="h-5 w-5" />;
      case 'storage': return <HardDrive className="h-5 w-5" />;
      case 'docs': return <FileWarning className="h-5 w-5" />;
      case 'data': return <Database className="h-5 w-5" />;
      default: return <Stethoscope className="h-5 w-5" />;
    }
  };

  const okCount = diagnostics.filter(d => d.status === 'ok').length;
  const warningCount = diagnostics.filter(d => d.status === 'warning').length;
  const errorCount = diagnostics.filter(d => d.status === 'error').length;

  const getTimeRemaining = (expiresAt: Date | null) => {
    if (!expiresAt) return 'N/A';
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    if (diff <= 0) return 'Expirado';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Diagnóstico do Sistema</h2>
          <p className="text-sm text-muted-foreground">
            Verificação de saúde dos serviços em tempo real
            {lastRunTime && (
              <span className="ml-2">
                • Última execução: {lastRunTime.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button onClick={runDiagnostics} disabled={isRunning} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Executando...' : 'Executar Diagnóstico'}
        </Button>
      </div>

      {/* Auth Status Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Status da Autenticação (Validação Server-Side)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {authDiagnostics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Sessão Local</p>
                  <div className="flex items-center gap-2">
                    {authDiagnostics.hasLocalSession ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Ativa</Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Inativa</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Validação Servidor</p>
                  <div className="flex items-center gap-2">
                    {authDiagnostics.serverValidation === 'ok' && (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">JWT Válido</Badge>
                    )}
                    {authDiagnostics.serverValidation === 'error' && (
                      <Badge className="bg-red-500/10 text-red-500 border-red-500/20">JWT Inválido</Badge>
                    )}
                    {authDiagnostics.serverValidation === 'no_session' && (
                      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Sem Sessão</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Usuário</p>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {authDiagnostics.userEmail || 'Não logado'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Expira em</p>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getTimeRemaining(authDiagnostics.expiresAt)}
                  </p>
                </div>
              </div>
              
              {authDiagnostics.errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-600">
                    <strong>Erro:</strong> {authDiagnostics.errorMessage}
                  </p>
                </div>
              )}

              <Separator />
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={runAuthDiagnostics}
                  disabled={isTestingAuth}
                  className="gap-2"
                >
                  <RefreshCw className={`h-3 w-3 ${isTestingAuth ? 'animate-spin' : ''}`} />
                  Testar Autenticação
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleForceLogout}
                  className="gap-2"
                >
                  <LogOut className="h-3 w-3" />
                  Forçar Logout
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando diagnóstico de autenticação...</p>
          )}
        </CardContent>
      </Card>

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
              {diagnostics.length === 0 && !isRunning && (
                <p className="text-center text-muted-foreground py-8">
                  Clique em "Executar Diagnóstico" para verificar o sistema
                </p>
              )}
              {isRunning && diagnostics.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Executando verificações...
                </p>
              )}
              {diagnostics.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      {getIcon(item.id)}
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
