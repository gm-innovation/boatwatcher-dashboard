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
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeviceSetupInstructionsProps {
  device: Device;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const API_BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api`;

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

  const endpoints = {
    events: `${API_BASE_URL}/notifications/dao`,
    heartbeat: `${API_BASE_URL}/notifications/device_is_alive`,
    accessPhoto: `${API_BASE_URL}/notifications/access_photo`,
  };

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
                    Endpoints do equipamento
                  </CardTitle>
                  <CardDescription>
                    Use os endpoints abaixo conforme a documentação do ControlID.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'Eventos de acesso (DAO)', value: endpoints.events, key: 'events' },
                    { label: 'Heartbeat do dispositivo', value: endpoints.heartbeat, key: 'heartbeat' },
                    { label: 'Upload da foto de acesso', value: endpoints.accessPhoto, key: 'access-photo' },
                  ].map((item) => (
                    <div key={item.key} className="space-y-2">
                      <Label className="text-sm text-muted-foreground">{item.label}</Label>
                      <div className="flex gap-2">
                        <Input value={item.value} readOnly className="font-mono text-sm" />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(item.value, item.key)}
                        >
                          {copiedField === item.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ))}

                  {activeToken && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Exemplo com token</Label>
                      <div className="flex gap-2">
                        <Input
                          value={`${endpoints.events}?token=${activeToken.token.substring(0, 8)}...`}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(`${endpoints.events}?token=${activeToken.token}`, 'events-token')}
                        >
                          {copiedField === 'events-token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
                        <p className="font-medium">Configure os webhooks</p>
                        <p className="text-muted-foreground">Aponte eventos de acesso para <code className="bg-muted px-1 rounded">/notifications/dao</code> e o heartbeat para <code className="bg-muted px-1 rounded">/notifications/device_is_alive</code>.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">3</div>
                      <div>
                        <p className="font-medium">Habilite o envio da foto</p>
                        <p className="text-muted-foreground">No <code className="bg-muted px-1 rounded">set_configuration</code>, envie <code className="bg-muted px-1 rounded">monitor.enable_photo_upload = 1</code> e configure o endpoint <code className="bg-muted px-1 rounded">/notifications/access_photo</code>.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">4</div>
                      <div>
                        <p className="font-medium">Valide a configuração</p>
                        <p className="text-muted-foreground">Use <code className="bg-muted px-1 rounded">get_configuration</code> com <code className="bg-muted px-1 rounded">{'{ monitor: [enable_photo_upload] }'}</code> para confirmar que o upload está ativo.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">5</div>
                      <div>
                        <p className="font-medium">Teste a conexão</p>
                        <p className="text-muted-foreground">Faça uma identificação no equipamento e confirme se o evento e a foto aparecem no histórico recente.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payloads esperados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">POST /api/notifications/access_photo</Label>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto mt-2">
{`{
  "device_id": "${device.controlid_serial_number}",
  "time": "1532977090",
  "portal_id": "1",
  "identifier_id": "0",
  "event": "7",
  "user_id": "0",
  "access_photo": "jpeg_em_base64"
}`}
                    </pre>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">set_configuration / get_configuration</Label>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto mt-2">
{`set_configuration
{
  monitor: {
    enable_photo_upload: 1
  }
}

get_configuration
{
  monitor: [enable_photo_upload]
}`}
                    </pre>
                  </div>
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
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-primary">
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
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
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
                                className="text-muted-foreground hover:text-foreground"
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
                      {endpoints.events}?token=SEU_TOKEN
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
