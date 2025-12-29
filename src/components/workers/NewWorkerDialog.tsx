import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useCompanies, useProjects } from '@/hooks/useSupabase';
import { useCreateWorkerDocument } from '@/hooks/useWorkerDocuments';
import { useDocumentExtraction, ProcessedDocument } from '@/hooks/useDocumentExtraction';
import { toast } from '@/hooks/use-toast';
import { ensureValidSession } from '@/utils/ensureValidSession';
import { useQueryClient } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  User,
  FileText,
  Building2,
  Calendar,
  Droplets,
  Camera,
  Upload,
  Plus,
  ArrowLeft,
  Info,
  Sparkles,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface NewWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const workerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  document_number: z.string().min(11, 'CPF inválido'),
  role: z.string().optional(),
  company_id: z.string().optional(),
  status: z.string().default('pending_review'),
  birth_date: z.string().optional(),
  gender: z.string().optional(),
  blood_type: z.string().optional(),
  observations: z.string().optional(),
});

type WorkerFormData = z.infer<typeof workerSchema>;

interface UploadedDocument {
  id: string;
  file: File;
  type: string;
  file_url?: string;
  completion_date?: string | null;
  expiry_date?: string | null;
  extractedData?: Record<string, any>;
  isExtracting?: boolean;
  error?: 'auth' | 'server' | null;
}

