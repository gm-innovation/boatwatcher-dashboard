
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";

const ProjectSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projectInfo, setProjectInfo] = useState({
    vesselName: "MV Ocean Explorer",
    startDate: "2024-03-15",
    projectType: "Docagem",
    engineer: "Eng. João Silva",
    company: "Marítima Internacional",
    captain: "Cap. Carlos Santos"
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProjectInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here we would typically save to a backend
    // For now, we'll just show a success message
    toast({
      title: "Configurações atualizadas",
      description: "As informações do projeto foram atualizadas com sucesso.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-semibold mb-6">Configurações do Projeto</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo Upload Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-medium">Logos</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="companyLogo">Logo da Empresa</Label>
                    <Input
                      id="companyLogo"
                      type="file"
                      accept="image/*"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="clientLogo">Logo do Cliente</Label>
                    <Input
                      id="clientLogo"
                      type="file"
                      accept="image/*"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Project Information Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-medium">Informações do Projeto</h2>
                
                <div>
                  <Label htmlFor="vesselName">Nome da Embarcação</Label>
                  <Input
                    id="vesselName"
                    name="vesselName"
                    value={projectInfo.vesselName}
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
                    value={projectInfo.startDate}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="projectType">Tipo de Projeto</Label>
                  <Input
                    id="projectType"
                    name="projectType"
                    value={projectInfo.projectType}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="engineer">Engenheiro Responsável</Label>
                  <Input
                    id="engineer"
                    name="engineer"
                    value={projectInfo.engineer}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="company">Empresa da Embarcação</Label>
                  <Input
                    id="company"
                    name="company"
                    value={projectInfo.company}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="captain">Comandante</Label>
                  <Input
                    id="captain"
                    name="captain"
                    value={projectInfo.captain}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit">
                Salvar Alterações
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettings;
