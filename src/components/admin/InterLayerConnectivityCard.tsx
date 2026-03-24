import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  Layers,
  Activity,
  ArrowDownUp,
  Server,
  Globe,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { localHealth, localSync } from '@/lib/localServerProvider';
import type { RuntimeProfile } from '@/lib/runtimeProfile';

type TestStatus = 'idle' | 'running' | 'ok' | 'warning' | 'error';

interface TestResult {
  status: TestStatus;
  message: string;
  details?: string;
  timestamp?: Date;
}

interface InterLayerConnectivityCardProps {
  isLocalRuntime: boolean;
  isDesktopFallback: boolean;
  runtimeProfile: RuntimeProfile;
  getStatusBadge: (status: string) => React.ReactNode;
}

export const InterLayerConnectivityCard = ({
  isLocalRuntime,
  isDesktopFallback,
  runtimeProfile,
}: InterLayerConnectivityCardProps) => {
  const [heartbeatResult, setHeartbeatResult] = useState<TestResult>({ status: 'idle', message: 'Não testado' });
  const [syncEndpointResult, setSyncEndpointResult] = useState<TestResult>({ status: 'idle', message: 'Não testado' });
  const [localServerResult, setLocalServerResult] = useState<TestResult>({ status: 'idle', message: 'Não testado' });
  const [roundtripResult, setRoundtripResult] = useState<TestResult>({ status: 'idle', message: 'Não testado' });
  const [isRunningAll, setIsRunningAll] = useState(false);

  const testHeartbeat = async () => {
    setHeartbeatResult({ status: 'running', message: 'Verificando...' });
    try {
      const { data: agents, error } = await supabase
        .from('local_agents')
        .select('id, name, last_seen_at, status, sync_status')
        .order('last_seen_at', { ascending: false })
        .limit(1);

      if (error) {
        setHeartbeatResult({ status: 'error', message: `Erro ao consultar agentes: ${error.message}`, timestamp: new Date() });
        return;
      }

      if (!agents || agents.length === 0) {
        setHeartbeatResult({ status: 'warning', message: 'Nenhum agente registrado no sistema', timestamp: new Date() });
        return;
      }

      const agent = agents[0];
      const lastSeen = agent.last_seen_at ? new Date(agent.last_seen_at) : null;

      if (!lastSeen) {
        setHeartbeatResult({
          status: 'warning',
          message: `Agente "${agent.name}" nunca reportou heartbeat`,
          details: `Status: ${agent.status} | Sync: ${agent.sync_status || 'N/A'}`,
          timestamp: new Date(),
        });
        return;
      }

      const diffMs = Date.now() - lastSeen.getTime();
      const diffMin = Math.floor(diffMs / 60000);

      let status: TestStatus = 'ok';
      let message = '';

      if (diffMin < 2) {
        status = 'ok';
        message = `Agente "${agent.name}" online — último heartbeat há ${diffMin < 1 ? 'menos de 1' : diffMin} min`;
      } else if (diffMin < 10) {
        status = 'warning';
        message = `Agente "${agent.name}" — último heartbeat há ${diffMin} min (possível lentidão)`;
      } else {
        status = 'error';
        message = `Agente "${agent.name}" — último heartbeat há ${diffMin} min (provavelmente offline)`;
      }

      setHeartbeatResult({
        status,
        message,
        details: `Status: ${agent.status} | Sync: ${agent.sync_status || 'N/A'} | Último: ${lastSeen.toLocaleString()}`,
        timestamp: new Date(),
      });
    } catch (e: any) {
      setHeartbeatResult({ status: 'error', message: e.message || 'Erro desconhecido', timestamp: new Date() });
    }
  };

  const testSyncEndpoint = async () => {
    setSyncEndpointResult({ status: 'running', message: 'Verificando...' });
    try {
      // First get the agent token
      const { data: agents, error: agentError } = await supabase
        .from('local_agents')
        .select('id, name, token')
        .order('last_seen_at', { ascending: false })
        .limit(1);

      if (agentError) {
        setSyncEndpointResult({ status: 'error', message: `Erro ao buscar agente: ${agentError.message}`, timestamp: new Date() });
        return;
      }

      if (!agents || agents.length === 0) {
        setSyncEndpointResult({ status: 'warning', message: 'Nenhum agente disponível para teste', timestamp: new Date() });
        return;
      }

      const agent = agents[0];
      const start = Date.now();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/agent-sync/download-devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-token': agent.token,
        },
        body: JSON.stringify({}),
      });

      const duration = Date.now() - start;
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setSyncEndpointResult({
          status: 'error',
          message: `Edge Function agent-sync retornou ${response.status}: ${data?.error || response.statusText}`,
          details: `Agente: ${agent.name} | Duração: ${duration}ms`,
          timestamp: new Date(),
        });
        return;
      }

      const deviceCount = Array.isArray(data?.devices) ? data.devices.length : '?';
      setSyncEndpointResult({
        status: 'ok',
        message: `Cloud respondeu com sucesso (${duration}ms) — ${deviceCount} dispositivo(s)`,
        details: `Agente: ${agent.name} | Endpoint: agent-sync/download-devices`,
        timestamp: new Date(),
      });
    } catch (e: any) {
      setSyncEndpointResult({ status: 'error', message: e.message || 'Erro desconhecido', timestamp: new Date() });
    }
  };

  const testLocalServer = async () => {
    if (!runtimeProfile.isDesktop) {
      setLocalServerResult({
        status: 'warning',
        message: 'Teste disponível apenas no ambiente Desktop',
        timestamp: new Date(),
      });
      return;
    }

    setLocalServerResult({ status: 'running', message: 'Verificando servidor local...' });
    try {
      const start = Date.now();
      const health = await localHealth.check();
      const duration = Date.now() - start;

      let syncInfo = '';
      try {
        const syncStatus = await localSync.getStatus();
        syncInfo = ` | Sync: ${syncStatus.online ? 'Online' : 'Offline'} | Pendências: ${syncStatus.pendingCount || 0}`;
        if (syncStatus.lastSync) {
          syncInfo += ` | Último sync: ${new Date(syncStatus.lastSync).toLocaleString()}`;
        }
      } catch {
        syncInfo = ' | Sync: Erro ao consultar';
      }

      setLocalServerResult({
        status: 'ok',
        message: `Servidor local acessível (${duration}ms)`,
        details: `Saúde: OK${syncInfo}`,
        timestamp: new Date(),
      });
    } catch (e: any) {
      setLocalServerResult({
        status: 'error',
        message: `Servidor local inacessível: ${e.message || 'Sem resposta'}`,
        details: 'Verifique se o serviço local está em execução na porta 3001',
        timestamp: new Date(),
      });
    }
  };

  const testRoundtrip = async () => {
    setRoundtripResult({ status: 'running', message: 'Verificando roundtrip...' });
    try {
      const start = Date.now();

      // Test DB
      const { error: dbError } = await supabase.from('system_settings').select('id').limit(1);
      if (dbError) {
        setRoundtripResult({ status: 'error', message: `DB inacessível: ${dbError.message}`, timestamp: new Date() });
        return;
      }

      // Test Auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setRoundtripResult({ status: 'error', message: `Auth falhou: ${authError.message}`, timestamp: new Date() });
        return;
      }

      const duration = Date.now() - start;
      setRoundtripResult({
        status: 'ok',
        message: `Roundtrip completo em ${duration}ms`,
        details: `DB: OK | Auth: ${user?.email || 'OK'} | Sessão validada no servidor`,
        timestamp: new Date(),
      });
    } catch (e: any) {
      setRoundtripResult({ status: 'error', message: e.message || 'Erro desconhecido', timestamp: new Date() });
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    await testRoundtrip();
    await testHeartbeat();
    await testSyncEndpoint();
    if (runtimeProfile.isDesktop) {
      await testLocalServer();
    }
    setIsRunningAll(false);
  };

  const getTestIcon = (status: TestStatus) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />;
      default: return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const getTestBadge = (status: TestStatus) => {
    switch (status) {
      case 'ok': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">OK</Badge>;
      case 'warning': return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Atenção</Badge>;
      case 'error': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Erro</Badge>;
      case 'running': return <Badge variant="outline">Testando...</Badge>;
      default: return <Badge variant="outline">Não testado</Badge>;
    }
  };

  const tests = [
    {
      id: 'roundtrip',
      label: 'Web → Cloud → DB (Roundtrip)',
      description: 'Valida conexão com banco de dados e autenticação',
      icon: <Globe className="h-4 w-4" />,
      result: roundtripResult,
      action: testRoundtrip,
    },
    {
      id: 'heartbeat',
      label: 'Cloud → Agent Heartbeat',
      description: 'Verifica se o Local Server reportou heartbeat recente',
      icon: <Activity className="h-4 w-4" />,
      result: heartbeatResult,
      action: testHeartbeat,
    },
    {
      id: 'sync-endpoint',
      label: 'Cloud → Agent Sync Endpoint',
      description: 'Invoca a Edge Function agent-sync com token do agente',
      icon: <ArrowDownUp className="h-4 w-4" />,
      result: syncEndpointResult,
      action: testSyncEndpoint,
    },
    ...(runtimeProfile.isDesktop ? [{
      id: 'local-server',
      label: 'Local Server Health',
      description: 'Testa conectividade com o servidor local (porta 3001)',
      icon: <Server className="h-4 w-4" />,
      result: localServerResult,
      action: testLocalServer,
    }] : []),
  ];

  return (
    <Card className="border-2 border-blue-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-500" />
            Conectividade Inter-Camadas
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={runAllTests}
            disabled={isRunningAll}
            className="gap-2"
          >
            <RefreshCw className={`h-3 w-3 ${isRunningAll ? 'animate-spin' : ''}`} />
            {isRunningAll ? 'Testando...' : 'Testar Tudo'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Valida a cadeia completa de comunicação: Web/Desktop → Cloud → Local Server
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Visual diagram */}
          <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono text-center text-muted-foreground">
            Web/Desktop App → ☁ Cloud (DB + Edge Functions) → 🖥 Local Server (Express)
          </div>

          <Separator />

          {tests.map((test, idx) => (
            <div key={test.id} className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTestIcon(test.result.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      {test.icon}
                      <span className="font-medium text-sm">{test.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{test.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTestBadge(test.result.status)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={test.action}
                    disabled={test.result.status === 'running' || isRunningAll}
                    className="h-7 px-2"
                  >
                    <RefreshCw className={`h-3 w-3 ${test.result.status === 'running' ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {test.result.status !== 'idle' && test.result.status !== 'running' && (
                <div className={`p-2 rounded text-xs ${
                  test.result.status === 'ok' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                  test.result.status === 'warning' ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' :
                  'bg-red-500/10 text-red-700 dark:text-red-400'
                }`}>
                  <p>{test.result.message}</p>
                  {test.result.details && (
                    <p className="mt-1 opacity-75">{test.result.details}</p>
                  )}
                  {test.result.timestamp && (
                    <p className="mt-1 opacity-50">Testado: {test.result.timestamp.toLocaleTimeString()}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Interpretation */}
          <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
            <p className="font-medium">Como interpretar:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Roundtrip OK:</strong> Web app se comunica com a nuvem normalmente</li>
              <li><strong>Heartbeat OK:</strong> Local Server está enviando sinais de vida para a nuvem</li>
              <li><strong>Sync Endpoint OK:</strong> A nuvem consegue servir dados ao Local Server</li>
              {runtimeProfile.isDesktop && (
                <li><strong>Local Server OK:</strong> O servidor local está acessível e sincronizando</li>
              )}
              <li><strong>Heartbeat Erro + Sync OK:</strong> O agente pode estar parado mas o endpoint da nuvem funciona</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
