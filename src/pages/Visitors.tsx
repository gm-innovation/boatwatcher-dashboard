import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, UserCheck, UserX, Clock, Users, Trash2, Search } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Visitor {
  id: string;
  name: string;
  document_number: string | null;
  company: string | null;
  reason: string | null;
  valid_until: string | null;
  photo_url: string | null;
  status: string;
  project_id: string | null;
  created_at: string;
}

export default function Visitors() {
  const { selectedProjectId } = useProject();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state
  const [form, setForm] = useState({
    name: '', document_number: '', company: '', reason: '',
    valid_until: '', status: 'active'
  });

  const { data: visitors = [], isLoading } = useQuery({
    queryKey: ['visitors', selectedProjectId],
    queryFn: async () => {
      let query = (supabase.from as any)('visitors')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedProjectId) query = query.eq('project_id', selectedProjectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Visitor[];
    },
  });

  const createVisitor = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)('visitors').insert({
        name: form.name,
        document_number: form.document_number || null,
        company: form.company || null,
        reason: form.reason || null,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        status: 'active',
        project_id: selectedProjectId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast({ title: 'Visitante cadastrado com sucesso' });
      setIsDialogOpen(false);
      setForm({ name: '', document_number: '', company: '', reason: '', valid_until: '', status: 'active' });
    },
    onError: (e: Error) => toast({ title: 'Erro ao cadastrar', description: e.message, variant: 'destructive' }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from as any)('visitors').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast({ title: 'Status atualizado' });
    },
  });

  const deleteVisitor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)('visitors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast({ title: 'Visitante removido' });
    },
  });

  const filtered = visitors.filter(v => {
    const matchesSearch = !search || v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.company?.toLowerCase().includes(search.toLowerCase()) ||
      v.document_number?.includes(search);
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const activeCount = visitors.filter(v => v.status === 'active').length;
  const expiredCount = visitors.filter(v => v.valid_until && isPast(new Date(v.valid_until)) && v.status === 'active').length;

  const getStatusBadge = (visitor: Visitor) => {
    if (visitor.status === 'checked_out') {
      return <Badge variant="secondary">Saiu</Badge>;
    }
    if (visitor.valid_until && isPast(new Date(visitor.valid_until))) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{visitors.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos Agora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{activeCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Validade Expirada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold">{expiredCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar visitante..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="checked_out">Saíram</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Visitante
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastro de Visitante</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createVisitor.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Documento</Label>
                  <Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} placeholder="CPF / RG" />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motivo da Visita</Label>
                <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Válido Até</Label>
                <Input type="datetime-local" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createVisitor.isPending || !form.name}>Cadastrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(visitor => (
                <TableRow key={visitor.id}>
                  <TableCell className="font-medium">{visitor.name}</TableCell>
                  <TableCell>{visitor.document_number || '-'}</TableCell>
                  <TableCell>{visitor.company || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{visitor.reason || '-'}</TableCell>
                  <TableCell>
                    {visitor.valid_until ? (
                      <span className="text-sm">
                        {format(new Date(visitor.valid_until), 'dd/MM HH:mm')}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(visitor.valid_until), { addSuffix: true, locale: ptBR })}
                        </span>
                      </span>
                    ) : 'Indefinido'}
                  </TableCell>
                  <TableCell>{getStatusBadge(visitor)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {visitor.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus.mutate({ id: visitor.id, status: 'checked_out' })}
                        >
                          <UserX className="h-3 w-3 mr-1" />
                          Saída
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => { if (confirm('Remover visitante?')) deleteVisitor.mutate(visitor.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum visitante encontrado</p>
        </div>
      )}
    </div>
  );
}
