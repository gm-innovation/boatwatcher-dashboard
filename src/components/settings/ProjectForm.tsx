import { useState, useEffect } from "react";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProjectById } from "@/hooks/useSupabase";

export const ProjectForm = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Form state
  const [vesselName, setVesselName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [projectType, setProjectType] = useState("");
  const [engineer, setEngineer] = useState("");
  const [captain, setCaptain] = useState("");

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
    } else {
      // Reset form when no project is selected
      setVesselName("");
      setStartDate("");
      setProjectType("");
      setEngineer("");
      setCaptain("");
    }
  }, [projectData]);

  const handleSave = async () => {
    if (!selectedProjectId) {
      toast({
        title: "Erro ao salvar",
        description: "Selecione um projeto primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Get the company ID from the project data
      const clientId = projectData?.client_id;

      const { error } = await supabase
        .from('projects')
        .update({
          start_date: startDate,
          project_type: projectType,
          captain: captain,
          client_id: clientId, // Maintain the existing client_id
        })
        .eq('id', selectedProjectId);

      if (error) throw error;

      toast({
        title: "Projeto salvo",
        description: "As alterações foram salvas com sucesso",
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

  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-6">Configuração do Projeto</h2>
      <div className="space-y-6">
        <ProjectSelector
          selectedProjectId={selectedProjectId}
          onProjectSelect={setSelectedProjectId}
        />

        {selectedProjectId && (
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
              Salvar Alterações
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};