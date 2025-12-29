import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceManagement } from "@/components/devices/DeviceManagement";
import UserManagement from "@/components/UserManagement";
import { GlobalSettings } from "@/components/admin/GlobalSettings";
import { AuditLog } from "@/components/admin/AuditLog";
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

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="settings">
          <GlobalSettings />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
