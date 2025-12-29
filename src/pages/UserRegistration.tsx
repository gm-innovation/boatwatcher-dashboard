import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ensureValidSession } from '@/utils/ensureValidSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Upload, 
  FileText, 
  Camera, 
  CheckCircle, 
  Loader2,
  Building2,
  X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';

const registrationSchema = z.object({
  full_name: z.string().min(1, 'Nome completo é obrigatório'),
  document_number: z.string().min(11, 'CPF inválido'),
  job_function: z.string().min(1, 'Cargo/Função é obrigatório'),
  company_name: z.string().min(1, 'Empresa é obrigatória'),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface UploadedDocument {
  filename: string;
  file_url: string;
  file_type: string;
}

const UserRegistration = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [showCustomCompany, setShowCustomCompany] = useState(false);
  const [customCompany, setCustomCompany] = useState('');
  const [showCustomJobFunction, setShowCustomJobFunction] = useState(false);
  const [customJobFunction, setCustomJobFunction] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef = useRef<HTMLInputElement>(null);

  // Fetch companies
  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch job functions
  const { data: jobFunctions = [] } = useQuery({
    queryKey: ['job-functions-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_functions')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
  });

  const watchedCompany = watch('company_name');
  const watchedJobFunction = watch('job_function');

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

  // Handle document upload
  const handleDocumentsSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingDocs(true);
    
    try {
      const newDocs: UploadedDocument[] = [];
      
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: `${file.name} excede 10MB`, variant: 'destructive' });
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `pending-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `pending/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('worker-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          continue;
        }

        const { data } = supabase.storage
          .from('worker-documents')
          .getPublicUrl(filePath);

        newDocs.push({
          filename: file.name,
          file_url: data.publicUrl,
          file_type: file.type
        });
      }

      setDocuments(prev => [...prev, ...newDocs]);
      
      if (newDocs.length > 0) {
        toast({ title: `${newDocs.length} documento(s) carregado(s)` });
      }
    } catch (error) {
      console.error('Erro ao fazer upload de documentos:', error);
      toast({ title: 'Erro ao fazer upload de documentos', variant: 'destructive' });
    } finally {
      setUploadingDocs(false);
      if (docsInputRef.current) {
        docsInputRef.current.value = '';
      }
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleCompanySelect = (value: string) => {
    if (value === 'custom') {
      setShowCustomCompany(true);
      setValue('company_name', '');
    } else {
      setShowCustomCompany(false);
      setCustomCompany('');
      setValue('company_name', value);
    }
  };

  const handleJobFunctionSelect = (value: string) => {
    if (value === 'custom') {
      setShowCustomJobFunction(true);
      setValue('job_function', '');
    } else {
      setShowCustomJobFunction(false);
      setCustomJobFunction('');
      setValue('job_function', value);
    }
  };

  const uploadPhoto = async (workerId: string): Promise<string | null> => {
    if (!photoFile) return null;

    // Validate session before upload (if user is logged in)
    const validSession = await ensureValidSession();
    if (!validSession) {
      // For public registration, we may not have a session
      // Continue anyway as storage might be public
      console.warn('[uploadPhoto] No valid session, attempting upload anyway');
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

    const { data } = supabase.storage.from('worker-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const onSubmit = async (data: RegistrationFormData) => {
    setIsLoading(true);
    
    try {
      // Find or use company
      let companyId: string | null = null;
      const existingCompany = companies.find(c => c.name === data.company_name);
      
      if (existingCompany) {
        companyId = existingCompany.id;
      }

      // Create worker with pending_review status
      const { data: newWorker, error: workerError } = await supabase
        .from('workers')
        .insert({
          name: data.full_name,
          document_number: data.document_number,
          role: data.job_function,
          company_id: companyId,
          status: 'pending_review',
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

      // Save documents (basic, no AI extraction here)
      if (documents.length > 0 && newWorker) {
        const docsToInsert = documents.map(doc => ({
          worker_id: newWorker.id,
          document_type: 'Outros',
          document_url: doc.file_url,
          filename: doc.filename,
          status: 'valid',
        }));

        await supabase.from('worker_documents').insert(docsToInsert);
      }

      setIsSuccess(true);
    } catch (error: any) {
      toast({ 
        title: 'Erro ao enviar cadastro', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold">Cadastro Enviado!</h2>
            <p className="text-muted-foreground">
              Seu cadastro foi recebido e está em análise. 
              Você receberá uma notificação quando for aprovado.
            </p>
            <Button asChild className="mt-4">
              <Link to="/login">Voltar ao Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
              <User className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Cadastro de Trabalhador</CardTitle>
            <CardDescription>
              Preencha seus dados para solicitar acesso ao sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Photo Upload */}
              <div className="flex justify-center">
                <div className="space-y-2 text-center">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <div 
                    onClick={() => photoInputRef.current?.click()}
                    className="relative cursor-pointer group mx-auto"
                  >
                    <Avatar className="h-28 w-28">
                      {photoPreview ? (
                        <AvatarImage src={photoPreview} alt="Foto" />
                      ) : (
                        <AvatarFallback className="bg-muted">
                          <User className="h-12 w-12 text-muted-foreground" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clique para enviar sua foto
                  </p>
                </div>
              </div>

              {/* Personal Info */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input 
                    id="full_name" 
                    placeholder="Seu nome completo"
                    {...register('full_name')} 
                  />
                  {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="document_number">CPF *</Label>
                  <Input 
                    id="document_number" 
                    placeholder="000.000.000-00"
                    {...register('document_number')} 
                  />
                  {errors.document_number && <p className="text-sm text-destructive">{errors.document_number.message}</p>}
                </div>

                {/* Company Selection */}
                <div className="space-y-2">
                  <Label>Empresa *</Label>
                  {!showCustomCompany ? (
                    <Select onValueChange={handleCompanySelect} value={watchedCompany}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione sua empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(company => (
                          <SelectItem key={company.id} value={company.name}>
                            {company.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">
                          <span className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Outra empresa...
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Nome da empresa"
                        value={customCompany}
                        onChange={(e) => {
                          setCustomCompany(e.target.value);
                          setValue('company_name', e.target.value);
                        }}
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setShowCustomCompany(false);
                          setValue('company_name', '');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {errors.company_name && <p className="text-sm text-destructive">{errors.company_name.message}</p>}
                </div>

                {/* Job Function Selection */}
                <div className="space-y-2">
                  <Label>Cargo/Função *</Label>
                  {!showCustomJobFunction ? (
                    <Select onValueChange={handleJobFunctionSelect} value={watchedJobFunction}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione seu cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobFunctions.map(jf => (
                          <SelectItem key={jf.id} value={jf.name}>
                            {jf.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">
                          Outro cargo...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Seu cargo/função"
                        value={customJobFunction}
                        onChange={(e) => {
                          setCustomJobFunction(e.target.value);
                          setValue('job_function', e.target.value);
                        }}
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setShowCustomJobFunction(false);
                          setValue('job_function', '');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {errors.job_function && <p className="text-sm text-destructive">{errors.job_function.message}</p>}
                </div>
              </div>

              {/* Documents Upload */}
              <div className="space-y-2">
                <Label>Documentos (Opcional)</Label>
                <input
                  ref={docsInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  onChange={handleDocumentsSelect}
                  className="hidden"
                />
                
                <div 
                  onClick={() => !uploadingDocs && docsInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {uploadingDocs ? (
                    <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        ASO, NRs, RG, CPF, etc.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF ou imagens até 10MB
                      </p>
                    </>
                  )}
                </div>

                {/* Documents List */}
                {documents.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {documents.map((doc, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.filename}</p>
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
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading || uploadingDocs}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Cadastro'
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já possui conta?{' '}
                <Link to="/login" className="text-primary hover:underline">
                  Fazer login
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserRegistration;
