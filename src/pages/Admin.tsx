import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceManagement } from "@/components/devices/DeviceManagement";
import { UserManagement } from "@/components/UserManagement";
import { Server, FolderKanban, Shield, Cog, Activity } from "lucide-react";
import { useLocation } from "react-router-dom";

const Admin = () => {
  const location = useLocation();
  
  const getDefaultTab = () => {
    if (location.pathname.includes('/projects')) return 'projects';
    if (location.pathname.includes('/users')) return 'users';
    if (location.pathname.includes('/settings')) return 'settings';
    if (location.pathname.includes('/audit')) return 'audit';
    return 'devices';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administração</h1>
        <p className="text-muted-foreground">Configurações do sistema e gerenciamento avançado</p>
      </div>

      <Tabs defaultValue={getDefaultTab()} className="space-y-6">
        <TabsList>
          <TabsTrigger value="devices" className="gap-2">
            <Server className="h-4 w-4" />
            Dispositivos
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            Projetos
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Shield className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Cog className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <DeviceManagement />
        </TabsContent>

        <TabsContent value="projects">
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Gestão de Projetos</p>
            <p className="text-sm">Em desenvolvimento</p>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="settings">
          <div className="text-center py-12 text-muted-foreground">
            <Cog className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Configurações do Sistema</p>
            <p className="text-sm">Em desenvolvimento</p>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Logs de Auditoria</p>
            <p className="text-sm">Em desenvolvimento</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
