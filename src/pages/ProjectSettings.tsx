import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ProjectSelector } from "@/components/ProjectSelector";
import { useAuth } from "@/hooks/useAuth";
import UserManagement from "@/components/UserManagement";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ProjectSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: authLoading } = useAuth('admin');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleLogoUpload = (themeMode: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const logoKey = `company_${themeMode}`;
        localStorage.setItem(logoKey, reader.result as string);
        toast({
          title: "Logo atualizada",
          description: `A logo foi atualizada com sucesso para o modo ${themeMode === 'light' ? 'claro' : 'escuro'}.`,
        });
      };
      
      reader.readAsDataURL(file);
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
          <Accordion type="single" collapsible className="w-full space-y-4">
            {/* Configuração do Projeto */}
            <AccordionItem value="project-config" className="border rounded-lg">
              <AccordionTrigger className="px-4">
                <h2 className="text-xl font-semibold">Configuração do Projeto</h2>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex gap-2">
                    <ProjectSelector
                      selectedProjectId={selectedProjectId}
                      onProjectSelect={setSelectedProjectId}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="vesselName">Nome da Embarcação</Label>
                    <Input
                      id="vesselName"
                      name="vesselName"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="startDate">Data de Início</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="projectType">Tipo de Projeto</Label>
                    <Input
                      id="projectType"
                      name="projectType"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="engineer">Responsável</Label>
                    <Input
                      id="engineer"
                      name="engineer"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Armador</Label>
                    <Input
                      id="company"
                      name="company"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="captain">Comandante</Label>
                    <Input
                      id="captain"
                      name="captain"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="crewCount">Tripulação</Label>
                    <Input
                      id="crewCount"
                      name="crewCount"
                      className="mt-1"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Cadastro de Usuários */}
            <AccordionItem value="user-management" className="border rounded-lg">
              <AccordionTrigger className="px-4">
                <h2 className="text-xl font-semibold">Cadastro de Usuários</h2>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <UserManagement />
              </AccordionContent>
            </AccordionItem>

            {/* Configuração do Sistema */}
            <AccordionItem value="system-config" className="border rounded-lg">
              <AccordionTrigger className="px-4">
                <h2 className="text-xl font-semibold">Configuração do Sistema</h2>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Logos do Sistema</h3>
                    <Separator className="my-4" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Logo Modo Claro */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="logoLight">Logo (Modo Claro)</Label>
                          <Input
                            id="logoLight"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload('light')}
                            className="mt-2"
                          />
                        </div>
                        <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-white">
                          {localStorage.getItem('company_light') ? (
                            <img
                              src={localStorage.getItem('company_light') || ''}
                              alt="Logo Modo Claro"
                              className="max-h-24 max-w-full object-contain"
                            />
                          ) : (
                            <p className="text-muted-foreground">Nenhuma logo definida</p>
                          )}
                        </div>
                      </div>

                      {/* Logo Modo Escuro */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="logoDark">Logo (Modo Escuro)</Label>
                          <Input
                            id="logoDark"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload('dark')}
                            className="mt-2"
                          />
                        </div>
                        <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-zinc-900">
                          {localStorage.getItem('company_dark') ? (
                            <img
                              src={localStorage.getItem('company_dark') || ''}
                              alt="Logo Modo Escuro"
                              className="max-h-24 max-w-full object-contain"
                            />
                          ) : (
                            <p className="text-muted-foreground">Nenhuma logo definida</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettings;
