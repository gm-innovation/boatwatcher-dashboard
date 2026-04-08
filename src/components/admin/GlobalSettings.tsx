import { useState, useEffect, useRef } from 'react';
import { useSystemSettings, useUpdateSystemSetting, useSystemSetting } from '@/hooks/useSystemSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, RefreshCw, ImagePlus, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useRuntimeProfile } from '@/hooks/useRuntimeProfile';
import { localSync } from '@/lib/localServerProvider';

export const GlobalSettings = () => {
  const runtimeProfile = useRuntimeProfile();
  const isLocalRuntime = runtimeProfile.isDesktop && runtimeProfile.localServerAvailable;
  const { data: settings = [], isLoading, refetch } = useSystemSettings();
  const updateSetting = useUpdateSystemSetting();
  const { data: logoSetting } = useSystemSetting('system_logo');

  const [lightLogoUrl, setLightLogoUrl] = useState<string | null>(null);
  const [darkLogoUrl, setDarkLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const lightInputRef = useRef<HTMLInputElement>(null);
  const darkInputRef = useRef<HTMLInputElement>(null);

  // Read-only mode (desktop only)
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [readOnlyLoading, setReadOnlyLoading] = useState(false);

  useEffect(() => {
    if (isLocalRuntime) {
      localSync.getReadOnlyMode().then(r => setReadOnlyMode(r.enabled)).catch(() => {});
    }
  }, [isLocalRuntime]);

  useEffect(() => {
    if (logoSetting?.value) {
      const val = logoSetting.value as any;
      if (val.light_url) setLightLogoUrl(val.light_url);
      if (val.dark_url) setDarkLogoUrl(val.dark_url);
    }
  }, [logoSetting]);

  const handleLogoUpload = async (mode: 'light' | 'dark', file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `system/logo_${mode}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(path);

      const url = urlData.publicUrl + '?t=' + Date.now();

      const newLight = mode === 'light' ? url : lightLogoUrl;
      const newDark = mode === 'dark' ? url : darkLogoUrl;

      if (mode === 'light') setLightLogoUrl(url);
      else setDarkLogoUrl(url);

      updateSetting.mutate({
        key: 'system_logo',
        value: { light_url: newLight, dark_url: newDark },
        description: 'Logo do sistema (modo claro e escuro)',
      });

      localStorage.setItem(mode === 'light' ? 'company_light' : 'company_dark', url);
    } catch (err: any) {
      toast({ title: 'Erro ao fazer upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const [facialThreshold, setFacialThreshold] = useState(0.7);
  const [logRetentionDays, setLogRetentionDays] = useState(365);
  const [deviceOfflineMinutes, setDeviceOfflineMinutes] = useState(5);
  const [documentWarningDays, setDocumentWarningDays] = useState([30, 15, 7]);

  // Load current settings
  useState(() => {
    const facialSetting = settings.find(s => s.key === 'facial_recognition_threshold');
    if (facialSetting?.value?.min_score) {
      setFacialThreshold(facialSetting.value.min_score);
    }

    const retentionSetting = settings.find(s => s.key === 'log_retention_days');
    if (retentionSetting?.value?.days) {
      setLogRetentionDays(retentionSetting.value.days);
    }

    const notificationSetting = settings.find(s => s.key === 'notification_settings');
    if (notificationSetting?.value) {
      if (notificationSetting.value.device_offline_minutes) {
        setDeviceOfflineMinutes(notificationSetting.value.device_offline_minutes);
      }
      if (notificationSetting.value.document_expiry_warning_days) {
        setDocumentWarningDays(notificationSetting.value.document_expiry_warning_days);
      }
    }
  });

  const handleSaveFacialThreshold = () => {
    updateSetting.mutate({
      key: 'facial_recognition_threshold',
      value: { min_score: facialThreshold },
      description: 'Limiar mínimo de confiança para reconhecimento facial',
    });
  };

  const handleSaveRetention = () => {
    updateSetting.mutate({
      key: 'log_retention_days',
      value: { days: logRetentionDays },
      description: 'Dias de retenção de logs de acesso',
    });
  };

  const handleSaveNotifications = () => {
    updateSetting.mutate({
      key: 'notification_settings',
      value: { 
        device_offline_minutes: deviceOfflineMinutes,
        document_expiry_warning_days: documentWarningDays,
      },
      description: 'Configurações de notificações automáticas',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações do Sistema
          </h2>
          <p className="text-sm text-muted-foreground">Ajuste os parâmetros globais do sistema</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Recarregar
        </Button>
      </div>

      {/* Read-Only Mode (desktop only) */}
      {isLocalRuntime && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {readOnlyMode ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              Modo de Operação
              <Badge variant={readOnlyMode ? 'default' : 'secondary'} className="ml-2">
                {readOnlyMode ? 'Somente Leitura' : 'Leitura e Escrita'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Quando ativo, o sistema apenas lê dados e logs dos dispositivos, sem cadastrar ou remover trabalhadores no hardware. Ideal para operação paralela com outro sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="read-only-toggle">Modo Somente-Leitura</Label>
                <p className="text-xs text-muted-foreground">
                  {readOnlyMode
                    ? '✅ Leitura de logs • ✅ Reverse sync • ❌ Enrollment • ❌ Full resync'
                    : 'O sistema opera normalmente com leitura e escrita no hardware.'}
                </p>
              </div>
              <Switch
                id="read-only-toggle"
                checked={readOnlyMode}
                disabled={readOnlyLoading}
                onCheckedChange={async (checked) => {
                  setReadOnlyLoading(true);
                  try {
                    await localSync.setReadOnlyMode(checked);
                    setReadOnlyMode(checked);
                    toast({
                      title: checked ? 'Modo somente-leitura ativado' : 'Modo leitura e escrita ativado',
                      description: checked
                        ? 'O sistema não fará mais enrollment ou remoção de trabalhadores no hardware.'
                        : 'O sistema voltou a operar com escrita no hardware.',
                    });
                  } catch (err: any) {
                    toast({ title: 'Erro', description: err.message, variant: 'destructive' });
                  } finally {
                    setReadOnlyLoading(false);
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo do Sistema</CardTitle>
          <CardDescription>Defina a logo exibida no cabeçalho do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Light mode */}
            <div className="space-y-2">
              <Label>Modo Claro</Label>
              <input
                ref={lightInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload('light', file);
                  e.target.value = '';
                }}
              />
              <Button variant="outline" className="w-full gap-2" onClick={() => lightInputRef.current?.click()} disabled={uploading}>
                <ImagePlus className="h-4 w-4" />
                {uploading ? 'Enviando...' : 'Selecionar imagem'}
              </Button>
              {lightLogoUrl && (
                <div className="border rounded-md p-4 bg-white flex items-center justify-center min-h-[80px]">
                  <img src={lightLogoUrl} alt="Logo modo claro" className="max-h-16 max-w-full object-contain" />
                </div>
              )}
            </div>
            {/* Dark mode */}
            <div className="space-y-2">
              <Label>Modo Escuro</Label>
              <input
                ref={darkInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload('dark', file);
                  e.target.value = '';
                }}
              />
              <Button variant="outline" className="w-full gap-2" onClick={() => darkInputRef.current?.click()} disabled={uploading}>
                <ImagePlus className="h-4 w-4" />
                {uploading ? 'Enviando...' : 'Selecionar imagem'}
              </Button>
              {darkLogoUrl && (
                <div className="border rounded-md p-4 bg-zinc-900 flex items-center justify-center min-h-[80px]">
                  <img src={darkLogoUrl} alt="Logo modo escuro" className="max-h-16 max-w-full object-contain" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facial Recognition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconhecimento Facial</CardTitle>
          <CardDescription>Configurações do sistema de reconhecimento facial</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Limiar de Confiança Mínimo</Label>
              <span className="text-sm font-medium">{(facialThreshold * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[facialThreshold * 100]}
              onValueChange={([value]) => setFacialThreshold(value / 100)}
              min={50}
              max={100}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              Acessos com score abaixo deste valor serão negados. Valores mais altos são mais seguros, mas podem gerar mais negações.
            </p>
          </div>
          <Button onClick={handleSaveFacialThreshold} disabled={updateSetting.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Log Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retenção de Dados</CardTitle>
          <CardDescription>Período de armazenamento de logs e registros</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="retention">Dias de Retenção de Logs</Label>
            <Input
              id="retention"
              type="number"
              value={logRetentionDays}
              onChange={(e) => setLogRetentionDays(parseInt(e.target.value) || 365)}
              min={30}
              max={3650}
            />
            <p className="text-xs text-muted-foreground">
              Logs de acesso mais antigos que este período serão arquivados.
            </p>
          </div>
          <Button onClick={handleSaveRetention} disabled={updateSetting.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificações Automáticas</CardTitle>
          <CardDescription>Configurações de alertas e notificações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offlineMinutes">Alerta de Dispositivo Offline (minutos)</Label>
            <Input
              id="offlineMinutes"
              type="number"
              value={deviceOfflineMinutes}
              onChange={(e) => setDeviceOfflineMinutes(parseInt(e.target.value) || 5)}
              min={1}
              max={60}
            />
            <p className="text-xs text-muted-foreground">
              Gerar alerta quando um dispositivo ficar offline por mais de X minutos.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Alertas de Vencimento de Documentos</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Dias de antecedência para avisar sobre documentos vencendo: {documentWarningDays.join(', ')} dias
            </p>
          </div>

          <Button onClick={handleSaveNotifications} disabled={updateSetting.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
