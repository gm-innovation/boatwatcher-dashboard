import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storageProvider';
import { useCompanies, useProjects } from '@/hooks/useSupabase';
import { useJobFunctions } from '@/hooks/useJobFunctions';
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
  Sparkles,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Edit3,
  Eye,
  Download,
  Trash2,
  Globe,
  CheckCircle2,
  FileUp,
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

type Step = 'method-select' | 'manual' | 'document';

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

const DOC_TYPE_COLORS: Record<string, string> = {
  aso: 'border-l-orange-500',
  nr10: 'border-l-blue-500',
  nr33: 'border-l-purple-500',
  nr34: 'border-l-emerald-500',
  nr35: 'border-l-green-500',
  rg: 'border-l-slate-500',
  cpf: 'border-l-slate-400',
  cnh: 'border-l-yellow-500',
};

function getDocBorderColor(type: string) {
  const key = type.toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(DOC_TYPE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return 'border-l-gray-400';
}

function getDocStatusBadge(doc: UploadedDocument) {
  if (doc.isExtracting) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Extraindo...
      </Badge>
    );
  }

  if (doc.error === 'auth') {
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <AlertCircle className="h-3 w-3" />
        Sessão expirada
      </Badge>
    );
  }

  if (doc.error === 'server') {
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <AlertCircle className="h-3 w-3" />
        Erro
      </Badge>
    );
  }

  if (doc.expiry_date) {
    const isExpired = new Date(doc.expiry_date) < new Date();
    if (isExpired) {
      return <Badge variant="destructive" className="text-xs">Vencido</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Válido</Badge>;
  }

  if (doc.extractedData && Object.keys(doc.extractedData).length > 0) {
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Dados extraídos</Badge>;
  }

  return <Badge variant="secondary" className="text-xs">Não informado</Badge>;
}

