
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const ProjectSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projectInfo, setProjectInfo] = useState({
    vesselName: "MV Ocean Explorer",
    startDate: "2024-03-15",
    projectType: "Docagem",
    engineer: "Eng. João Silva",
    company: "Marítima Internacional",
    captain: "Cap. Carlos Santos",
    crewCount: "15"
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProjectInfo(prev => ({ ...prev, [name]: value }));
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Configurações atualizadas",
      description: "As informações do projeto foram atualizadas com sucesso.",
    });
  };

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

        <div className="bg-card rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-semibold mb-6 text-foreground">Configurações do Projeto</h1>

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
                    <Label htmlFor="engineer">Responsável</Label>
                    <Input
                      id="engineer"
                      name="engineer"
                      value={projectInfo.engineer}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="company">Armador</Label>
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

                  <div>
                    <Label htmlFor="crewCount">Tripulação</Label>
                    <Input
                      id="crewCount"
                      name="crewCount"
                      value={projectInfo.crewCount}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
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
