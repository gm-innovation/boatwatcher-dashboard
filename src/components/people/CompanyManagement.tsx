import { useState } from 'react';
import { useContractorCompanies } from '@/hooks/useSupabase';
import { createCompany, updateCompany, deleteCompany } from '@/hooks/useDataProvider';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';
import type { Company } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface CompanyFormProps {
  company?: Company | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const CompanyForm = ({ company, onSuccess, onCancel }: CompanyFormProps) => {
  const [name, setName] = useState(company?.name || '');
  const [cnpj, setCnpj] = useState(company?.cnpj || '');
  const [contactEmail, setContactEmail] = useState(company?.contact_email || '');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (company) {
        await updateCompany(company.id, { name, cnpj, contact_email: contactEmail, type: 'company' });
        toast({ title: 'Empresa atualizada com sucesso' });
      } else {
        await createCompany({ name, cnpj, contact_email: contactEmail, type: 'company' });
        toast({ title: 'Empresa cadastrada com sucesso' });
      }
      queryClient.invalidateQueries({ queryKey: ['contractor-companies'] });
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome da Empresa *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cnpj">CNPJ</Label>
        <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactEmail">Email de Contato</Label>
        <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : company ? 'Atualizar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
};

export const CompanyManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const { data: companies = [], isLoading } = useContractorCompanies();
  const queryClient = useQueryClient();

  const handleDelete = async (company: Company) => {
    if (!confirm(`Tem certeza que deseja remover ${company.name}?`)) return;
    
    try {
      await deleteCompany(company.id);
      toast({ title: 'Empresa removida' });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    } catch {
      toast({ title: 'Erro ao remover empresa', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Empresas</h2>
          <p className="text-sm text-muted-foreground">{companies.length} empresas cadastradas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingCompany(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
            </DialogHeader>
            <CompanyForm 
              company={editingCompany} 
              onSuccess={() => {
                setIsDialogOpen(false);
                setEditingCompany(null);
              }}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingCompany(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : companies.length > 0 ? (
        <ScrollArea className="h-[500px] border rounded-lg">
          <table className="w-full">
            <thead className="sticky top-0 bg-card border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">CNPJ</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b hover:bg-muted/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">{company.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{company.cnpj || '-'}</td>
                  <td className="p-4 text-sm text-muted-foreground">{company.contact_email || '-'}</td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingCompany(company);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(company)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma empresa cadastrada</p>
          <p className="text-sm">Adicione a primeira empresa</p>
        </div>
      )}
    </div>
  );
};
