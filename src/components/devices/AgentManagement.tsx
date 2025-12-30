import { useState } from 'react';
import { useLocalAgents, useAgentCommands } from '@/hooks/useLocalAgents';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  XCircle,
  Loader2,
  Download,
  Key
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AGENT_RELAY_URL = `https://qdscawiwjhzgiqroqkik.supabase.co/functions/v1/agent-relay`;

export function AgentManagement() {
  const { selectedProjectId } = useProject();
  const { agents, isLoading, createAgent, deleteAgent, regenerateToken } = useLocalAgents(selectedProjectId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentToken, setNewAgentToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

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
    
    if (status === 'online' && isRecent) {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <Wifi className="h-3 w-3 mr-1" />
          Online
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
        <WifiOff className="h-3 w-3 mr-1" />
        Offline
      </Badge>
    );
  };

  const pythonAgentScript = `#!/usr/bin/env python3
"""
Agente Local ControlID - Conecta leitores em rede local ao sistema na nuvem
"""
import requests
import time
import json

AGENT_TOKEN = "SEU_TOKEN_AQUI"
RELAY_URL = "${AGENT_RELAY_URL}"
POLL_INTERVAL = 5  # segundos

def poll_commands():
    """Busca comandos pendentes no servidor"""
    try:
        response = requests.get(
            RELAY_URL,
            headers={
                "Authorization": f"Bearer {AGENT_TOKEN}",
                "X-Agent-Version": "1.0.0"
            },
            timeout=30
        )
        if response.ok:
            return response.json().get("commands", [])
    except Exception as e:
        print(f"Erro ao buscar comandos: {e}")
    return []

def execute_command(cmd):
    """Executa comando no dispositivo local"""
    device = cmd.get("devices", {})
    ip = device.get("controlid_ip_address")
    command = cmd.get("command")
    payload = cmd.get("payload", {})
    
    try:
        # Exemplo: liberar acesso
        if command == "release_access":
            response = requests.post(
                f"http://{ip}/execute.fcgi?cmd=sec_box",
                json={"action": "open", "door": payload.get("door_id", 1)},
                timeout=10
            )
            return {"success": True, "result": response.json()}
        
        # Exemplo: verificar status
        if command == "get_status":
            response = requests.get(f"http://{ip}/system_info.fcgi", timeout=10)
            return {"success": True, "result": response.json()}
            
        return {"success": False, "error": f"Comando desconhecido: {command}"}
        
    except Exception as e:
        return {"success": False, "error": str(e)}

def send_results(results):
    """Envia resultados dos comandos para o servidor"""
    try:
        requests.post(
            f"{RELAY_URL}/result",
            headers={"Authorization": f"Bearer {AGENT_TOKEN}"},
            json=results,
            timeout=30
        )
    except Exception as e:
        print(f"Erro ao enviar resultados: {e}")

def main():
    print("Agente Local ControlID iniciado")
    while True:
        commands = poll_commands()
        if commands:
            print(f"Recebidos {len(commands)} comandos")
            results = []
            for cmd in commands:
                result = execute_command(cmd)
                results.append({
                    "command_id": cmd["id"],
                    "success": result["success"],
                    "result": result.get("result"),
                    "error": result.get("error")
                })
            send_results(results)
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Agentes Locais</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie agentes que conectam leitores em redes locais ao sistema
          </p>
        </div>
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
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
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
      </div>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList>
          <TabsTrigger value="agents">Agentes ({agents.length})</TabsTrigger>
          <TabsTrigger value="setup">Instalação</TabsTrigger>
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
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Agente
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {agents.map((agent) => (
                <Card key={agent.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
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
                      </div>
                      
                      {selectedAgent === agent.id && newAgentToken && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <p className="text-sm text-yellow-600 mb-2">Novo token gerado:</p>
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
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedAgent(agent.id);
                            // Open commands dialog
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

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
                  <Label>Script Python</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(pythonAgentScript, 'python-script')}
                  >
                    {copiedField === 'python-script' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    Copiar
                  </Button>
                </div>
                <ScrollArea className="h-64 w-full rounded-md border">
                  <pre className="p-4 text-xs font-mono">
                    {pythonAgentScript}
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
                    <p>Copie o script acima e salve como <code className="bg-muted px-1 rounded">controlid_agent.py</code></p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">3</div>
                    <p>Substitua <code className="bg-muted px-1 rounded">SEU_TOKEN_AQUI</code> pelo token do agente</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">4</div>
                    <p>Execute: <code className="bg-muted px-1 rounded">python controlid_agent.py</code></p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">5</div>
                    <p>Configure como serviço para execução automática (opcional)</p>
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
                <p>O agente local funciona como uma ponte entre o sistema na nuvem e os leitores em rede local:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>O agente faz polling no servidor a cada 5 segundos buscando comandos</li>
                  <li>Quando um comando é recebido, o agente executa no dispositivo local</li>
                  <li>O resultado é enviado de volta para o servidor</li>
                  <li>O agente também envia heartbeats com status dos dispositivos</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}