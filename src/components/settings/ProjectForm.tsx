import { useState, useEffect } from "react";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProjectById, useCompanies } from "@/hooks/useSupabase";
import { useInmetaAlvos } from "@/hooks/useInmetaApi";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const ProjectForm = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCompanies();
  const { data: inmetaAlvos = [] } = useInmetaAlvos();
  
  // Form state
  const [vesselName, setVesselName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [projectType, setProjectType] = useState("");
  const [engineer, setEngineer] = useState("");
  const [captain, setCaptain] = useState("");
  const [crewCount, setCrewCount] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedInmetaAlvoId, setSelectedInmetaAlvoId] = useState<string | null>(null);

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
      setCrewCount(projectData.crew_count?.toString() || "");
      setSelectedCompanyId(projectData.client_id || null);
      setSelectedInmetaAlvoId(projectData.external_project_id || null);
    } else {
      setVesselName("");
      setStartDate("");
      setProjectType("");
      setEngineer("");
      setCaptain("");
      setCrewCount("");
      setSelectedCompanyId(null);
      setSelectedInmetaAlvoId(null);
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

    if (!selectedInmetaAlvoId) {
      toast({
        title: "Erro ao salvar",
        description: "Selecione uma obra do Inmeta",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const inmetaAlvo = inmetaAlvos.find(p => p.id === selectedInmetaAlvoId);
      const projectData = {
        vessel_name: vesselName || inmetaAlvo?.nome,
        start_date: startDate,
        project_type: projectType,
        engineer: engineer,
        captain: captain,
        crew_count: crewCount ? parseInt(crewCount) : null,
        client_id: selectedCompanyId,
        external_project_id: selectedInmetaAlvoId
      };

      if (isCreatingNew) {
        const { data, error } = await supabase
          .from('projects')
          .insert(projectData)
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
          .update(projectData)
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
    setVesselName("");
    setStartDate("");
    setProjectType("");
    setEngineer("");
    setCaptain("");
    setCrewCount("");
    setSelectedCompanyId(null);
    setSelectedInmetaAlvoId(null);
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
              <Label htmlFor="inmetaAlvoId">Obra do Inmeta</Label>
              <Select 
                value={selectedInmetaAlvoId || undefined}
                onValueChange={setSelectedInmetaAlvoId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma obra" />
                </SelectTrigger>
                <SelectContent>
                  {inmetaAlvos.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="companyId">Empresa</Label>
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
              <Label htmlFor="vesselName">Nome da Embarcação</Label>
              <Input 
                id="vesselName" 
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                className="mt-1"
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

            <div>
              <Label htmlFor="crewCount">Quantidade de Tripulantes</Label>
              <Input 
                id="crewCount" 
                type="number"
                value={crewCount}
                onChange={(e) => setCrewCount(e.target.value)}
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
