import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Building2, Settings, Users2, Briefcase } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserManagement from "@/components/UserManagement";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompanies } from "@/hooks/useSupabase";
import { supabase } from "@/lib/supabase";

const ProjectSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [projectManagers, setProjectManagers] = useState("");
  const [vessels, setVessels] = useState("");

  const handleLogoUpload = (themeMode: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        toast({
          title: "Erro ao fazer upload da logo",
          description: uploadError.message,
          variant: "destructive",
        });
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(fileName);

      toast({
        title: "Logo atualizada",
        description: `A logo foi atualizada com sucesso para o modo ${themeMode === 'light' ? 'claro' : 'escuro'}.`,
      });

      localStorage.setItem(`company_${themeMode}`, publicUrl);
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        logo_url: localStorage.getItem('company_light'),
      });

    if (error) {
      toast({
        title: "Erro ao cadastrar empresa",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Empresa cadastrada",
      description: "A empresa foi cadastrada com sucesso.",
    });

    // Reset form
    setCompanyName("");
    setProjectManagers("");
    setVessels("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="company" className="space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Cadastro de empresa</span>
            </TabsTrigger>
            <TabsTrigger value="project" className="space-x-2">
              <Briefcase className="h-4 w-4" />
              <span>Configuração do projeto</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="space-x-2">
              <Users2 className="h-4 w-4" />
              <span>Cadastro de usuários</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="space-x-2">
              <Settings className="h-4 w-4" />
              <span>Configuração do sistema</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6">
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6">Cadastro de Empresa</h2>
              <form onSubmit={handleCompanySubmit} className="space-y-6">
                <div>
                  <Label>Logo (Modo Claro)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload('light')}
                    className="mt-2"
                  />
                  <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-white mt-2">
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

                <div>
                  <Label>Logo (Modo Escuro)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload('dark')}
                    className="mt-2"
                  />
                  <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-zinc-900 mt-2">
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

                <div>
                  <Label htmlFor="companyName">Nome da Empresa (Armador)</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-2"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="projectManagers">Gerentes de Projeto (Responsáveis)</Label>
                  <Textarea
                    id="projectManagers"
                    value={projectManagers}
                    onChange={(e) => setProjectManagers(e.target.value)}
                    className="mt-2"
                    placeholder="Digite os nomes dos gerentes de projeto, um por linha"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="vessels">Embarcações</Label>
                  <Textarea
                    id="vessels"
                    value={vessels}
                    onChange={(e) => setVessels(e.target.value)}
                    className="mt-2"
                    placeholder="Digite os nomes das embarcações, uma por linha"
                    required
                  />
                </div>

                <Button type="submit">
                  Cadastrar Empresa
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="project" className="space-y-6">
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
                      <Input id="vesselName" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="startDate">Data de Início</Label>
                      <Input id="startDate" type="date" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="projectType">Tipo de Projeto</Label>
                      <Input id="projectType" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="engineer">Responsável</Label>
                      <Input id="engineer" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="captain">Comandante</Label>
                      <Input id="captain" className="mt-1" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="border rounded-lg p-6">
              <UserManagement />
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6">Configuração do Sistema</h2>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="logoLight">Logo (Modo Claro)</Label>
                  <Input
                    id="logoLight"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload('light')}
                    className="mt-2"
                  />
                  <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-white mt-2">
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

                <div>
                  <Label htmlFor="logoDark">Logo (Modo Escuro)</Label>
                  <Input
                    id="logoDark"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload('dark')}
                    className="mt-2"
                  />
                  <div className="h-32 w-full border rounded-lg flex items-center justify-center bg-zinc-900 mt-2">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectSettings;