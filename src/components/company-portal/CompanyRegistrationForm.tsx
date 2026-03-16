import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storageProvider';
import { usesLocalServer } from '@/lib/runtimeProfile';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Upload, X, FileText, Loader2, Image as ImageIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const registrationSchema = z.object({
  name: z.string().min(1, 'Nome da empresa é obrigatório'),
  cnpj: z.string().min(14, 'CNPJ inválido').max(18),
  responsibleName: z.string().min(1, 'Nome do responsável é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface UploadedDocument {
  filename: string;
  file_url: string;
  document_type: string;
}

interface CompanyRegistrationFormProps {
  onSuccess: () => void;
}

export const CompanyRegistrationForm = ({ onSuccess }: CompanyRegistrationFormProps) => {
  const { user } = useAuth();
  const isLocalRuntime = usesLocalServer();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const docsInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
  });

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Selecione apenas imagens', variant: 'destructive' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Imagem deve ter no máximo 2MB', variant: 'destructive' });
      return;
    }

    setLogoFile(file);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setLogoPreview(loadEvent.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;

    setUploadingLogo(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      if (isLocalRuntime) {
        return await uploadFile('company-documents', filePath, logoFile, { upsert: true });
      }

      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(filePath, logoFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('company-documents')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload do logo:', error);
      toast({ title: 'Erro ao fazer upload do logo', variant: 'destructive' });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDocumentsSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (isLocalRuntime) {
      toast({
        title: 'Documentos institucionais indisponíveis no desktop',
        description: 'O cadastro de documentos institucionais do portal ainda será conectado ao servidor local.',
        variant: 'destructive'
      });
      event.target.value = '';
      return;
    }

    setUploadingDocs(true);

    try {
      const newDocs: UploadedDocument[] = [];

      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: `${file.name} excede 10MB`, variant: 'destructive' });
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `doc-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('company-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          continue;
        }

        const { data } = supabase.storage
          .from('company-documents')
          .getPublicUrl(filePath);

        newDocs.push({
          filename: file.name,
          file_url: data.publicUrl,
          document_type: 'Institucional'
        });
      }

      setDocuments((previous) => [...previous, ...newDocs]);

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
    setDocuments((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: RegistrationFormData) => {
    if (!user) return;

    if (isLocalRuntime) {
      toast({
        title: 'Cadastro de empresa indisponível no desktop',
        description: 'O vínculo usuário-empresa ainda depende do backend web e será conectado ao servidor local na próxima fase.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const logoUrl = await uploadLogo();

      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: data.name,
          cnpj: data.cnpj,
          contact_email: data.email,
          project_managers: [data.responsibleName],
          logo_url_light: logoUrl,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      const { error: userCompanyError } = await supabase
        .from('user_companies')
        .insert({
          user_id: user.id,
          company_id: newCompany.id,
        });

      if (userCompanyError) throw userCompanyError;

      if (documents.length > 0) {
        const docsToInsert = documents.map((doc) => ({
          company_id: newCompany.id,
          document_type: doc.document_type,
          filename: doc.filename,
          file_url: doc.file_url,
        }));

        const { error: docsError } = await supabase
          .from('company_documents')
          .insert(docsToInsert);

        if (docsError) {
          console.error('Erro ao salvar documentos:', docsError);
        }
      }

      toast({ title: 'Perfil da empresa criado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['user-company'] });
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar perfil',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-4">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Portal da Empresa</CardTitle>
          <CardDescription>
            Complete o cadastro da sua empresa para acessar o portal e gerenciar seus trabalhadores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {isLocalRuntime && (
              <Alert>
                <AlertDescription>
                  No desktop local, o cadastro inicial da empresa ainda não está disponível porque o vínculo usuário-empresa será conectado ao servidor local na próxima fase.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nome da Empresa *</Label>
              <Input
                id="name"
                placeholder="Ex: Construtora XYZ Ltda"
                {...register('name')}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                {...register('cnpj')}
              />
              {errors.cnpj && <p className="text-sm text-destructive">{errors.cnpj.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsibleName">Nome do Responsável *</Label>
              <Input
                id="responsibleName"
                placeholder="Nome completo do responsável"
                {...register('responsibleName')}
              />
              {errors.responsibleName && <p className="text-sm text-destructive">{errors.responsibleName.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@empresa.com"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  {...register('phone')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />

              {logoPreview ? (
                <div className="flex items-center gap-4 rounded-lg border p-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={logoPreview} alt="Logo preview" />
                    <AvatarFallback>
                      <ImageIcon className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{logoFile?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {logoFile && (logoFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeLogo}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:bg-muted/50"
                >
                  {uploadingLogo ? (
                    <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    Clique ou arraste para enviar o logo
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPG até 2MB
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Documentos Institucionais</Label>
              <input
                ref={docsInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleDocumentsSelect}
                className="hidden"
              />

              <div
                onClick={() => !uploadingDocs && docsInputRef.current?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:bg-muted/50"
              >
                {uploadingDocs ? (
                  <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">
                  Contrato Social, Alvará, Certidões
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, JPG até 10MB cada
                </p>
              </div>

              {documents.length > 0 && (
                <div className="mt-4 space-y-2">
                  {documents.map((doc, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{doc.filename}</p>
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

            <Button type="submit" className="w-full" size="lg" disabled={isLoading || uploadingDocs || uploadingLogo || isLocalRuntime}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando perfil...
                </>
              ) : (
                'Criar Perfil'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
