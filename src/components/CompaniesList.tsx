import { format } from 'date-fns';
import { Search, Edit2 } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCompanies } from '@/hooks/useSupabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/supabase';

export const CompaniesList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: companies = [], isLoading, refetch } = useCompanies();
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [projectManagers, setProjectManagers] = useState('');
  const [vessels, setVessels] = useState('');
  const { toast } = useToast();

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditCompany = (company: any) => {
    setSelectedCompany(company);
    setCompanyName(company.name);
    setProjectManagers(company.project_managers?.join('\n') || '');
    setVessels(company.vessels?.join('\n') || '');
    setIsDialogOpen(true);
  };

  const handleSaveCompany = async () => {
    try {
      const projectManagersArray = projectManagers
        .split('\n')
        .map(pm => pm.trim())
        .filter(pm => pm !== '');

      const vesselsArray = vessels
        .split('\n')
        .map(v => v.trim())
        .filter(v => v !== '');

      const { error } = await supabase
        .from('companies')
        .update({
          name: companyName,
          project_managers: projectManagersArray,
          vessels: vesselsArray,
        })
        .eq('id', selectedCompany.id);

      if (error) throw error;

      toast({
        title: "Empresa atualizada",
        description: "As informações da empresa foram atualizadas com sucesso.",
      });

      refetch();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar empresa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border flex flex-col col-span-1">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Empresas</h2>
            <span className="px-2 py-1 bg-muted rounded-md text-sm text-muted-foreground">
              {companies.length}
            </span>
          </div>
          <div className="relative">
            <Search className="h-5 w-5 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar..."
              className="pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      <div className="px-6 border-b border-border">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-[200px] text-center py-3 text-sm font-medium text-muted-foreground">Empresa</th>
              <th className="w-[150px] text-center py-3 text-sm font-medium text-muted-foreground">Entrada</th>
              <th className="w-[150px] text-center py-3 text-sm font-medium text-muted-foreground">Equipe</th>
              <th className="w-[100px] text-center py-3 text-sm font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
        </table>
      </div>

      <ScrollArea className="flex-1 h-[400px]">
        <div className="px-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <table className="w-full">
              <tbody>
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="border-b border-border hover:bg-muted/50 cursor-pointer" onClick={() => handleEditCompany(company)}>
                    <td className="w-[200px] py-3 text-sm text-foreground text-center">{company.name}</td>
                    <td className="w-[150px] py-3 text-sm text-muted-foreground text-center">
                      {company.entry_time ? format(new Date(company.entry_time), 'HH:mm') : '-'}
                    </td>
                    <td className="w-[150px] py-3 text-sm text-muted-foreground text-center">
                      {company.workers_count || 0}
                    </td>
                    <td className="w-[100px] py-3 text-sm text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCompany(company);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ScrollArea>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome da Empresa</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectManagers">Gerentes de Projeto (um por linha)</Label>
              <Textarea
                id="projectManagers"
                value={projectManagers}
                onChange={(e) => setProjectManagers(e.target.value)}
                rows={4}
                placeholder="Digite um gerente por linha"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vessels">Embarcações (uma por linha)</Label>
              <Textarea
                id="vessels"
                value={vessels}
                onChange={(e) => setVessels(e.target.value)}
                rows={4}
                placeholder="Digite uma embarcação por linha"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveCompany}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};