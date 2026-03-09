import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useCompanies, useProjects } from '@/hooks/useSupabase';
import { useWorkerDocuments } from '@/hooks/useWorkerDocuments';
import { useWorkerStrikes, useCreateWorkerStrike, useDeleteWorkerStrike } from '@/hooks/useWorkerStrikes';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Hash,
  FileText,
  Building2,
  Briefcase,
  Calendar,
  Droplets,
  Users,
  Edit,
  X,
  Plus,
  Camera,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Shield,
  FileWarning,
} from 'lucide-react';
import { BadgePrinter } from './BadgePrinter';

interface Worker {
  id: string;
  name: string;
  document_number: string | null;
  role: string | null;
  company_id: string | null;
  status: string | null;
  photo_url: string | null;
  allowed_project_ids: string[] | null;
  birth_date?: string | null;
  gender?: string | null;
  blood_type?: string | null;
  observations?: string | null;
  code?: number;
}

interface WorkerDetailsDialogProps {
  worker: Worker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

const additionalDataSchema = z.object({
  birth_date: z.string().optional(),
  gender: z.string().optional(),
  blood_type: z.string().optional(),
  observations: z.string().optional(),
});

type AdditionalDataForm = z.infer<typeof additionalDataSchema>;

export const WorkerDetailsDialog = ({ worker, open, onOpenChange, onUpdate }: WorkerDetailsDialogProps) => {
  const [isEditingAdditional, setIsEditingAdditional] = useState(false);
  const [isAddingStrike, setIsAddingStrike] = useState(false);
  const [strikeForm, setStrikeForm] = useState<{ reason: string; description: string; severity: 'warning' | 'serious' | 'critical' }>({ reason: '', description: '', severity: 'warning' });
  const [isManagingProjects, setIsManagingProjects] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>(worker?.allowed_project_ids || []);

  const { data: companies = [] } = useCompanies();
  const { data: projects = [] } = useProjects();
  const { data: documents = [], isLoading: loadingDocs } = useWorkerDocuments(worker?.id || null);
  const { data: strikes = [], isLoading: loadingStrikes } = useWorkerStrikes(worker?.id || null);
  const createStrike = useCreateWorkerStrike();
  const deleteStrike = useDeleteWorkerStrike();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset } = useForm<AdditionalDataForm>({
    resolver: zodResolver(additionalDataSchema),
    defaultValues: {
      birth_date: worker?.birth_date || '',
      gender: worker?.gender || '',
      blood_type: worker?.blood_type || '',
      observations: worker?.observations || '',
    },
  });

