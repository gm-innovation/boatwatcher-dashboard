import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  useJobFunctions, 
  useCreateJobFunction, 
  useUpdateJobFunction, 
  useDeleteJobFunction,
  useRequiredDocuments,
  useCreateRequiredDocument,
  useDeleteRequiredDocument
} from '@/hooks/useJobFunctions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit2, Trash2, Briefcase, FileText, X } from 'lucide-react';
import type { JobFunction } from '@/types/supabase';

const jobFunctionSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
});

const documentSchema = z.object({
  document_name: z.string().min(1, 'Nome do documento é obrigatório'),
  validity_days: z.number().optional(),
  is_mandatory: z.boolean().default(true),
});

type JobFunctionFormData = z.infer<typeof jobFunctionSchema>;
type DocumentFormData = z.infer<typeof documentSchema>;

export const JobFunctionManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState<JobFunction | null>(null);
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);

  const { data: jobFunctions = [], isLoading } = useJobFunctions();
  const { data: requiredDocs = [] } = useRequiredDocuments(selectedFunctionId);
  const createFunction = useCreateJobFunction();
  const updateFunction = useUpdateJobFunction();
  const deleteFunction = useDeleteJobFunction();
  const createDocument = useCreateRequiredDocument();
  const deleteDocument = useDeleteRequiredDocument();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<JobFunctionFormData>({
    resolver: zodResolver(jobFunctionSchema),
  });

  const { register: registerDoc, handleSubmit: handleSubmitDoc, reset: resetDoc, setValue: setDocValue, watch: watchDoc } = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: { is_mandatory: true },
  });

  const onSubmitFunction = (data: JobFunctionFormData) => {
    if (editingFunction) {
      updateFunction.mutate({ id: editingFunction.id, data: { name: data.name, description: data.description } });
    } else {
      createFunction.mutate({ name: data.name, description: data.description });
    }
    setIsDialogOpen(false);
    setEditingFunction(null);
    reset();
  };

  const onSubmitDocument = (data: DocumentFormData) => {
    if (selectedFunctionId) {
      createDocument.mutate({
        job_function_id: selectedFunctionId,
        document_name: data.document_name,
        validity_days: data.validity_days || undefined,
        is_mandatory: data.is_mandatory,
      });
    }
    setIsDocDialogOpen(false);
    resetDoc();
  };

  const handleEditFunction = (func: JobFunction) => {
    setEditingFunction(func);
    reset({ name: func.name, description: func.description || '' });
    setIsDialogOpen(true);
  };

  const handleDeleteFunction = (func: JobFunction) => {
    if (confirm(`Tem certeza que deseja remover o cargo "${func.name}"?`)) {
      deleteFunction.mutate(func.id);
      if (selectedFunctionId === func.id) {
        setSelectedFunctionId(null);
      }
    }
  };

  const handleDeleteDocument = (docId: string) => {
    if (selectedFunctionId && confirm('Remover este documento obrigatório?')) {
      deleteDocument.mutate({ id: docId, jobFunctionId: selectedFunctionId });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Job Functions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cargos</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => { setEditingFunction(null); reset(); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Cargo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingFunction ? 'Editar Cargo' : 'Novo Cargo'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmitFunction)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Cargo *</Label>
                    <Input id="name" {...register('name')} />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea id="description" {...register('description')} rows={3} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit">{editingFunction ? 'Atualizar' : 'Criar'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : jobFunctions.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {jobFunctions.map((func) => (
                  <div
                    key={func.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedFunctionId === func.id ? 'bg-primary/10 border border-primary' : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => setSelectedFunctionId(func.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{func.name}</p>
                        {func.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{func.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditFunction(func); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteFunction(func); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum cargo cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Required Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Documentos Obrigatórios
              {selectedFunctionId && (
                <Badge variant="secondary" className="ml-2">
                  {jobFunctions.find(f => f.id === selectedFunctionId)?.name}
                </Badge>
              )}
            </CardTitle>
            {selectedFunctionId && (
              <Dialog open={isDocDialogOpen} onOpenChange={setIsDocDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Documento Obrigatório</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmitDoc(onSubmitDocument)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="document_name">Nome do Documento *</Label>
                      <Input id="document_name" placeholder="Ex: ASO, NR-35, NR-10" {...registerDoc('document_name')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validity_days">Validade (dias)</Label>
                      <Input 
                        id="validity_days" 
                        type="number" 
                        placeholder="Ex: 365" 
                        {...registerDoc('validity_days', { valueAsNumber: true })} 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="is_mandatory" 
                        checked={watchDoc('is_mandatory')}
                        onCheckedChange={(checked) => setDocValue('is_mandatory', !!checked)}
                      />
                      <Label htmlFor="is_mandatory">Obrigatório</Label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDocDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit">Adicionar</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {selectedFunctionId ? (
            requiredDocs.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {requiredDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.document_name}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {doc.validity_days && <span>Validade: {doc.validity_days} dias</span>}
                            <Badge variant={doc.is_mandatory ? 'default' : 'secondary'} className="text-xs">
                              {doc.is_mandatory ? 'Obrigatório' : 'Opcional'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteDocument(doc.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum documento obrigatório</p>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Selecione um cargo para ver os documentos</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
