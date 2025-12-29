import { useState, useEffect } from "react";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectById, useCompanies } from "@/hooks/useSupabase";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ProjectForm = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCompanies();
  
  // Form state
  const [projectName, setProjectName] = useState("");
  const [projectStatus, setProjectStatus] = useState("active");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Fetch project data when selected
  const { data: projectData } = useProjectById(selectedProjectId);

  // Update form when project is selected
  useEffect(() => {
    if (projectData) {
      setProjectName(projectData.name || "");
      setProjectStatus(projectData.status || "active");
      setSelectedCompanyId(projectData.client_id || null);
    } else {
      setProjectName("");
      setProjectStatus("active");
      setSelectedCompanyId(null);
    }
  }, [projectData]);

  const handleSave = async () => {
    if (!isCreatingNew && !selectedProjectId) {
      toast({
        title: "Erro ao salvar",
        description: "Selecione um projeto primeiro",
        variant: "destructive",
      });
      return;
    }

    if (!projectName.trim()) {
      toast({
        title: "Erro ao salvar",
        description: "Digite o nome do projeto",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const projectDataToSave = {
        name: projectName,
        status: projectStatus,
        client_id: selectedCompanyId,
      };

      if (isCreatingNew) {
        const { data, error } = await supabase
          .from('projects')
          .insert(projectDataToSave)
          .select()
          .single();

        if (error) throw error;
        
        setSelectedProjectId(data.id);
        setIsCreatingNew(false);

        await queryClient.invalidateQueries({ queryKey: ['projects'] });

        toast({
          title: "Projeto criado",
          description: "O novo projeto foi criado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from('projects')
          .update(projectDataToSave)
          .eq('id', selectedProjectId);

        if (error) throw error;

        await queryClient.invalidateQueries({ queryKey: ['projects'] });

        toast({
          title: "Projeto atualizado",
          description: "As alterações foram salvas com sucesso",
        });
      }
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewProject = () => {
    setIsCreatingNew(true);
    setSelectedProjectId(null);
    setProjectName("");
    setProjectStatus("active");
    setSelectedCompanyId(null);
  };

  return (
    <div className="border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Configuração do Projeto</h2>
        <Button onClick={handleNewProject} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      <div className="space-y-6">
        {!isCreatingNew && (
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onProjectSelect={(id) => {
              setSelectedProjectId(id);
              setIsCreatingNew(false);
            }}
          />
        )}

        {(selectedProjectId || isCreatingNew) && (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="projectName">Nome do Projeto</Label>
              <Input 
                id="projectName" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1"
                placeholder="Digite o nome do projeto"
                required
              />
            </div>

            <div>
              <Label htmlFor="companyId">Empresa (Cliente)</Label>
              <Select 
                value={selectedCompanyId || undefined}
                onValueChange={setSelectedCompanyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="projectStatus">Status</Label>
              <Select 
                value={projectStatus}
                onValueChange={setProjectStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleSave}
              disabled={isSaving}
              className="mt-4"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingNew ? "Criar Projeto" : "Salvar Alterações"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
