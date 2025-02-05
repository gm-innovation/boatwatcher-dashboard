import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ProjectSelector } from "@/components/ProjectSelector";
import { useProjectById, useProjects } from "@/hooks/useSupabase";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import UserManagement from "@/components/UserManagement";

const ProjectSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: authLoading } = useAuth('admin');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { data: projectInfo } = useProjectById(selectedProjectId);
  const { data: projects = [] } = useProjects();
  
  const [formData, setFormData] = useState({
    vesselName: "",
    startDate: "",
    projectType: "",
    engineer: "",
    company: "",
    captain: "",
    crewCount: ""
  });

  // Atualiza o formulário quando um projeto é selecionado
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setFormData({
        vesselName: project.vessel_name,
        startDate: project.start_date,
        projectType: project.project_type,
        engineer: project.engineer,
        company: project.company,
        captain: project.captain,
        crewCount: "15" // valor padrão já que não está na tabela
      });
    }
  };

  const handleNewProject = () => {
    setSelectedProjectId(null);
    setFormData({
      vesselName: "",
      startDate: "",
      projectType: "",
      engineer: "",
      company: "",
      captain: "",
      crewCount: ""
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (themeMode: string, logoType: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const logoKey = `${logoType}_${themeMode}`;
        localStorage.setItem(logoKey, reader.result as string);
        toast({
          title: "Logo atualizada",
          description: `A logo foi atualizada com sucesso para o modo ${themeMode === 'light' ? 'claro' : 'escuro'}.`,
        });
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const projectData = {
      vessel_name: formData.vesselName,
      start_date: formData.startDate,
      project_type: formData.projectType,
      engineer: formData.engineer,
      company: formData.company,
      captain: formData.captain,
    };

    try {
      if (selectedProjectId) {
        // Atualiza projeto existente
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', selectedProjectId);

        if (error) throw error;

        toast({
          title: "Projeto atualizado",
          description: "As informações do projeto foram atualizadas com sucesso.",
        });
      } else {
        // Cria novo projeto
        const { error } = await supabase
          .from('projects')
          .insert([projectData]);

        if (error) throw error;

        toast({
          title: "Projeto criado",
          description: "O novo projeto foi criado com sucesso.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o projeto.",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>

        <div className="space-y-8">
          {/* Seção de Projetos */}
          <div className="bg-card rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-foreground">Configurações do Projeto</h1>
              <div className="flex gap-2">
                <ProjectSelector
                  selectedProjectId={selectedProjectId}
                  onProjectSelect={handleProjectSelect}
                />
                <Button onClick={handleNewProject} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Projeto
                </Button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Logo Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-foreground">Logos da Empresa</h2>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="companyLogoLight">Logo da Empresa (Modo Claro)</Label>
                    <Input
                      id="companyLogoLight"
                      type="file"
                      accept="image/*"
                      className="mt-1"
                      onChange={handleLogoUpload('light', 'company')}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="companyLogoDark">Logo da Empresa (Modo Escuro)</Label>
                    <Input
                      id="companyLogoDark"
                      type="file"
                      accept="image/*"
                      className="mt-1"
                      onChange={handleLogoUpload('dark', 'company')}
                    />
                  </div>
                </div>
              </div>

              {/* Client Logo Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-foreground">Logos do Cliente</h2>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="clientLogoLight">Logo do Cliente (Modo Claro)</Label>
                    <Input
                      id="clientLogoLight"
                      type="file"
                      accept="image/*"
                      className="mt-1"
                      onChange={handleLogoUpload('light', 'client')}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="clientLogoDark">Logo do Cliente (Modo Escuro)</Label>
                    <Input
                      id="clientLogoDark"
                      type="file"
                      accept="image/*"
                      className="mt-1"
                      onChange={handleLogoUpload('dark', 'client')}
                    />
                  </div>
                </div>
              </div>

              {/* Project Information Section */}
              <div className="space-y-4 md:col-span-2">
                <h2 className="text-lg font-medium text-foreground">Informações do Projeto</h2>
                <Separator className="my-4" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vesselName">Nome da Embarcação</Label>
                    <Input
                      id="vesselName"
                      name="vesselName"
                      value={formData.vesselName}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="startDate">Data de Início</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="projectType">Tipo de Projeto</Label>
                    <Input
                      id="projectType"
                      name="projectType"
                      value={formData.projectType}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="engineer">Responsável</Label>
                    <Input
                      id="engineer"
                      name="engineer"
                      value={formData.engineer}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="company">Armador</Label>
                    <Input
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="captain">Comandante</Label>
                    <Input
                      id="captain"
                      name="captain"
                      value={formData.captain}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="crewCount">Tripulação</Label>
                    <Input
                      id="crewCount"
                      name="crewCount"
                      value={formData.crewCount}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit">
                {selectedProjectId ? 'Atualizar Projeto' : 'Criar Projeto'}
              </Button>
            </div>
          </form>
        </div>

          {/* Seção de Gerenciamento de Usuários */}
          <div className="bg-card rounded-lg shadow-sm p-6">
            <UserManagement />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettings;
