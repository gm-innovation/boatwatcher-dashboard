import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Mail,
  Phone,
  MapPin,
  Edit,
  Save,
  X
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const CompanyProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    contact_email: ''
  });

  // Get company ID for current user
  const { data: userCompanyData } = useQuery({
    queryKey: ['user-company-full', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data?.company_id;
    },
    enabled: !!user?.id
  });

  // Get company details
  const { data: company, isLoading } = useQuery({
    queryKey: ['company-profile', userCompanyData],
    queryFn: async () => {
      if (!userCompanyData) return null;
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', userCompanyData)
        .single();

      if (error) throw error;
      
      setFormData({
        name: data.name || '',
        cnpj: data.cnpj || '',
        contact_email: data.contact_email || ''
      });
      
      return data;
    },
    enabled: !!userCompanyData
  });

  const updateCompany = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!company?.id) throw new Error('Empresa não encontrada');
      
      const { error } = await supabase
        .from('companies')
        .update(data)
        .eq('id', company.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      toast.success('Dados atualizados com sucesso');
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  const handleSave = () => {
    updateCompany.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({
      name: company?.name || '',
      cnpj: company?.cnpj || '',
      contact_email: company?.contact_email || ''
    });
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Empresa não encontrada</p>
            <p className="text-sm mt-1">Entre em contato com o administrador</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados da Empresa
            </CardTitle>
            <CardDescription>
              Informações cadastrais da sua empresa
            </CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateCompany.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome da Empresa</Label>
            {isEditing ? (
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            ) : (
              <p className="text-lg font-medium">{company.name}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>CNPJ</Label>
            {isEditing ? (
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            ) : (
              <p className="text-muted-foreground">{company.cnpj || 'Não informado'}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Email de Contato</Label>
            {isEditing ? (
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="contato@empresa.com"
              />
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                {company.contact_email || 'Não informado'}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Status</Label>
            <div>
              <Badge variant="default">Ativa</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
