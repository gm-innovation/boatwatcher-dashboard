import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  Plus,
  Trash2,
  Play,
  Clock,
  Loader2,
  Send,
  X,
} from 'lucide-react';
import {
  useReportSchedules,
  useCreateReportSchedule,
  useDeleteReportSchedule,
  useToggleReportSchedule,
  type CreateReportScheduleInput,
} from '@/hooks/useReportSchedules';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const REPORT_TYPES = [
  { value: 'presence', label: 'Visão Geral' },
  { value: 'workers_simple', label: 'Trabalhadores Simples' },
  { value: 'workers_detailed', label: 'Trabalhadores Detalhado' },
  { value: 'company', label: 'Empresas' },
  { value: 'all_workers', label: 'Todos Trabalhadores' },
];

const FREQUENCY_LOOKBACK: Record<string, { days: number; label: string }> = {
  daily: { days: 1, label: 'O relatório incluirá dados do dia anterior' },
  weekly: { days: 7, label: 'O relatório incluirá dados dos últimos 7 dias' },
  biweekly: { days: 15, label: 'O relatório incluirá dados dos últimos 15 dias' },
  monthly: { days: 30, label: 'O relatório incluirá dados do mês anterior completo' },
};

const FREQUENCIES = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
];

export const ReportScheduler = () => {
  const { selectedProjectId } = useProject();
  const { data: schedules = [], isLoading } = useReportSchedules(selectedProjectId);
  const createSchedule = useCreateReportSchedule();
  const deleteSchedule = useDeleteReportSchedule();
  const toggleSchedule = useToggleReportSchedule();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name');
      return data ?? [];
    },
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState<string>(selectedProjectId ?? '');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['presence']);
  const [frequency, setFrequency] = useState<string>('daily');
  const [sendTime, setSendTime] = useState('06:00');
  
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');

  const resetForm = () => {
    setName('');
    setProjectId(selectedProjectId ?? '');
    setSelectedTypes(['presence']);
    setFrequency('daily');
    setSendTime('06:00');
    
    setRecipients([]);
    setRecipientInput('');
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const addRecipient = () => {
    const email = recipientInput.trim();
    if (email && email.includes('@') && !recipients.includes(email)) {
      setRecipients((prev) => [...prev, email]);
      setRecipientInput('');
    } else if (!email.includes('@')) {
      toast.error('Digite um email válido');
    }
  };

  const handleSubmit = () => {
    if (!name) return toast.error('Digite um nome para o agendamento');
    if (selectedTypes.length === 0) return toast.error('Selecione pelo menos um tipo de relatório');
    if (recipients.length === 0) return toast.error('Adicione pelo menos um destinatário');

    const input: CreateReportScheduleInput = {
      name,
      report_type: selectedTypes.join(','),
      frequency: frequency as any,
      recipients,
      project_id: projectId || null,
      filters: {
        send_time: sendTime,
        lookback_days: FREQUENCY_LOOKBACK[frequency]?.days ?? 1,
        report_types: selectedTypes,
      },
    };

    createSchedule.mutate(input, {
      onSuccess: () => {
        setIsFormOpen(false);
        resetForm();
      },
    });
  };

  const handleRunNow = async (scheduleId: string) => {
    setRunningId(scheduleId);
    try {
      const { error } = await supabase.functions.invoke('scheduled-reports', {
        body: { schedule_id: scheduleId, manual: true },
      });
      if (error) throw error;
      toast.success('Relatório gerado com sucesso');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha ao executar'));
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
      deleteSchedule.mutate(id);
    }
  };

  const activeSchedules = useMemo(() => schedules.filter((s) => s.is_active), [schedules]);
  const inactiveSchedules = useMemo(() => schedules.filter((s) => !s.is_active), [schedules]);

  const getReportTypeLabels = (schedule: (typeof schedules)[0]) => {
    const types = schedule.filters?.report_types ?? schedule.report_type.split(',');
    return types.map((t: string) => REPORT_TYPES.find((rt) => rt.value === t)?.label ?? t);
  };

  const renderScheduleTable = (items: typeof schedules, emptyLabel: string) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{emptyLabel}</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipos</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Próxima Execução</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-medium">{schedule.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {getReportTypeLabels(schedule).map((label: string) => (
                      <Badge key={label} variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {FREQUENCIES.find((f) => f.value === schedule.frequency)?.label ?? schedule.frequency}
                </TableCell>
                <TableCell className="text-sm">
                  {schedule.filters?.send_time ?? '—'}
                </TableCell>
                <TableCell>
                  {schedule.next_run_at ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3" />
                      {format(new Date(schedule.next_run_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={schedule.is_active}
                    onCheckedChange={() =>
                      toggleSchedule.mutate({ id: schedule.id, is_active: !schedule.is_active })
                    }
                  />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRunNow(schedule.id)}
                    disabled={runningId === schedule.id}
                    title="Executar agora"
                  >
                    {runningId === schedule.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 text-primary" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(schedule.id)}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendamento de Relatórios
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure relatórios automáticos para serem gerados e enviados periodicamente
          </p>
        </div>
        {!isFormOpen && (
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        )}
      </div>

      {/* Inline form */}
      {isFormOpen && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Criar Agendamento</CardTitle>
            <CardDescription>Preencha os campos abaixo para configurar o envio automático</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: Name + Project */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-7 space-y-1.5">
                <Label>Nome do Agendamento</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Relatório Diário de Presença"
                />
              </div>
              <div className="col-span-5 space-y-1.5">
                <Label>Projeto</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Report types (checkboxes) + Frequency + Send time */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-5 space-y-1.5">
                <Label>Tipos de Relatório</Label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {REPORT_TYPES.map((rt) => (
                    <label
                      key={rt.value}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTypes.includes(rt.value)}
                        onCheckedChange={() => toggleType(rt.value)}
                      />
                      {rt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-4 space-y-1.5">
                <Label>Frequência</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>Horário de Envio</Label>
                <Input
                  type="time"
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                />
              </div>
            </div>

            {/* Row 3: Período informativo */}
            <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              {FREQUENCY_LOOKBACK[frequency]?.label}
            </div>

            {/* Row 4: Recipients */}
            <div className="space-y-1.5">
              <Label>Destinatários de Email</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="email@exemplo.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addRecipient}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {recipients.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1">
                      {email}
                      <button
                        type="button"
                        onClick={() => setRecipients((prev) => prev.filter((r) => r !== email))}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled>
                  <Send className="h-4 w-4 mr-1" />
                  Testar Envio
                </Button>
                <Button variant="ghost" size="sm" disabled>
                  <Play className="h-4 w-4 mr-1" />
                  Forçar Execução
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={createSchedule.isPending}>
                  {createSchedule.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listing with tabs */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">
                  Agendamentos Ativos ({activeSchedules.length})
                </TabsTrigger>
                <TabsTrigger value="inactive">
                  Agendamentos Inativos ({inactiveSchedules.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active">
                {renderScheduleTable(activeSchedules, 'Nenhum agendamento ativo')}
              </TabsContent>
              <TabsContent value="inactive">
                {renderScheduleTable(inactiveSchedules, 'Nenhum agendamento inativo')}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
