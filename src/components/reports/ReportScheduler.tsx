import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Pause,
  Clock,
  FileText,
  Mail
} from 'lucide-react';
import { 
  useReportSchedules, 
  useCreateReportSchedule, 
  useDeleteReportSchedule,
  useToggleReportSchedule,
  type CreateReportScheduleInput 
} from '@/hooks/useReportSchedules';
import { useProject } from '@/contexts/ProjectContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export const ReportScheduler = () => {
  const { selectedProjectId } = useProject();
  const { data: schedules = [], isLoading } = useReportSchedules(selectedProjectId);
  const createSchedule = useCreateReportSchedule();
  const deleteSchedule = useDeleteReportSchedule();
  const toggleSchedule = useToggleReportSchedule();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateReportScheduleInput>({
    name: '',
    report_type: 'presence',
    frequency: 'daily',
    recipients: [],
    project_id: selectedProjectId
  });
  const [recipientInput, setRecipientInput] = useState('');

  const reportTypes = [
    { value: 'presence', label: 'Relatório de Presença' },
    { value: 'access', label: 'Relatório de Acessos' },
    { value: 'compliance', label: 'Relatório de Conformidade' },
    { value: 'device', label: 'Relatório de Dispositivos' }
  ];

  const frequencies = [
    { value: 'daily', label: 'Diário' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'monthly', label: 'Mensal' }
  ];

  const handleAddRecipient = () => {
    if (recipientInput && recipientInput.includes('@')) {
      setFormData(prev => ({
        ...prev,
        recipients: [...prev.recipients, recipientInput]
      }));
      setRecipientInput('');
    } else {
      toast.error('Digite um email válido');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email)
    }));
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('Digite um nome para o agendamento');
      return;
    }
    if (formData.recipients.length === 0) {
      toast.error('Adicione pelo menos um destinatário');
      return;
    }

    createSchedule.mutate({
      ...formData,
      project_id: selectedProjectId
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setFormData({
          name: '',
          report_type: 'presence',
          frequency: 'daily',
          recipients: [],
          project_id: selectedProjectId
        });
      }
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
      deleteSchedule.mutate(id);
    }
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    toggleSchedule.mutate({ id, is_active: !currentStatus });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendamento de Relatórios
            </CardTitle>
            <CardDescription>
              Configure relatórios automáticos para serem gerados e enviados periodicamente
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Agendamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome do Agendamento</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Relatório Diário de Presença"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Relatório</Label>
                  <Select
                    value={formData.report_type}
                    onValueChange={(value: any) => setFormData({ ...formData, report_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reportTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value: any) => setFormData({ ...formData, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencies.map(freq => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Destinatários</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      placeholder="email@exemplo.com"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRecipient())}
                    />
                    <Button type="button" variant="outline" onClick={handleAddRecipient}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.recipients.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.recipients.map(email => (
                        <Badge key={email} variant="secondary" className="gap-1">
                          {email}
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(email)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleSubmit}
                  disabled={createSchedule.isPending}
                >
                  {createSchedule.isPending ? 'Criando...' : 'Criar Agendamento'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum agendamento configurado</p>
            <p className="text-sm mt-1">Clique em "Novo Agendamento" para criar</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Próxima Execução</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {reportTypes.find(t => t.value === schedule.report_type)?.label || schedule.report_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {frequencies.find(f => f.value === schedule.frequency)?.label || schedule.frequency}
                    </TableCell>
                    <TableCell>
                      {schedule.next_run_at ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {format(new Date(schedule.next_run_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não agendado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={() => handleToggle(schedule.id, schedule.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
