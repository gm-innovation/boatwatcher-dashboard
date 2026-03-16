import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { uploadFile } from '@/lib/storageProvider';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { ensureValidSession } from '@/utils/ensureValidSession';
import { useDocumentExtraction, ProcessedDocument, ExtractedDocumentData } from '@/hooks/useDocumentExtraction';
import { useJobFunctions } from '@/hooks/useJobFunctions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Upload, 
  X, 
  FileText, 
  Loader2, 
  User, 
  Camera,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getValidityStatus, formatCPF, normalizeGender, DocumentType } from '@/utils/documentParser';

const employeeSchema = z.object({
  full_name: z.string().min(1, 'Nome completo é obrigatório'),
  document_number: z.string().min(11, 'CPF inválido'),
  job_function_id: z.string().optional(),
  birth_date: z.string().optional(),
  gender: z.string().optional(),
  blood_type: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface EmployeeFormProps {
  companyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EmployeeForm = ({ companyId, onSuccess, onCancel }: EmployeeFormProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: jobFunctions = [] } = useJobFunctions();
  const { extractMultipleDocuments, isExtracting, progress } = useDocumentExtraction();
  
  const [isLoading, setIsLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  });

  const watchedValues = watch();

  // Handle photo selection
  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Selecione apenas imagens', variant: 'destructive' });
      return;
    }

    setPhotoFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle document upload with AI extraction
  const handleDocumentsSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).filter(f => 
      f.type === 'application/pdf' || 
      f.type.startsWith('image/')
    );

    if (fileArray.length === 0) {
      toast({ title: 'Selecione arquivos PDF ou imagens', variant: 'destructive' });
      return;
    }

    const processedDocs = await extractMultipleDocuments(fileArray);
    
    if (processedDocs.length > 0) {
      setDocuments(prev => [...prev, ...processedDocs]);
      
      // Auto-fill form with extracted data from first document with personal info
      for (const doc of processedDocs) {
        const extracted = doc.extracted_data;
        if (extracted) {
          if (extracted.full_name && !watchedValues.full_name) {
            setValue('full_name', extracted.full_name);
          }
          if (extracted.document_number && !watchedValues.document_number) {
            setValue('document_number', extracted.document_number);
          }
          if (extracted.birth_date && !watchedValues.birth_date) {
            setValue('birth_date', extracted.birth_date);
          }
          if (extracted.gender && !watchedValues.gender) {
            setValue('gender', normalizeGender(extracted.gender) || '');
          }
          if (extracted.blood_type && !watchedValues.blood_type) {
            setValue('blood_type', extracted.blood_type);
          }
          if (extracted.job_function && !watchedValues.job_function_id) {
            // Try to match job function
            const match = jobFunctions.find(jf => 
              jf.name.toLowerCase().includes(extracted.job_function!.toLowerCase()) ||
              extracted.job_function!.toLowerCase().includes(jf.name.toLowerCase())
            );
            if (match) {
              setValue('job_function_id', match.id);
            }
          }
        }
      }
      
      toast({ 
        title: `${processedDocs.length} documento(s) processado(s)`,
        description: 'Dados extraídos automaticamente pela IA'
      });
    }

    if (docsInputRef.current) {
      docsInputRef.current.value = '';
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const getDocumentStatusBadge = (doc: ProcessedDocument) => {
    const status = getValidityStatus(doc.expiry_date);
    
    switch (status) {
      case 'valid':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Válido
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Vencendo
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Vencido
          </Badge>
        );
    }
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

    const { error } = await supabase.storage
      .from('worker-photos')
      .upload(filePath, photoFile, { upsert: true });

    if (error) {
      console.error('[uploadPhoto] Upload error:', error);
      toast({
        title: 'Erro no upload da foto',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    }

    const { data } = await supabase.storage.from('worker-photos').createSignedUrl(filePath, 3600);
    return data?.signedUrl || null;
  };

  const onSubmit = async (data: EmployeeFormData) => {
    setIsLoading(true);
    
    try {
      // Create worker
      const { data: newWorker, error: workerError } = await supabase
        .from('workers')
        .insert({
          name: data.full_name,
          document_number: data.document_number,
          role: data.job_function_id ? jobFunctions.find(jf => jf.id === data.job_function_id)?.name : null,
          company_id: companyId,
          job_function_id: data.job_function_id || null,
          status: 'active',
        })
        .select()
        .single();

      if (workerError) throw workerError;

      // Upload photo
      if (photoFile && newWorker) {
        const photoUrl = await uploadPhoto(newWorker.id);
        if (photoUrl) {
          await supabase.from('workers').update({ photo_url: photoUrl }).eq('id', newWorker.id);
        }
      }

      // Save documents
      if (documents.length > 0 && newWorker) {
        const docsToInsert = documents.map(doc => ({
          worker_id: newWorker.id,
          document_type: doc.document_type,
          document_url: doc.file_url,
          filename: doc.filename,
          issue_date: doc.completion_date || null,
          expiry_date: doc.expiry_date || null,
          extracted_data: doc.extracted_data as any,
          status: getValidityStatus(doc.expiry_date),
        }));

        const { error: docsError } = await supabase
          .from('worker_documents')
          .insert(docsToInsert);

        if (docsError) {
          console.error('Erro ao salvar documentos:', docsError);
        }
      }

      toast({ title: 'Funcionário cadastrado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['company-workers'] });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      onSuccess();
    } catch (error: any) {
      toast({ 
        title: 'Erro ao cadastrar funcionário', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Photo Upload */}
      <div className="flex items-start gap-6">
        <div className="space-y-2">
          <Label>Foto do Funcionário</Label>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />
          <div 
            onClick={() => photoInputRef.current?.click()}
            className="relative cursor-pointer group"
          >
            <Avatar className="h-24 w-24">
              {photoPreview ? (
                <AvatarImage src={photoPreview} alt="Foto" />
              ) : (
                <AvatarFallback className="bg-muted">
                  <User className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
              )}
            </Avatar>
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Clique para enviar
          </p>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome Completo *</Label>
            <Input id="full_name" {...register('full_name')} />
            {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="document_number">CPF *</Label>
            <Input id="document_number" placeholder="000.000.000-00" {...register('document_number')} />
            {errors.document_number && <p className="text-sm text-destructive">{errors.document_number.message}</p>}
          </div>
        </div>
      </div>

      {/* Additional Fields */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="job_function_id">Cargo/Função</Label>
          <Select onValueChange={(value) => setValue('job_function_id', value)} value={watchedValues.job_function_id}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {jobFunctions.map(jf => (
                <SelectItem key={jf.id} value={jf.id}>{jf.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="birth_date">Data de Nascimento</Label>
          <Input id="birth_date" type="date" {...register('birth_date')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gênero</Label>
          <Select onValueChange={(value) => setValue('gender', value)} value={watchedValues.gender}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="blood_type">Tipo Sanguíneo</Label>
          <Select onValueChange={(value) => setValue('blood_type', value)} value={watchedValues.blood_type}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Documents Upload */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Documentos</Label>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Extração com IA
          </Badge>
        </div>
        
        <input
          ref={docsInputRef}
          type="file"
          accept=".pdf,image/*"
          multiple
          onChange={handleDocumentsSelect}
          className="hidden"
        />
        
        <div 
          onClick={() => !isExtracting && docsInputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
        >
          {isExtracting ? (
            <div className="space-y-3">
              <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Processando documentos com IA...</p>
              <Progress value={progress} className="max-w-xs mx-auto" />
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arraste ou clique para enviar ASO, NRs, RG, CPF, CNH
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF ou imagens • A IA extrairá os dados automaticamente
              </p>
            </>
          )}
        </div>

        {/* Documents List */}
        {documents.length > 0 && (
          <div className="space-y-2">
            {documents.map((doc, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {doc.document_type}
                      </Badge>
                      {doc.expiry_date && getDocumentStatusBadge(doc)}
                      {doc.completion_date && (
                        <span className="text-xs text-muted-foreground">
                          Emissão: {new Date(doc.completion_date).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || isExtracting}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Cadastrar Funcionário'
          )}
        </Button>
      </div>
    </form>
  );
};
