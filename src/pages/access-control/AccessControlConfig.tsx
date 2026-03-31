import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, RefreshCw, Database, Users, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AccessPointConfig } from '@/components/access-control/AccessPointConfig';
import { AccessControlShell } from '@/components/access-control/AccessControlShell';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { CachedWorker } from '@/hooks/useOfflineAccessControl';

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

const WORKERS_CACHE_KEY = 'ac_workers_cache';

export default function AccessControlConfig() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);
  const [syncClientId, setSyncClientId] = useState('');
  const [syncingWorkers, setSyncingWorkers] = useState(false);
  const [syncingData, setSyncingData] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);

  // Load cached count
  useState(() => {
    get<CachedWorker[]>(WORKERS_CACHE_KEY).then(c => setCachedCount(c?.length || 0));
  });

  const { data: points = [] } = useQuery({
    queryKey: ['manual_access_points'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('manual_access_points').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as AccessPoint[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies_for_sync'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('manual_access_points').delete().eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['manual_access_points'] });
      toast({ title: 'Terminal removido' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleSyncWorkers = useCallback(async () => {
    setSyncingWorkers(true);
    try {
      let query = supabase
        .from('workers')
        .select('id, name, code, document_number, photo_url, company_id, status, job_function_id')
        .eq('status', 'active')
        .limit(5000);

      if (syncClientId) {
        query = query.eq('company_id', syncClientId);
      }

      const { data: workersData, error } = await query;
      if (error) throw error;

      const { data: companiesData } = await supabase.from('companies').select('id, name');
      const { data: jobFunctions } = await supabase.from('job_functions').select('id, name');

      const companiesMap = new Map((companiesData || []).map(c => [c.id, c.name]));
      const jobFunctionsMap = new Map((jobFunctions || []).map(j => [j.id, j.name]));

      const cached: CachedWorker[] = (workersData || []).map(w => ({
        id: w.id,
        name: w.name,
        code: w.code,
        document_number: w.document_number,
        photo_url: w.photo_url,
        company_id: w.company_id,
        company_name: w.company_id ? companiesMap.get(w.company_id) || undefined : undefined,
        job_function_name: w.job_function_id ? jobFunctionsMap.get(w.job_function_id) || undefined : undefined,
        status: w.status,
      }));

      await set(WORKERS_CACHE_KEY, cached);
      setCachedCount(cached.length);
      toast({ title: `${cached.length} trabalhadores sincronizados` });
    } catch (err: any) {
      toast({ title: 'Erro na sincronização', description: err.message, variant: 'destructive' });
    } finally {
      setSyncingWorkers(false);
    }
  }, [syncClientId, toast]);

  const handleSyncData = useCallback(async () => {
    setSyncingData(true);
    try {
      // Force refetch companies and projects
      await queryClient.invalidateQueries({ queryKey: ['companies_for_sync'] });
      await queryClient.invalidateQueries({ queryKey: ['projects_for_access'] });
      toast({ title: 'Dados sincronizados com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSyncingData(false);
    }
  }, [queryClient, toast]);

  const recognitionLabel: Record<string, string> = {
    code: 'Código',
    cpf: 'CPF',
    name: 'Nome',
    facial: 'Facial',
  };
  const directionLabel: Record<string, string> = {
    entry: 'Entrada',
    exit: 'Saída',
    both: 'Entrada/Saída',
  };

  // Show form when creating (null) or editing (uuid string)
  if (editingId !== undefined) {
    return (
      <AccessControlShell>
        <div className="p-4 max-w-lg mx-auto">
          <AccessPointConfig editingId={editingId} onBack={() => setEditingId(undefined)} />
        </div>
      </AccessControlShell>
    );
  }

  return (
    <AccessControlShell>
      <div className="p-4 max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/access-control')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold">Configurações</h2>
        </div>

        {/* ── Section: Terminais ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Gerenciamento de Terminais</h3>
            </div>
            <Button size="sm" className="gap-1" onClick={() => setEditingId(null)}>
              <Plus className="h-4 w-4" /> Novo Terminal
            </Button>
          </div>

          {points.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum terminal configurado.</p>
          )}

          <div className="space-y-2">
            {points.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{p.name}</p>
                    <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.location_description || '—'} • {recognitionLabel[p.recognition_method] || p.recognition_method} • {directionLabel[p.direction_mode] || p.direction_mode}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(p.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section: Sync Trabalhadores ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Sincronização de Trabalhadores</h3>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Filtrar por Cliente (opcional)</Label>
              <Select value={syncClientId} onValueChange={setSyncClientId}>
                <SelectTrigger><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Trabalhadores em cache local:</span>
              <Badge variant="outline">{cachedCount}</Badge>
            </div>

            <Button onClick={handleSyncWorkers} disabled={syncingWorkers} className="w-full gap-2">
              <RefreshCw className={`h-4 w-4 ${syncingWorkers ? 'animate-spin' : ''}`} />
              {syncingWorkers ? 'Sincronizando...' : 'Sincronizar Trabalhadores'}
            </Button>
          </div>
        </section>

        {/* ── Section: Sync Dados ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Sincronização de Dados</h3>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Sincroniza clientes e projetos do sistema principal para uso offline.
            </p>
            <Button variant="outline" onClick={handleSyncData} disabled={syncingData} className="w-full gap-2">
              <RefreshCw className={`h-4 w-4 ${syncingData ? 'animate-spin' : ''}`} />
              {syncingData ? 'Sincronizando...' : 'Sincronizar Clientes e Projetos'}
            </Button>
          </div>
        </section>
      </div>
    </AccessControlShell>
  );
}