export const NewWorkerDialog = ({ open, onOpenChange, onSuccess }: NewWorkerDialogProps) => {
  const [step, setStep] = useState<Step>('method-select');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isManagingProjects, setIsManagingProjects] = useState(false);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);
  const [isManualDocMode, setIsManualDocMode] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const { data: companies = [] } = useCompanies();
  const { data: projects = [] } = useProjects();
  const { data: jobFunctions = [] } = useJobFunctions();
  const createDocument = useCreateWorkerDocument();
  const queryClient = useQueryClient();

  const { extractDocument, isExtracting } = useDocumentExtraction();

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      status: 'pending_review',
    }
  });

  const watchedStatus = watch('status');
  const watchedCompanyId = watch('company_id');
  const watchedRole = watch('role');
  const watchedGender = watch('gender');
  const watchedBloodType = watch('blood_type');

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const processDocument = async (file: File, docId: string) => {
    setUploadedDocuments(prev => prev.map(doc =>
      doc.id === docId ? { ...doc, isExtracting: true, error: null } : doc
    ));

    try {
      const result = await extractDocument(file);

      if (!result) {
        setUploadedDocuments(prev => prev.map(doc =>
          doc.id === docId ? { ...doc, isExtracting: false, error: 'auth' as const } : doc
        ));
        return;
      }

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

      const data = result.extracted_data;
      if (data) {
        if (data.full_name) setValue('name', data.full_name);
        if (data.document_number) setValue('document_number', data.document_number);
        if (data.birth_date) setValue('birth_date', data.birth_date);
        if (data.job_function) setValue('role', data.job_function);
        if (data.gender) setValue('gender', data.gender?.toLowerCase());
        if (data.blood_type) setValue('blood_type', data.blood_type);
      }
    } catch (error) {
      console.error('Document processing error:', error);
      setUploadedDocuments(prev => prev.map(doc =>
        doc.id === docId ? { ...doc, isExtracting: false, error: 'server' as const } : doc
      ));
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newDocs: UploadedDocument[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      type: 'Documento',
      isExtracting: true,
      error: null,
    }));

    setUploadedDocuments(prev => [...prev, ...newDocs]);
    setUploadSuccessCount(newDocs.length);

    for (const doc of newDocs) {
      await processDocument(doc.file, doc.id);
    }

    e.target.value = '';

    // Auto-clear success count after 5s
    setTimeout(() => setUploadSuccessCount(0), 5000);
  };

  const retryExtraction = async (docId: string) => {
    const doc = uploadedDocuments.find(d => d.id === docId);
    if (doc) await processDocument(doc.file, docId);
  };

  const removeDocument = (docId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== docId));
  };

  const uploadPhoto = async (workerId: string): Promise<string | null> => {
    if (!photoFile) return null;
    const validSession = await ensureValidSession();
    if (!validSession) {
      toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
      return null;
    }
    const fileExt = photoFile.name.split('.').pop();
    const fileName = `${workerId}.${fileExt}`;
    const filePath = `workers/${fileName}`;
    const result = await uploadFile('worker-photos', filePath, photoFile, { upsert: true });
    if (!result) {
      toast({ title: 'Erro no upload da foto', variant: 'destructive' });
    }
    return result;
  };

  const saveDocuments = async (workerId: string) => {
    for (const doc of uploadedDocuments) {
      let documentUrl = doc.file_url;

      if (!documentUrl) {
        const fileExt = doc.file.name.split('.').pop();
        const fileName = `${workerId}/${doc.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('worker-documents')
          .upload(fileName, doc.file, { upsert: true });
        if (uploadError) { console.error('Document upload error:', uploadError); continue; }
        const { data: urlData } = await supabase.storage.from('worker-documents').createSignedUrl(fileName, 3600);
        documentUrl = urlData?.signedUrl || null;
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

      if (photoFile && newWorker) {
        const photoUrl = await uploadPhoto(newWorker.id);
        if (photoUrl) {
          await supabase.from('workers').update({ photo_url: photoUrl }).eq('id', newWorker.id);
        }
      }

      if (uploadedDocuments.length > 0 && newWorker) {
        await saveDocuments(newWorker.id);
      }

      toast({ title: 'Trabalhador cadastrado com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      resetAll();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAll = () => {
    reset();
    setPhotoFile(null);
    setPhotoPreview(null);
    setUploadedDocuments([]);
    setSelectedProjects([]);
    setStep('method-select');
    setUploadSuccessCount(0);
    setIsManualDocMode(false);
  };

  const handleClose = () => {
    resetAll();
    onOpenChange(false);
  };

  const isDocumentMode = step === 'document';
  const anyExtracting = uploadedDocuments.some(d => d.isExtracting);

  // ─── Method Selection Screen ───
  if (step === 'method-select') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Cadastrar Novo Trabalhador
            </DialogTitle>
            <DialogDescription>
              Como deseja cadastrar o trabalhador?
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">Escolha o método de cadastro que preferir usar.</p>

          <div className="grid grid-cols-2 gap-4 mt-2">
            {/* Manual Card */}
            <button
              type="button"
              onClick={() => setStep('manual')}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-muted bg-card p-6 text-center transition-all hover:border-primary hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Edit3 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Cadastro Manual</p>
                <p className="text-xs text-muted-foreground mt-1">Preencha todos os campos manualmente</p>
              </div>
            </button>

            {/* Document Card */}
            <button
              type="button"
              onClick={() => setStep('document')}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-muted bg-card p-6 text-center transition-all hover:border-primary hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Por Documentos</p>
                <p className="text-xs text-muted-foreground mt-1">Envie documentos e a IA preenche os dados</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Form Screen (Manual or Document) ───
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <button type="button" onClick={() => setStep('method-select')} className="hover:opacity-70 transition-opacity">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            {isDocumentMode ? 'Cadastro por Documentos' : 'Cadastro Manual'}
          </DialogTitle>
          <DialogDescription>
            {isDocumentMode
              ? 'Envie documentos do trabalhador e os dados serão extraídos automaticamente.'
              : 'Preencha os dados do novo trabalhador. Os campos obrigatórios estão marcados com (*)'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 h-[calc(95vh-180px)] pr-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-4">

            {/* ── Documents Card (document mode: shown first) ── */}
            {isDocumentMode && (
              <DocumentsSection
                uploadedDocuments={uploadedDocuments}
                documentInputRef={documentInputRef}
                handleDocumentUpload={handleDocumentUpload}
                removeDocument={removeDocument}
                retryExtraction={retryExtraction}
                isManualDocMode={isManualDocMode}
                setIsManualDocMode={setIsManualDocMode}
                uploadSuccessCount={uploadSuccessCount}
                anyExtracting={anyExtracting}
              />
            )}

            {/* ── Informações Básicas ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Informações Básicas
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">Editável</Badge>
                </div>
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
                    <Label>Empresa</Label>
                    <Select onValueChange={(value) => setValue('company_id', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder={isDocumentMode ? 'Selecione ou será preenchido' : 'Selecione uma empresa'} />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(company => (
                          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo/Função</Label>
                    <Select onValueChange={(value) => setValue('role', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder={isDocumentMode ? 'Será preenchido pelos documentos' : 'Selecione a função'} />
                      </SelectTrigger>
                      <SelectContent>
                        {jobFunctions.map((jf: any) => (
                          <SelectItem key={jf.id} value={jf.name}>{jf.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={watchedStatus} onValueChange={(value) => setValue('status', value)}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending_review">Pendente de Análise</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* ── Dados Adicionais ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados Adicionais
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">Editável</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  {/* Photo section */}
                  <div className="flex-shrink-0 space-y-2">
                    <Label>Foto</Label>
                    <div className="relative">
                      <div
                        className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => photoInputRef.current?.click()}
                      >
                        {photoPreview ? (
                          <img src={photoPreview} alt="Foto" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      {photoPreview && (
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {photoPreview ? 'Alterar Foto' : 'Adicionar Foto'}
                    </button>
                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </div>

                  {/* Other fields */}
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
                          <SelectValue placeholder="Não informado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao_informado">Não informado</SelectItem>
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
                          <SelectValue placeholder="Não informado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao_informado">Não informado</SelectItem>
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

                {/* Projetos Autorizados */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Projetos Autorizados
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsManagingProjects(true)} className="gap-1">
                      <Globe className="h-3.5 w-3.5" />
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
                      <p className="text-sm text-muted-foreground">Nenhum projeto selecionado</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Documents Card (manual mode: shown last) ── */}
            {!isDocumentMode && (
              <DocumentsSection
                uploadedDocuments={uploadedDocuments}
                documentInputRef={documentInputRef}
                handleDocumentUpload={handleDocumentUpload}
                removeDocument={removeDocument}
                retryExtraction={retryExtraction}
                isManualDocMode={isManualDocMode}
                setIsManualDocMode={setIsManualDocMode}
                uploadSuccessCount={uploadSuccessCount}
                anyExtracting={anyExtracting}
              />
            )}
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

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button type="button" variant="outline" onClick={() => setStep('method-select')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Criar Trabalhador
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Documents Section Component ───
interface DocumentsSectionProps {
  uploadedDocuments: UploadedDocument[];
  documentInputRef: React.RefObject<HTMLInputElement>;
  handleDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeDocument: (docId: string) => void;
  retryExtraction: (docId: string) => void;
  isManualDocMode: boolean;
  setIsManualDocMode: (v: boolean) => void;
  uploadSuccessCount: number;
  anyExtracting: boolean;
}

function DocumentsSection({
  uploadedDocuments,
  documentInputRef,
  handleDocumentUpload,
  removeDocument,
  retryExtraction,
  isManualDocMode,
  setIsManualDocMode,
  uploadSuccessCount,
  anyExtracting,
}: DocumentsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos
            {uploadedDocuments.length > 0 && (
              <Badge variant="secondary">{uploadedDocuments.length}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isManualDocMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsManualDocMode(!isManualDocMode)}
              className="gap-1 text-xs"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Manual
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => documentInputRef.current?.click()}
              className="gap-1 text-xs"
            >
              <FileUp className="h-3.5 w-3.5" />
              Adicionar Documentos
            </Button>
          </div>
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
        {/* Success banner */}
        {uploadSuccessCount > 0 && (
          <Alert className="mb-4 bg-green-500/10 border-green-500/30">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              <span className="font-medium">Sucesso</span> — {uploadSuccessCount} arquivo(s) enviados e adicionados à fila de processamento.
            </AlertDescription>
          </Alert>
        )}

        {/* Extracting indicator */}
        {anyExtracting && (
          <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm">Extraindo dados dos documentos...</span>
            </div>
          </div>
        )}

        {uploadedDocuments.length === 0 ? (
          <div
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => documentInputRef.current?.click()}
          >
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum documento cadastrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {uploadedDocuments.map(doc => (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-3 rounded-lg bg-muted/30 border-l-4 ${getDocBorderColor(doc.type)}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{doc.type !== 'Documento' ? doc.type : doc.file.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {doc.completion_date && (
                        <span>Emissão: {new Date(doc.completion_date).toLocaleDateString('pt-BR')}</span>
                      )}
                      {doc.expiry_date && (
                        <span>Validade: {new Date(doc.expiry_date).toLocaleDateString('pt-BR')}</span>
                      )}
                      {!doc.completion_date && !doc.expiry_date && (
                        <span className="truncate">{doc.file.name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getDocStatusBadge(doc)}
                  {doc.error && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => retryExtraction(doc.id)} title="Tentar novamente" className="h-8 w-8 p-0">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  {doc.file_url && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="Visualizar">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeDocument(doc.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