export const NewWorkerDialog = ({ open, onOpenChange, onSuccess }: NewWorkerDialogProps) => {
  const [isDocumentMode, setIsDocumentMode] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isManagingProjects, setIsManagingProjects] = useState(false);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  
  const { data: companies = [] } = useCompanies();
  const { data: projects = [] } = useProjects();
  const createDocument = useCreateWorkerDocument();
  const queryClient = useQueryClient();
  
  // Use the extraction hook that handles auth and proper payload
  const { extractDocument, isExtracting, progress } = useDocumentExtraction();

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      status: 'pending_review',
    }
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Process a single document using the extraction hook
  const processDocument = async (file: File, docId: string) => {
    // Mark as extracting
    setUploadedDocuments(prev => prev.map(doc => 
      doc.id === docId 
        ? { ...doc, isExtracting: true, error: null }
        : doc
    ));

    try {
      const result = await extractDocument(file);
      
      if (!result) {
        // extractDocument returns null on auth failure or other critical errors
        setUploadedDocuments(prev => prev.map(doc => 
          doc.id === docId 
            ? { ...doc, isExtracting: false, error: 'auth' as const }
            : doc
        ));
        return;
      }

      // Update document with extracted data
      setUploadedDocuments(prev => prev.map(doc => 
        doc.id === docId 
          ? { 
              ...doc, 
              file_url: result.file_url,
              type: result.document_type || 'Documento',
              completion_date: result.completion_date,
              expiry_date: result.expiry_date,
              extractedData: result.extracted_data,
              isExtracting: false,
              error: null
            }
          : doc
      ));

      // Auto-fill form with extracted data
      const data = result.extracted_data;
      if (data) {
        if (data.full_name) setValue('name', data.full_name);
        if (data.document_number) setValue('document_number', data.document_number);
        if (data.birth_date) setValue('birth_date', data.birth_date);
        if (data.job_function) setValue('role', data.job_function);
        if (data.gender) setValue('gender', data.gender?.toLowerCase());
        if (data.blood_type) setValue('blood_type', data.blood_type);
      }

      if (Object.keys(result.extracted_data || {}).length > 0) {
        toast({ title: 'Dados extraídos com sucesso' });
      }
    } catch (error) {
      console.error('Document processing error:', error);
      setUploadedDocuments(prev => prev.map(doc => 
        doc.id === docId 
          ? { ...doc, isExtracting: false, error: 'server' as const }
          : doc
      ));
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Add all files to state first
    const newDocs: UploadedDocument[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      type: 'Documento',
      isExtracting: true,
      error: null,
    }));
    
    setUploadedDocuments(prev => [...prev, ...newDocs]);

    // Process each document
    for (const doc of newDocs) {
      await processDocument(doc.file, doc.id);
    }
    
    // Reset input so the same files can be selected again if needed
    e.target.value = '';
  };

  const retryExtraction = async (docId: string) => {
    const doc = uploadedDocuments.find(d => d.id === docId);
    if (doc) {
      await processDocument(doc.file, docId);
    }
  };

  const removeDocument = (docId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== docId));
  };

  const uploadPhoto = async (workerId: string): Promise<string | null> => {
    if (!photoFile) return null;

    // Validate session before upload
    const validSession = await ensureValidSession();
    if (!validSession) {
      toast({
        title: 'Sessão expirada',
        description: 'Sua sessão expirou. Faça login novamente.',
        variant: 'destructive'
      });
      return null;
    }

    const fileExt = photoFile.name.split('.').pop();
    const fileName = `${workerId}.${fileExt}`;
    const filePath = `workers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('worker-photos')
      .upload(filePath, photoFile, { upsert: true });

    if (uploadError) {
      console.error('[uploadPhoto] Upload error:', uploadError);
      toast({
        title: 'Erro no upload da foto',
        description: uploadError.message,
        variant: 'destructive'
      });
      return null;
    }

    const { data } = supabase.storage.from('worker-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const saveDocuments = async (workerId: string) => {
    for (const doc of uploadedDocuments) {
      // Use file_url from extraction if available (already uploaded)
      // Otherwise, upload the file now
      let documentUrl = doc.file_url;
      
      if (!documentUrl) {
        const fileExt = doc.file.name.split('.').pop();
        const fileName = `${workerId}/${doc.id}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('worker-documents')
          .upload(fileName, doc.file, { upsert: true });

        if (uploadError) {
          console.error('Document upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage.from('worker-documents').getPublicUrl(fileName);
        documentUrl = urlData.publicUrl;
      }

      await createDocument.mutateAsync({
        worker_id: workerId,
        document_type: doc.type,
        document_url: documentUrl,
        filename: doc.file.name,
        expiry_date: doc.expiry_date || null,
        issue_date: doc.completion_date || null,
        extracted_data: doc.extractedData || null,
        status: 'valid',
      });
    }
  };

  const onSubmit = async (data: WorkerFormData) => {
    setIsSubmitting(true);
    try {
      const { data: newWorker, error } = await supabase
        .from('workers')
        .insert({
          name: data.name,
          document_number: data.document_number,
          role: data.role || null,
          company_id: data.company_id || null,
          status: data.status,
          allowed_project_ids: selectedProjects,
          birth_date: data.birth_date || null,
          gender: data.gender || null,
          blood_type: data.blood_type || null,
          observations: data.observations || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Upload photo
      if (photoFile && newWorker) {
        const photoUrl = await uploadPhoto(newWorker.id);
        if (photoUrl) {
          await supabase.from('workers').update({ photo_url: photoUrl }).eq('id', newWorker.id);
        }
      }

      // Save documents (uses already uploaded files when available)
      if (uploadedDocuments.length > 0 && newWorker) {
        await saveDocuments(newWorker.id);
      }

      toast({ title: 'Trabalhador cadastrado com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      
      // Reset form
      reset();
      setPhotoFile(null);
      setPhotoPreview(null);
      setUploadedDocuments([]);
      setSelectedProjects([]);
      setIsDocumentMode(false);
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setPhotoFile(null);
    setPhotoPreview(null);
    setUploadedDocuments([]);
    setSelectedProjects([]);
    setIsDocumentMode(false);
    onOpenChange(false);
  };

  // Get status badge for document
  const getDocumentStatusBadge = (doc: UploadedDocument) => {
    if (doc.isExtracting) {
      return (
        <Badge variant="outline" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Extraindo...
        </Badge>
      );
    }
    
    if (doc.error === 'auth') {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Sessão expirada
        </Badge>
      );
    }
    
    if (doc.error === 'server') {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Erro no servidor
        </Badge>
      );
    }
    
    if (doc.extractedData && Object.keys(doc.extractedData).length > 0) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Dados extraídos</Badge>;
    }
    
    return <Badge variant="secondary">Sem extração</Badge>;
  };

  // Documents card component
  const DocumentsCard = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos
            <Badge variant="secondary">{uploadedDocuments.length}</Badge>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => documentInputRef.current?.click()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Documentos
          </Button>
          <input
            ref={documentInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={handleDocumentUpload}
          />
        </div>
      </CardHeader>
      <CardContent>
        {uploadedDocuments.length === 0 ? (
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => documentInputRef.current?.click()}
          >
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Arraste documentos ou clique para enviar</p>
            <p className="text-xs text-muted-foreground mt-1">
              A IA irá extrair automaticamente os dados dos documentos
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {uploadedDocuments.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{doc.file.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getDocumentStatusBadge(doc)}
                  {doc.error && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => retryExtraction(doc.id)}
                      title="Tentar novamente"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(doc.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Cadastrar Novo Trabalhador
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="document-mode" className="text-sm text-muted-foreground">
                Cadastro por Documentos
              </Label>
              <Switch
                id="document-mode"
                checked={isDocumentMode}
                onCheckedChange={setIsDocumentMode}
              />
            </div>
          </div>
          <DialogDescription>
            Preencha os dados do novo trabalhador. Os campos obrigatórios estão marcados com (*)
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 h-[calc(95vh-180px)] pr-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-4">
            {isDocumentMode && (
              <>
                <Alert className="bg-blue-500/10 border-blue-500/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-600">
                    Envie documentos do trabalhador (RG, CPF, ASO, certificados) e a IA irá extrair os dados automaticamente.
                  </AlertDescription>
                </Alert>
                
                {/* Documents Card - appears first in document mode */}
                <DocumentsCard />
              </>
            )}

            {/* Worker Data Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Dados do Trabalhador {isDocumentMode && '(Extraídos/Editáveis)'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder={isDocumentMode ? 'Será preenchido pelos documentos' : 'Nome completo'}
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document_number">CPF *</Label>
                    <Input
                      id="document_number"
                      {...register('document_number')}
                      placeholder={isDocumentMode ? 'Será preenchido pelos documentos' : '000.000.000-00'}
                    />
                    {errors.document_number && <p className="text-sm text-destructive">{errors.document_number.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_id">Empresa</Label>
                    <Select onValueChange={(value) => setValue('company_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(company => (
                          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Cargo/Função</Label>
                    <Input
                      id="role"
                      {...register('role')}
                      placeholder={isDocumentMode ? 'Será preenchido pelos documentos' : 'Ex: Eletricista'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    Pendente de Análise
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Additional Data Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados Adicionais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  <div 
                    className="flex-shrink-0 cursor-pointer group"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        {photoPreview ? (
                          <AvatarImage src={photoPreview} alt="Foto" />
                        ) : (
                          <AvatarFallback className="bg-muted">
                            <Camera className="h-8 w-8 text-muted-foreground" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs text-center text-muted-foreground mt-2">Clique para enviar</p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Data de Nascimento
                      </Label>
                      <Input type="date" {...register('birth_date')} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Gênero
                      </Label>
                      <Select onValueChange={(v) => setValue('gender', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="feminino">Feminino</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Droplets className="h-4 w-4" />
                        Tipo Sanguíneo
                      </Label>
                      <Select onValueChange={(v) => setValue('blood_type', v)}>
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
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Observações</Label>
                      <Textarea {...register('observations')} placeholder="Observações sobre o trabalhador..." />
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Projetos Autorizados
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsManagingProjects(true)}>
                      Gerenciar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedProjects.length > 0 ? (
                      selectedProjects.map(projectId => {
                        const project = projects.find(p => p.id === projectId);
                        return project ? (
                          <Badge key={projectId} variant="secondary">
                            {project.name}
                            <X
                              className="h-3 w-3 ml-1 cursor-pointer"
                              onClick={() => setSelectedProjects(prev => prev.filter(id => id !== projectId))}
                            />
                          </Badge>
                        ) : null;
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">Clique em "Gerenciar" para adicionar projetos</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents Card - appears at end in manual mode */}
            {!isDocumentMode && <DocumentsCard />}
          </form>
        </ScrollArea>

        {/* Manage Projects Dialog */}
        <Dialog open={isManagingProjects} onOpenChange={setIsManagingProjects}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Selecionar Projetos Autorizados</DialogTitle>
              <DialogDescription>
                Selecione os projetos nos quais o trabalhador terá acesso autorizado.
              </DialogDescription>
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
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedProjects.includes(project.id) ? 'bg-primary border-primary' : 'border-muted-foreground'
                    }`}>
                      {selectedProjects.includes(project.id) && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.location || 'Sem localização'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsManagingProjects(false)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Trabalhador'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
