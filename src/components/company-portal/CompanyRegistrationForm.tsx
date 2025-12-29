import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  
  // Logo upload
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Documents upload
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
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
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

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: RegistrationFormData) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Upload logo if exists
      const logoUrl = await uploadLogo();

      // Create company
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

      // Associate user with company
      const { error: userCompanyError } = await supabase
        .from('user_companies')
        .insert({
          user_id: user.id,
          company_id: newCompany.id,
        });

      if (userCompanyError) throw userCompanyError;

      // Save company documents
      if (documents.length > 0) {
        const docsToInsert = documents.map(doc => ({
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
    <div className="max-w-2xl mx-auto mt-12">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Portal da Empresa</CardTitle>
          <CardDescription>
            Complete o cadastro da sua empresa para acessar o portal e gerenciar seus trabalhadores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

            {/* Logo Upload */}
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
                <div className="flex items-center gap-4 p-4 border rounded-lg">
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
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    Clique ou arraste para enviar o logo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG até 2MB
                  </p>
                </div>
              )}
            </div>

            {/* Documents Upload */}
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
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              >
                {uploadingDocs ? (
                  <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">
                  Contrato Social, Alvará, Certidões
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPG até 10MB cada
                </p>
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

            <Button type="submit" className="w-full" size="lg" disabled={isLoading || uploadingDocs || uploadingLogo}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
