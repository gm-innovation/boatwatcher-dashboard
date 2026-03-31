import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
}

export function AccessPointConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccessPoint | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('bordo');
  const [directionMode, setDirectionMode] = useState('both');

  const { data: points = [] } = useQuery({
    queryKey: ['manual_access_points'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('manual_access_points').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as AccessPoint[];
    },
  });

  const resetForm = () => {
    setName('');
    setLocation('bordo');
    setDirectionMode('both');
    setEditing(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }

    try {
      if (editing) {
        const { error } = await (supabase as any).from('manual_access_points')
          .update({ name: name.trim(), access_location: location, direction_mode: directionMode })
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Ponto atualizado' });
      } else {
        const { error } = await (supabase as any).from('manual_access_points')
          .insert({ name: name.trim(), access_location: location, direction_mode: directionMode });
        if (error) throw error;
        toast({ title: 'Ponto criado' });
      }
      queryClient.invalidateQueries({ queryKey: ['manual_access_points'] });
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('manual_access_points').delete().eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['manual_access_points'] });
      toast({ title: 'Ponto removido' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const openEdit = (point: AccessPoint) => {
    setEditing(point);
    setName(point.name);
    setLocation(point.access_location);
    setDirectionMode(point.direction_mode);
    setOpen(true);
  };

  const locationLabel: Record<string, string> = { bordo: 'Bordo', dique: 'Dique' };
  const directionLabel: Record<string, string> = { entry: 'Apenas Entrada', exit: 'Apenas Saída', both: 'Entrada e Saída' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pontos de Controle</h3>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Novo Ponto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Ponto' : 'Novo Ponto de Controle'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome do Dispositivo</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Portaria Principal" />
              </div>
              <div>
                <Label>Local de Acesso</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bordo">Bordo</SelectItem>
                    <SelectItem value="dique">Dique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modo de Direção</Label>
                <Select value={directionMode} onValueChange={setDirectionMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Entrada e Saída</SelectItem>
                    <SelectItem value="entry">Apenas Entrada</SelectItem>
                    <SelectItem value="exit">Apenas Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {points.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum ponto de controle configurado. Crie um para começar.</p>
      )}

      <div className="space-y-2">
        {points.map(p => (
          <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {locationLabel[p.access_location] || p.access_location} • {directionLabel[p.direction_mode] || p.direction_mode}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