  const companyName = companies.find(c => c.id === worker?.company_id)?.name || '-';

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
      case 'inactive': return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Inativo</Badge>;
      case 'blocked': return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Bloqueado</Badge>;
      case 'pending_review': return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pendente de Análise</Badge>;
      default: return <Badge variant="outline">-</Badge>;
    }
  };

  const getDocumentStatusBadge = (expiryDate: string | null) => {
    if (!expiryDate) return <Badge variant="outline">Sem validade</Badge>;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return <Badge className="bg-red-500/10 text-red-600">Vencido</Badge>;
    } else if (daysUntilExpiry <= 30) {
      return <Badge className="bg-yellow-500/10 text-yellow-600">Vence em {daysUntilExpiry}d</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-600">Válido</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'warning': return <Badge className="bg-yellow-500/10 text-yellow-600">Advertência</Badge>;
      case 'serious': return <Badge className="bg-orange-500/10 text-orange-600">Grave</Badge>;
      case 'critical': return <Badge className="bg-red-500/10 text-red-600">Crítico</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const onSaveAdditionalData = async (data: AdditionalDataForm) => {
    if (!worker) return;
    
    try {
      const { error } = await supabase
        .from('workers')
        .update({
          birth_date: data.birth_date || null,
          gender: data.gender || null,
          blood_type: data.blood_type || null,
          observations: data.observations || null,
        })
        .eq('id', worker.id);

      if (error) throw error;
      toast({ title: 'Dados atualizados com sucesso' });
      setIsEditingAdditional(false);
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      onUpdate?.();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddStrike = async () => {
    if (!worker || !strikeForm.reason) return;
    
    await createStrike.mutateAsync({
      worker_id: worker.id,
      reason: strikeForm.reason,
      description: strikeForm.description || null,
      severity: strikeForm.severity,
      created_by: null,
    });
    
    setStrikeForm({ reason: '', description: '', severity: 'warning' });
    setIsAddingStrike(false);
  };

  const handleSaveProjects = async () => {
    if (!worker) return;
    
    try {
      const { error } = await supabase
        .from('workers')
        .update({ allowed_project_ids: selectedProjects })
        .eq('id', worker.id);

      if (error) throw error;
      toast({ title: 'Projetos atualizados com sucesso' });
      setIsManagingProjects(false);
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      onUpdate?.();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar projetos', description: error.message, variant: 'destructive' });
    }
  };

  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Detalhes do Trabalhador - {worker.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Visualize e edite as informações do trabalhador</p>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Basic Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Informações Básicas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Hash className="h-4 w-4" />
                      Código
                    </div>
                    <p className="font-medium">{worker.code || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      Nome Completo
                    </div>
                    <p className="font-medium">{worker.name}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      CPF
                    </div>
                    <p className="font-medium">{worker.document_number || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      Cargo/Função
                    </div>
                    <p className="font-medium">{worker.role || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      Empresa
                    </div>
                    <p className="font-medium">{companyName}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      Status
                    </div>
                    {getStatusBadge(worker.status)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Data Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Dados Adicionais
                  </CardTitle>
                  <Button
                    variant={isEditingAdditional ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (isEditingAdditional) {
                        reset();
                      }
                      setIsEditingAdditional(!isEditingAdditional);
                    }}
                  >
                    {isEditingAdditional ? <X className="h-4 w-4 mr-1" /> : <Edit className="h-4 w-4 mr-1" />}
                    {isEditingAdditional ? 'Cancelar' : 'Editar'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSaveAdditionalData)}>
                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      <Avatar className="h-24 w-24">
                        {worker.photo_url ? (
                          <AvatarImage src={worker.photo_url} alt={worker.name} />
                        ) : (
                          <AvatarFallback className="text-2xl">
                            <User className="h-10 w-10" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Data de Nascimento
                        </Label>
                        {isEditingAdditional ? (
                          <Input type="date" {...register('birth_date')} />
                        ) : (
                          <p className="text-sm">{worker.birth_date ? format(new Date(worker.birth_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Gênero
                        </Label>
                        {isEditingAdditional ? (
                          <Select onValueChange={(v) => reset({ ...additionalDataSchema.parse({}), gender: v })} defaultValue={worker.gender || ''}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="masculino">Masculino</SelectItem>
                              <SelectItem value="feminino">Feminino</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm capitalize">{worker.gender || '-'}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Droplets className="h-4 w-4" />
                          Tipo Sanguíneo
                        </Label>
                        {isEditingAdditional ? (
                          <Select onValueChange={(v) => reset({ ...additionalDataSchema.parse({}), blood_type: v })} defaultValue={worker.blood_type || ''}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A+">A+</SelectItem>
                              <SelectItem value="A-">A-</SelectItem>
                              <SelectItem value="B+">B+</SelectItem>
                              <SelectItem value="B-">B-</SelectItem>
                              <SelectItem value="AB+">AB+</SelectItem>
                              <SelectItem value="AB-">AB-</SelectItem>
                              <SelectItem value="O+">O+</SelectItem>
                              <SelectItem value="O-">O-</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm">{worker.blood_type || '-'}</p>
                        )}
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Observações</Label>
                        {isEditingAdditional ? (
                          <Textarea {...register('observations')} placeholder="Observações sobre o trabalhador..." />
                        ) : (
                          <p className="text-sm text-muted-foreground">{worker.observations || 'Nenhuma observação'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Projects Section */}
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Projetos Autorizados
                      </Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        setSelectedProjects(worker.allowed_project_ids || []);
                        setIsManagingProjects(true);
                      }}>
                        Gerenciar
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(worker.allowed_project_ids || []).length > 0 ? (
                        worker.allowed_project_ids?.map(projectId => {
                          const project = projects.find(p => p.id === projectId);
                          return project ? (
                            <Badge key={projectId} variant="secondary">{project.name}</Badge>
                          ) : null;
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum projeto autorizado</p>
                      )}
                    </div>
                  </div>

                  {isEditingAdditional && (
                    <div className="flex justify-end mt-4">
                      <Button type="submit">Salvar Alterações</Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Documents Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileWarning className="h-4 w-4" />
                    Documentos
                    <Badge variant="secondary">{documents.length}</Badge>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-2" />
                    <p>Nenhum documento cadastrado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{doc.document_type}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.expiry_date ? `Validade: ${format(new Date(doc.expiry_date), 'dd/MM/yyyy', { locale: ptBR })}` : 'Sem data de validade'}
                            </p>
                          </div>
                        </div>
                        {getDocumentStatusBadge(doc.expiry_date)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Strikes Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Strikes
                    <Badge variant="secondary">{strikes.length}</Badge>
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setIsAddingStrike(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Strike
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingStrikes ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : strikes.length === 0 ? (
                  <Alert className="bg-green-500/10 border-green-500/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-600">
                      Nenhum strike registrado - Trabalhador sem advertências
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {strikes.map(strike => (
                      <div key={strike.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{strike.reason}</p>
                              {getSeverityBadge(strike.severity)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(strike.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                            {strike.description && (
                              <p className="text-xs text-muted-foreground mt-1">{strike.description}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteStrike.mutate({ strikeId: strike.id, workerId: worker.id })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Strike Form */}
                {isAddingStrike && (
                  <div className="mt-4 p-4 border rounded-lg space-y-4">
                    <div className="space-y-2">
                      <Label>Motivo *</Label>
                      <Input
                        value={strikeForm.reason}
                        onChange={(e) => setStrikeForm(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="Ex: Atraso recorrente"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Severidade</Label>
                      <Select
                        value={strikeForm.severity}
                        onValueChange={(v: 'warning' | 'serious' | 'critical') => setStrikeForm(prev => ({ ...prev, severity: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warning">Advertência</SelectItem>
                          <SelectItem value="serious">Grave</SelectItem>
                          <SelectItem value="critical">Crítico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={strikeForm.description}
                        onChange={(e) => setStrikeForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Detalhes adicionais..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAddingStrike(false)}>Cancelar</Button>
                      <Button onClick={handleAddStrike} disabled={!strikeForm.reason || createStrike.isPending}>
                        Adicionar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Manage Projects Dialog */}
        <Dialog open={isManagingProjects} onOpenChange={setIsManagingProjects}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerenciar Projetos Autorizados</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-80">
              <div className="space-y-2 pr-4">
                {projects.map(project => (
                  <div
                    key={project.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedProjects.includes(project.id) ? 'bg-primary/10 border border-primary' : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => {
                      setSelectedProjects(prev =>
                        prev.includes(project.id)
                          ? prev.filter(id => id !== project.id)
                          : [...prev, project.id]
                      );
                    }}
                  >
                    <Checkbox checked={selectedProjects.includes(project.id)} />
                    <div>
                      <p className="font-medium text-sm">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.location || 'Sem localização'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsManagingProjects(false)}>Cancelar</Button>
              <Button onClick={handleSaveProjects}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex justify-end pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
