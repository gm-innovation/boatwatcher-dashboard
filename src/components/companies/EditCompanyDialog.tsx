import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';

interface EditCompanyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  company: any;
  onSave: () => void;
}

export const EditCompanyDialog = ({ isOpen, onClose, company, onSave }: EditCompanyDialogProps) => {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [projectManagers, setProjectManagers] = useState(
    Array.isArray(company?.project_managers) 
      ? company.project_managers.join('\n') 
      : ''
  );
  const [vessels, setVessels] = useState(
    Array.isArray(company?.vessels) 
      ? company.vessels.join('\n') 
      : ''
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveCompany = async () => {
    try {
      setIsLoading(true);
      console.log('Saving company with ID:', company.id);

      const projectManagersArray = projectManagers
        .split('\n')
        .map(pm => pm.trim())
        .filter(pm => pm !== '');

      const vesselsArray = vessels
        .split('\n')
        .map(v => v.trim())
        .filter(v => v !== '');

      console.log('Project Managers:', projectManagersArray);
      console.log('Vessels:', vesselsArray);

      const { data, error } = await supabase
        .from('companies')
        .update({
          name: companyName,
          project_managers: projectManagersArray,
          vessels: vesselsArray,
        })
        .eq('id', company.id)
        .select();

      if (error) {
        console.error('Error saving company:', error);
        throw error;
      }

      console.log('Updated company data:', data);

      toast({
        title: "Empresa atualizada",
        description: "As informações da empresa foram atualizadas com sucesso.",
      });

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error in handleSaveCompany:', error);
      toast({
        title: "Erro ao atualizar empresa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCompany} disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};