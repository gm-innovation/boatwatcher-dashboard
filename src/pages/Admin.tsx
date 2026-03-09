import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceManagement } from "@/components/devices/DeviceManagement";
import UserManagement from "@/components/UserManagement";
import { GlobalSettings } from "@/components/admin/GlobalSettings";
import { AuditLog } from "@/components/admin/AuditLog";
import { ClientsManagement } from "@/components/admin/ClientsManagement";
import { ProjectsManagement } from "@/components/admin/ProjectsManagement";
import { ReportScheduler } from "@/components/reports/ReportScheduler";
import { DiagnosticsPanel } from "@/components/admin/DiagnosticsPanel";
import { PendingRegistrations } from "@/components/people/PendingRegistrations";
import { DocumentExpirationCheck } from "@/components/admin/DocumentExpirationCheck";
import { AgentManagement } from "@/components/devices/AgentManagement";
import { ConnectivityDashboard } from "@/components/devices/ConnectivityDashboard";
import { Server, FolderKanban, Shield, Cog, Activity, Building2, Calendar, Stethoscope, UserCheck, FileWarning, Bot, Wifi } from "lucide-react";
import { useLocation } from "react-router-dom";

const Admin = () => {
  const location = useLocation();
  
  const getDefaultTab = () => {
    if (location.pathname.includes('/projects')) return 'projects';
    if (location.pathname.includes('/clients')) return 'clients';
    if (location.pathname.includes('/users')) return 'users';
    if (location.pathname.includes('/settings')) return 'settings';
    if (location.pathname.includes('/audit')) return 'audit';
    if (location.pathname.includes('/schedules')) return 'schedules';
    if (location.pathname.includes('/diagnostics')) return 'diagnostics';
    if (location.pathname.includes('/pending')) return 'pending';
    if (location.pathname.includes('/documents')) return 'documents';
    return 'projects';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Área Administrativa</h1>
        <p className="text-muted-foreground">Configurações do sistema e gerenciamento avançado</p>
      </div>

      <Tabs defaultValue={getDefaultTab()} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Aprovações
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            Projetos
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2">
            <Building2 className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-2">
            <Calendar className="h-4 w-4" />
            Agendamentos
          </TabsTrigger>
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
          <TabsTrigger value="diagnostics" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileWarning className="h-4 w-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingRegistrations />
        </TabsContent>

        <TabsContent value="projects">
          <ProjectsManagement />
        </TabsContent>

        <TabsContent value="clients">
          <ClientsManagement />
        </TabsContent>

        <TabsContent value="schedules">
          <ReportScheduler />
        </TabsContent>

        <TabsContent value="devices">
          <DeviceManagement />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="settings">
          <GlobalSettings />
        </TabsContent>

        <TabsContent value="diagnostics">
          <DiagnosticsPanel />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentExpirationCheck />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
