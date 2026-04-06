import { useState } from 'react';
import { useContractorCompanies, useProjects } from '@/hooks/useSupabase';
import { createCompany, updateCompany, deleteCompany } from '@/hooks/useDataProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const { data: companies = [], isLoading } = useContractorCompanies();
  const { data: projects = [] } = useProjects();
  const queryClient = useQueryClient();

  const handleDelete = async (company: Company) => {
    if (!confirm(`Tem certeza que deseja remover ${company.name}?`)) return;
    
    try {
      await deleteCompany(company.id);
      toast({ title: 'Empresa removida' });
      queryClient.invalidateQueries({ queryKey: ['contractor-companies'] });
    } catch {
      toast({ title: 'Erro ao remover empresa', variant: 'destructive' });
    }
  };

  const toggleCompany = (id: string) => {
    setSelectedCompanyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = companies.length > 0 && selectedCompanyIds.size === companies.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedCompanyIds(new Set());
    } else {
      setSelectedCompanyIds(new Set(companies.map(c => c.id)));
    }
  };

  const handleAuthorizeProject = async (projectId: string) => {
    setIsAuthorizing(true);
    try {
      const { data, error } = await supabase.rpc('authorize_companies_to_project' as any, {
        _company_ids: Array.from(selectedCompanyIds),
        _project_id: projectId,
      });
      if (error) throw error;

      toast({
        title: 'Autorização concluída',
        description: `${data} trabalhador(es) de ${selectedCompanyIds.size} empresa(s) autorizado(s) no projeto.`,
      });

      queryClient.invalidateQueries({ queryKey: ['workers'] });
      setSelectedCompanyIds(new Set());
      setIsProjectDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro ao autorizar', description: error.message, variant: 'destructive' });
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Empresas</h2>
          <p className="text-sm text-muted-foreground">{companies.length} empresas cadastradas</p>
        </div>
        <div className="flex gap-2">
          {selectedCompanyIds.size > 0 && (
            <Button variant="outline" onClick={() => setIsProjectDialogOpen(true)}>
              Autorizar Projeto ({selectedCompanyIds.size})
            </Button>
          )}
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
                <th className="w-10 p-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todas"
                  />
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">CNPJ</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b hover:bg-muted/50">
                  <td className="w-10 p-3">
                    <Checkbox
                      checked={selectedCompanyIds.has(company.id)}
                      onCheckedChange={() => toggleCompany(company.id)}
                      aria-label={`Selecionar ${company.name}`}
                    />
                  </td>
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

      {/* Project selection dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Projeto para Autorização</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedCompanyIds.size} empresa(s) selecionada(s). Escolha o projeto para autorizar todos os trabalhadores vinculados.
          </p>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {projects.filter((p: any) => p.status === 'active').map((project: any) => (
                <Button
                  key={project.id}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isAuthorizing}
                  onClick={() => handleAuthorizeProject(project.id)}
                >
                  {project.name}
                  {project.location && (
                    <span className="ml-2 text-xs text-muted-foreground">— {project.location}</span>
                  )}
                </Button>
              ))}
              {projects.filter((p: any) => p.status === 'active').length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum projeto ativo encontrado</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
