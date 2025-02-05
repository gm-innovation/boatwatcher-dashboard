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
import { useCompanies } from "@/hooks/useSupabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

const ProjectSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: authLoading } = useAuth('admin');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { data: companies = [] } = useCompanies();

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

  const handleClientLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedClientId) {
      toast({
        title: "Erro",
        description: "Selecione um cliente primeiro",
        variant: "destructive",
      });
      return;
    }

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${selectedClientId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(filePath, file, { upsert: true });

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
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', selectedClientId);

      if (updateError) {
        toast({
          title: "Erro ao atualizar logo do cliente",
          description: updateError.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Logo atualizada",
        description: "A logo do cliente foi atualizada com sucesso.",
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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Configuração do Projeto */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Configuração do Projeto</h2>
            <div className="space-y-6">
              <div>
                <Label>Cliente</Label>
                <Select value={selectedClientId || undefined} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
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

              {selectedClientId && (
                <div>
                  <Label>Logo do Cliente</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleClientLogoUpload}
                    className="mt-2"
                  />
                </div>
              )}

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

          {/* Cadastro de Usuários */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Cadastro de Usuários</h2>
            <UserManagement />
          </div>

          {/* Configuração do Sistema */}
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
        </div>
      </div>
    </div>
  );
};

export default ProjectSettings;