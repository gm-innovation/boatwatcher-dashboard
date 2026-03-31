import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AccessPoint {
  id: string;
  name: string;
  access_location: string;
  direction_mode: string;
  is_active: boolean;
  project_id: string | null;
  location_description: string | null;
  client_id: string | null;
  recognition_method: string;
  require_photo: boolean;
  auto_sync: boolean;
}

interface AccessPointConfigProps {
  editingId?: string | null;
  onBack: () => void;
}

export function AccessPointConfig({ editingId, onBack }: AccessPointConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [recognitionMethod, setRecognitionMethod] = useState('code');
  const [directionMode, setDirectionMode] = useState('both');
  const [isActive, setIsActive] = useState(true);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch companies (clients)
  const { data: companies = [] } = useQuery({
    queryKey: ['companies_for_access'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').eq('type', 'client').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch projects filtered by client
  const { data: projects = [] } = useQuery({
    queryKey: ['projects_for_access', clientId],
    queryFn: async () => {
      let query = supabase.from('projects').select('id, name').order('name');
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Load existing point if editing
  useEffect(() => {
    if (!editingId) return;
    (async () => {
      const { data, error } = await (supabase as any).from('manual_access_points').select('*').eq('id', editingId).single();
      if (error || !data) return;
      const p = data as AccessPoint;
      setName(p.name);
      setLocationDescription(p.location_description || '');
      setClientId(p.client_id || '');
      setProjectId(p.project_id || '');
      setRecognitionMethod(p.recognition_method || 'code');
      setDirectionMode(p.direction_mode || 'both');
      setIsActive(p.is_active);
      setRequirePhoto(p.require_photo ?? false);
      setAutoSync(p.auto_sync ?? true);
    })();
  }, [editingId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Nome do terminal é obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        location_description: locationDescription.trim() || null,
        client_id: clientId || null,
        project_id: projectId || null,
        recognition_method: recognitionMethod,
        direction_mode: directionMode,
        is_active: isActive,
        require_photo: requirePhoto,
        auto_sync: autoSync,
      };

      if (editingId) {
        const { error } = await (supabase as any).from('manual_access_points').update(payload).eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Terminal atualizado com sucesso' });
      } else {
        const { error } = await (supabase as any).from('manual_access_points').insert(payload);
        if (error) throw error;
        toast({ title: 'Terminal criado com sucesso' });
      }
      queryClient.invalidateQueries({ queryKey: ['manual_access_points'] });
      onBack();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold">{editingId ? 'Editar Terminal' : 'Novo Terminal'}</h2>
      </div>

      <div className="space-y-5">
        {/* Nome */}
        <div className="space-y-1.5">
          <Label>Nome do Terminal</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Portaria Principal" />
        </div>

        {/* Localização */}
        <div className="space-y-1.5">
          <Label>Localização</Label>
          <Input value={locationDescription} onChange={e => setLocationDescription(e.target.value)} placeholder="Ex: Convés, Dique Seco" />
        </div>

        {/* Cliente */}
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(''); }}>
            <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Projeto/Obra */}
        <div className="space-y-1.5">
          <Label>Projeto / Obra</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Método de Reconhecimento */}
        <div className="space-y-1.5">
          <Label>Método de Reconhecimento</Label>
          <Select value={recognitionMethod} onValueChange={setRecognitionMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="code">Código / Matrícula</SelectItem>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="facial">Reconhecimento Facial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Modo de Operação */}
        <div className="space-y-1.5">
          <Label>Modo de Operação</Label>
          <Select value={directionMode} onValueChange={setDirectionMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Entrada e Saída</SelectItem>
              <SelectItem value="entry">Apenas Entrada</SelectItem>
              <SelectItem value="exit">Apenas Saída</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Toggles */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <Label>Terminal Ativo</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Captura de Foto Obrigatória</Label>
            <Switch checked={requirePhoto} onCheckedChange={setRequirePhoto} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Sincronização Automática</Label>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {editingId ? 'Atualizar Terminal' : 'Salvar Terminal'}
        </Button>
      </div>
    </div>
  );
}
