import { useState } from 'react';
import { useLocalAgents, useAgentCommands } from '@/hooks/useLocalAgents';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  Clock,
  Terminal,
  CheckCircle2,
  Loader2,
  Download,
  Key,
  Cloud,
  CloudUpload,
  DatabaseZap,
  ArrowUpDown,
  Play,
  Square,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AGENT_RELAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-relay`;

export function AgentManagement() {
  const { selectedProjectId } = useProject();
  const {
    agents,
    isLoading,
    createAgent,
    deleteAgent,
    regenerateToken,
    startAgent,
    stopAgent,
    isLocalRuntime,
    isDesktopFallback,
    isDesktopRuntime,
  } = useLocalAgents(selectedProjectId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentToken, setNewAgentToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const desktopAgent = agents[0];
  useAgentCommands(isLocalRuntime ? null : selectedAgent);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;

    const result = await createAgent.mutateAsync({
      name: newAgentName,
      projectId: selectedProjectId || undefined
    });
    setNewAgentToken(result.plainToken);
    setNewAgentName('');
  };

  const handleRegenerateToken = async (agentId: string) => {
    const result = await regenerateToken.mutateAsync(agentId);
    setNewAgentToken(result.plainToken);
    setSelectedAgent(agentId);
  };

  const getStatusBadge = (status: string, lastSeenAt: string | null) => {
    const isRecent = lastSeenAt && new Date(lastSeenAt) > new Date(Date.now() - 60000);

    if (status === 'online' && (isRecent || isLocalRuntime)) {
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          <Wifi className="h-3 w-3 mr-1" />
          Online
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
        <WifiOff className="h-3 w-3 mr-1" />
        Offline
      </Badge>
    );
  };

  const configTemplate = `{
  "agent_token": "SEU_TOKEN_AQUI",
  "relay_url": "${AGENT_RELAY_URL.replace('/agent-relay', '/agent-sync')}",
  "db_path": "agent_data.db",
  "poll_interval": 5,
  "sync_interval": 30,
  "heartbeat_interval": 60,
  "devices": [
    {
      "ip": "192.168.1.100",
      "device_id": "ID_DO_DISPOSITIVO",
      "name": "Leitor Portaria",
      "user": "admin",
      "password": "admin"
    }
  ]
}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Agentes Locais</h2>
          <p className="text-sm text-muted-foreground">
            {isLocalRuntime
              ? 'Controle o processo local que monitora dispositivos e sincronização no desktop.'
              : isDesktopFallback
                ? 'O desktop está operando com fallback em nuvem. Dados administrativos seguem online, mas os controles locais do agente ficam indisponíveis até o servidor local voltar.'
                : 'Gerencie agentes que conectam leitores em redes locais ao sistema.'}
          </p>
        </div>

        {isLocalRuntime ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => startAgent.mutate()}
              disabled={startAgent.isPending || desktopAgent?.status === 'online'}
            >
              {startAgent.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Iniciar Agente
            </Button>
            <Button
              variant="outline"
              onClick={() => stopAgent.mutate()}
              disabled={stopAgent.isPending || desktopAgent?.status !== 'online'}
            >
              {stopAgent.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
              Parar Agente
            </Button>
          </div>
        ) : isDesktopFallback ? (
          <Button variant="outline" disabled>
            <Cloud className="h-4 w-4 mr-2" />
            Controles locais indisponíveis
          </Button>
        ) : (
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setNewAgentToken(null);
              setNewAgentName('');
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Agente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Agente Local</DialogTitle>
              </DialogHeader>

              {newAgentToken ? (
                <div className="space-y-4">
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Agente criado com sucesso!</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Copie o token abaixo e configure no script do agente. Este token não será exibido novamente.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={newAgentToken}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(newAgentToken, 'new-agent-token')}
                      >
                        {copiedField === 'new-agent-token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setNewAgentToken(null);
                    }}
                  >
                    Fechar
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do Agente</Label>
                    <Input
                      placeholder="Ex: Agente Portaria Principal"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateAgent} disabled={createAgent.isPending || !newAgentName.trim()}>
                      {createAgent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar Agente
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList>
          <TabsTrigger value="agents">Agentes ({agents.length})</TabsTrigger>
          {!isLocalRuntime && <TabsTrigger value="setup">Instalação</TabsTrigger>}
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Server className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Nenhum agente configurado
                </p>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Crie um agente para conectar leitores em redes locais
                </p>
                {!isLocalRuntime && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Agente
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {agents.map((agent) => (
                <Card key={agent.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Server className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          {agent.ip_address && (
                            <p className="text-sm text-muted-foreground">IP: {agent.ip_address}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(agent.status, agent.last_seen_at)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {agent.version && (
                          <span>Versão: {agent.version}</span>
                        )}
                        {agent.last_seen_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Visto {formatDistanceToNow(new Date(agent.last_seen_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        )}
                        {isLocalRuntime && (
                          <span>Dispositivos monitorados: {Number(agent.configuration?.devicesCount || 0)}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {agent.sync_status && (
                          <Badge variant="outline" className={
                            agent.sync_status === 'online'
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }>
                            {agent.sync_status === 'online' ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Sync online</>
                            ) : (
                              <><ArrowUpDown className="h-3 w-3 mr-1" /> Sync offline</>
                            )}
                          </Badge>
                        )}
                        {(agent.pending_sync_count ?? 0) > 0 && (
                          <Badge variant="secondary">
                            <DatabaseZap className="h-3 w-3 mr-1" />
                            {agent.pending_sync_count} pendências
                          </Badge>
                        )}
                        {agent.last_sync_at && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            Sync {formatDistanceToNow(new Date(agent.last_sync_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        )}
                      </div>

                      {selectedAgent === agent.id && newAgentToken && !isLocalRuntime && (
                        <div className="p-3 bg-accent/30 border border-border rounded-lg">
                          <p className="text-sm mb-2">Novo token gerado:</p>
                          <div className="flex gap-2">
                            <Input
                              value={newAgentToken}
                              readOnly
                              className="font-mono text-xs"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => copyToClipboard(newAgentToken, `token-${agent.id}`)}
                            >
                              {copiedField === `token-${agent.id}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        {!isLocalRuntime && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAgent(agent.id);
                              }}
                            >
                              <Terminal className="h-4 w-4 mr-1" />
                              Comandos
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRegenerateToken(agent.id)}
                              disabled={regenerateToken.isPending}
                            >
                              <Key className="h-4 w-4 mr-1" />
                              Regenerar Token
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja remover este agente?')) {
                                  deleteAgent.mutate(agent.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {!isLocalRuntime && (
          <TabsContent value="setup" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Script do Agente Local
                </CardTitle>
                <CardDescription>
                  Execute este script Python em um computador na mesma rede dos leitores ControlID
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Requisitos</Label>
                  </div>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Python 3.7 ou superior</li>
                    <li>Biblioteca requests: <code className="bg-muted px-1 rounded">pip install requests</code></li>
                    <li>Acesso à rede local dos leitores</li>
                    <li>Acesso à internet para comunicação com o servidor</li>
                  </ul>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Script Python (v2.0 — offline-first)</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href="/controlid_agent.py" download="controlid_agent.py">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </a>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Script com SQLite local, sync queue e suporte offline. Baixe e configure com o <code className="bg-muted px-1 rounded">config.json</code> abaixo.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>config.json (template)</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(configTemplate, 'config-json')}
                    >
                      {copiedField === 'config-json' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      Copiar
                    </Button>
                  </div>
                  <ScrollArea className="h-48 w-full rounded-md border">
                    <pre className="p-4 text-xs font-mono">
                      {configTemplate}
                    </pre>
                  </ScrollArea>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Instruções de Instalação</Label>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">1</div>
                      <p>Crie um novo agente na aba "Agentes" e copie o token gerado</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">2</div>
                      <p>Baixe o script <code className="bg-muted px-1 rounded">controlid_agent.py</code> acima</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">3</div>
                      <p>Copie o template <code className="bg-muted px-1 rounded">config.json</code> e preencha o token, IPs dos dispositivos e device IDs</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">4</div>
                      <p>Instale dependências: <code className="bg-muted px-1 rounded">pip install requests</code></p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">5</div>
                      <p>Execute: <code className="bg-muted px-1 rounded">python controlid_agent.py</code></p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Arquitetura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>O agente v2.0 funciona com arquitetura offline-first:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Eventos dos leitores são salvos localmente em SQLite</li>
                    <li>Uma thread de sync envia logs pendentes para a nuvem em lote</li>
                    <li>Workers são sincronizados periodicamente do servidor</li>
                    <li>Heartbeats reportam status e contagem de pendências</li>
                    <li>Se a internet cair, os dados ficam na fila local até reconectar</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
