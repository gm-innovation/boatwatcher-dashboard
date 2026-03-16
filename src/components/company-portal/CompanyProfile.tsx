import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Mail,
  Edit,
  Save,
  X
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCompany } from '@/hooks/useCurrentCompany';
import { fetchCompanyById, updateCompany } from '@/hooks/useDataProvider';
import { toast } from 'sonner';

export const CompanyProfile = () => {
  const { user } = useAuth();
  const { data: companyAccess } = useCurrentCompany(user?.id);
  const companyId = companyAccess?.companyId;
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    contact_email: ''
  });

  const { data: company, isLoading } = useQuery({
    queryKey: ['company-profile', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      return await fetchCompanyById(companyId);
    },
    enabled: !!companyId
  });

  useEffect(() => {
    if (!company) return;

    setFormData({
      name: company.name || '',
      cnpj: company.cnpj || '',
      contact_email: company.contact_email || ''
    });
  }, [company]);

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!company?.id) throw new Error('Empresa não encontrada');
      return await updateCompany(company.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
      toast.success('Dados atualizados com sucesso');
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    }
  });

  const handleSave = () => {
    updateCompanyMutation.mutate(formData);
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
          <div className="py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Empresa não encontrada</p>
            <p className="mt-1 text-sm">Entre em contato com o administrador</p>
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
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateCompanyMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
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
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
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
                onChange={(event) => setFormData({ ...formData, cnpj: event.target.value })}
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
                onChange={(event) => setFormData({ ...formData, contact_email: event.target.value })}
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
