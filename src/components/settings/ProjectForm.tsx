import { useState, useEffect } from "react";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProjectById } from "@/hooks/useSupabase";

export const ProjectForm = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Form state
  const [vesselName, setVesselName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [projectType, setProjectType] = useState("");
  const [engineer, setEngineer] = useState("");
  const [captain, setCaptain] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Fetch project data when selected
  const { data: projectData } = useProjectById(selectedProjectId);

  // Update form when project is selected
  useEffect(() => {
    if (projectData) {
      setVesselName(projectData.vessel_name || "");
      setStartDate(projectData.start_date || "");
      setProjectType(projectData.project_type || "");
      setEngineer(projectData.engineer || "");
      setCaptain(projectData.captain || "");
      // Store the company ID for saving
      const company = projectData as any; // Temporary type assertion
      setCompanyId(company.client_id || null);
    } else {
      // Reset form when no project is selected
      setVesselName("");
      setStartDate("");
      setProjectType("");
      setEngineer("");
      setCaptain("");
      setCompanyId(null);
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

    if (!companyId && !isCreatingNew) {
      toast({
        title: "Erro ao salvar",
        description: "ID da empresa não encontrado",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (isCreatingNew) {
        // Create new project
        const { data, error } = await supabase
          .from('projects')
          .insert({
            start_date: startDate,
            project_type: projectType,
            captain: captain,
            client_id: companyId,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Update the selected project to the newly created one
        setSelectedProjectId(data.id);
        setIsCreatingNew(false);
      } else {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update({
            start_date: startDate,
            project_type: projectType,
            captain: captain,
            client_id: companyId,
          })
          .eq('id', selectedProjectId);

        if (error) throw error;
      }

      toast({
        title: isCreatingNew ? "Projeto criado" : "Projeto atualizado",
        description: isCreatingNew ? 
          "O novo projeto foi criado com sucesso" : 
          "As alterações foram salvas com sucesso",
      });
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
    // Reset form
    setVesselName("");
    setStartDate("");
    setProjectType("");
    setEngineer("");
    setCaptain("");
    setCompanyId(null);
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
              <Label htmlFor="vesselName">Nome da Embarcação</Label>
              <Input 
                id="vesselName" 
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                className="mt-1" 
                disabled
              />
            </div>
            <div>
              <Label htmlFor="startDate">Data de Início</Label>
              <Input 
                id="startDate" 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1" 
              />
            </div>
            <div>
              <Label htmlFor="projectType">Tipo de Projeto</Label>
              <Input 
                id="projectType" 
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="mt-1" 
              />
            </div>
            <div>
              <Label htmlFor="engineer">Responsável</Label>
              <Input 
                id="engineer" 
                value={engineer}
                onChange={(e) => setEngineer(e.target.value)}
                className="mt-1"
                disabled 
              />
            </div>
            <div>
              <Label htmlFor="captain">Comandante</Label>
              <Input 
                id="captain" 
                value={captain}
                onChange={(e) => setCaptain(e.target.value)}
                className="mt-1" 
              />
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