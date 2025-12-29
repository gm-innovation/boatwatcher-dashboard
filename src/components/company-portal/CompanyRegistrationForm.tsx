import { useState } from 'react';
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
import { Building2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const registrationSchema = z.object({
  name: z.string().min(1, 'Nome da empresa é obrigatório'),
  cnpj: z.string().min(14, 'CNPJ inválido').max(18),
  responsibleName: z.string().min(1, 'Nome do responsável é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface CompanyRegistrationFormProps {
  onSuccess: () => void;
}

export const CompanyRegistrationForm = ({ onSuccess }: CompanyRegistrationFormProps) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
  });

  const onSubmit = async (data: RegistrationFormData) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Create company
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: data.name,
          cnpj: data.cnpj,
          contact_email: data.email,
          project_managers: [data.responsibleName],
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

            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clique ou arraste para enviar o logo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG até 2MB
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Documentos Institucionais</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Contrato Social, Alvará, Certidões
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF até 10MB cada
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? 'Criando perfil...' : 'Criar Perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
