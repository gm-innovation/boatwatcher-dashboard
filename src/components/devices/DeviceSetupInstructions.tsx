import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useDeviceTokens } from '@/hooks/useDeviceTokens';
import type { Device } from '@/types/supabase';
import { 
  Copy, 
  Check, 
  Key, 
  Link, 
  Settings, 
  Trash2, 
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeviceSetupInstructionsProps {
  device: Device;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WEBHOOK_BASE_URL = `https://qdscawiwjhzgiqroqkik.supabase.co/functions/v1/controlid-webhook`;

export function DeviceSetupInstructions({ device, open, onOpenChange }: DeviceSetupInstructionsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState('');
  const [showNewToken, setShowNewToken] = useState<string | null>(null);
  
  const { tokens, isLoading, createToken, revokeToken, deleteToken } = useDeviceTokens(device.id);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreateToken = async () => {
    const result = await createToken.mutateAsync({ name: newTokenName || undefined });
    setShowNewToken(result.plainToken);
    setNewTokenName('');
  };

  const webhookUrl = `${WEBHOOK_BASE_URL}`;
  const activeToken = tokens.find(t => t.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração do Dispositivo: {device.name}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Tabs defaultValue="webhook" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="webhook">Webhook</TabsTrigger>
              <TabsTrigger value="tokens">Tokens de API</TabsTrigger>
            </TabsList>

            <TabsContent value="webhook" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    URL do Webhook
                  </CardTitle>
                  <CardDescription>
                    Configure esta URL no leitor ControlID para enviar eventos de acesso
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      value={webhookUrl} 
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                    >
                      {copiedField === 'webhook' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  {activeToken && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">URL com Token (mais segura)</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={`${webhookUrl}?token=${activeToken.token.substring(0, 8)}...`} 
                          readOnly 
                          className="font-mono text-sm"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => copyToClipboard(`${webhookUrl}?token=${activeToken.token}`, 'webhook-token')}
                        >
                          {copiedField === 'webhook-token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Instruções de Configuração</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">1</div>
                      <div>
                        <p className="font-medium">Acesse o painel do ControlID</p>
                        <p className="text-muted-foreground">Entre no painel web do dispositivo usando o IP: <code className="bg-muted px-1 rounded">{device.controlid_ip_address}</code></p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">2</div>
                      <div>
                        <p className="font-medium">Configure o Webhook</p>
                        <p className="text-muted-foreground">Navegue até Configurações → Integração → Webhook e cole a URL acima</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">3</div>
                      <div>
                        <p className="font-medium">Configure o Payload</p>
                        <p className="text-muted-foreground">Selecione formato JSON e inclua os campos: serial_number, user_id, direction, time</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">4</div>
                      <div>
                        <p className="font-medium">Teste a Conexão</p>
                        <p className="text-muted-foreground">Use o botão de teste no painel do ControlID para verificar se os eventos estão chegando</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Formato do Payload Esperado</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "serial_number": "${device.controlid_serial_number}",
  "user_id": "uuid-do-trabalhador",
  "direction": "entry" | "exit",
  "time": 1234567890,
  "score": 0.95,
  "event_type": "access"
}`}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tokens" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Tokens de API
                  </CardTitle>
                  <CardDescription>
                    Tokens permitem autenticar requisições do dispositivo de forma segura
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {showNewToken && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Token criado com sucesso!</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Copie o token abaixo. Ele não será exibido novamente.
                      </p>
                      <div className="flex gap-2">
                        <Input 
                          value={showNewToken} 
                          readOnly 
                          className="font-mono text-xs"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => copyToClipboard(showNewToken, 'new-token')}
                        >
                          {copiedField === 'new-token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowNewToken(null)}
                        className="mt-2"
                      >
                        Fechar
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input 
                      placeholder="Nome do token (opcional)"
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                    />
                    <Button onClick={handleCreateToken} disabled={createToken.isPending}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Token
                    </Button>
                  </div>

                  <Separator />

                  {isLoading ? (
                    <div className="text-center py-4 text-muted-foreground">Carregando...</div>
                  ) : tokens.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum token criado</p>
                      <p className="text-xs">Crie um token para autenticar as requisições do dispositivo</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tokens.map((token) => (
                        <div 
                          key={token.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            token.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{token.name}</span>
                              {token.is_active ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                                  Revogado
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-mono">{token.token.substring(0, 12)}...</span>
                              {token.last_used_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Usado {formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true, locale: ptBR })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => copyToClipboard(token.token, token.id)}
                            >
                              {copiedField === token.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                            {token.is_active && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => revokeToken.mutate(token.id)}
                                className="text-orange-500 hover:text-orange-600"
                              >
                                <AlertCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteToken.mutate(token.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Como usar o Token</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Adicione o token como parâmetro na URL ou no header da requisição:
                  </p>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Via Query Parameter:</Label>
                    <code className="block bg-muted p-2 rounded text-xs">
                      {webhookUrl}?token=SEU_TOKEN
                    </code>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Via Header:</Label>
                    <code className="block bg-muted p-2 rounded text-xs">
                      Authorization: Bearer SEU_TOKEN
                    </code>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Via Header X-API-Key:</Label>
                    <code className="block bg-muted p-2 rounded text-xs">
                      X-API-Key: SEU_TOKEN
                    </code>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}