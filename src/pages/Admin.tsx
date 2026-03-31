import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceManagement } from "@/components/devices/DeviceManagement";
import UserManagement from "@/components/UserManagement";
import { GlobalSettings } from "@/components/admin/GlobalSettings";
import { AuditLog } from "@/components/admin/AuditLog";
import { ClientsManagement } from "@/components/admin/ClientsManagement";
import { ProjectsManagement } from "@/components/admin/ProjectsManagement";
import { DiagnosticsPanel } from "@/components/admin/DiagnosticsPanel";
import { ConnectivityDashboard } from "@/components/devices/ConnectivityDashboard";
import { Server, FolderKanban, Shield, Cog, Activity, Building2, Stethoscope, Wifi, MonitorDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { usesLocalServer } from "@/lib/runtimeProfile";
import { isElectron } from "@/lib/dataProvider";
import { DesktopUpdater } from "@/components/desktop/DesktopUpdater";

type AdminTab = {
  value: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
};

const Admin = () => {
  const location = useLocation();
  const isLocalRuntime = usesLocalServer();
  const isDesktop = isElectron();

  const tabs: AdminTab[] = [
    { value: 'clients', label: 'Clientes', icon: Building2, content: <ClientsManagement /> },
    { value: 'projects', label: 'Projetos', icon: FolderKanban, content: <ProjectsManagement /> },
    { value: 'devices', label: 'Dispositivos', icon: Server, content: <DeviceManagement /> },
    { value: 'users', label: 'Usuários', icon: Shield, content: <UserManagement /> },
    { value: 'connectivity', label: 'Monitoramento', icon: Wifi, content: <ConnectivityDashboard /> },
    { value: 'diagnostics', label: 'Diagnóstico', icon: Stethoscope, content: <DiagnosticsPanel /> },
    { value: 'audit', label: 'Auditoria', icon: Activity, content: <AuditLog /> },
    { value: 'settings', label: 'Configurações', icon: Cog, content: <GlobalSettings /> },
    ...(isDesktop ? [{ value: 'desktop-update', label: 'Atualização', icon: MonitorDown, content: <DesktopUpdater /> } as AdminTab] : []),
  ];

  const getDefaultTab = () => {
    const match = tabs.find((tab) => location.pathname.includes(`/${tab.value}`));
    return match?.value || tabs[0].value;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isLocalRuntime ? 'Administração Desktop' : 'Área Administrativa'}</h1>
        <p className="text-muted-foreground">
          {isLocalRuntime
            ? 'Operação local com acesso às abas administrativas e integração em nuvem quando houver conta conectada.'
            : 'Configurações do sistema e gerenciamento avançado.'}
        </p>
      </div>

      <Tabs defaultValue={getDefaultTab()} className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Admin;
