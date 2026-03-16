import type { ReactNode } from "react";
import { Building2, Settings, Users2, Briefcase, Server, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserManagement from "@/components/UserManagement";
import { CompanyForm } from "@/components/settings/CompanyForm";
import { ProjectForm } from "@/components/settings/ProjectForm";
import { SystemSettings } from "@/components/settings/SystemSettings";
import { DeviceManagement } from "@/components/devices/DeviceManagement";
import { WorkerManagement } from "@/components/workers/WorkerManagement";
import { usesLocalServer } from "@/lib/runtimeProfile";

type SettingsTab = {
  value: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
};

const ProjectSettings = () => {
  const isLocalRuntime = usesLocalServer();

  const tabs: SettingsTab[] = isLocalRuntime
    ? [
        { value: 'workers', label: 'Trabalhadores', icon: UserCheck, content: <div className="border rounded-lg p-6"><WorkerManagement /></div> },
        { value: 'devices', label: 'Dispositivos', icon: Server, content: <div className="border rounded-lg p-6"><DeviceManagement /></div> },
        { value: 'company', label: 'Empresas', icon: Building2, content: <CompanyForm /> },
        { value: 'project', label: 'Projetos', icon: Briefcase, content: <ProjectForm /> },
      ]
    : [
        { value: 'workers', label: 'Trabalhadores', icon: UserCheck, content: <div className="border rounded-lg p-6"><WorkerManagement /></div> },
        { value: 'devices', label: 'Dispositivos', icon: Server, content: <div className="border rounded-lg p-6"><DeviceManagement /></div> },
        { value: 'company', label: 'Empresas', icon: Building2, content: <CompanyForm /> },
        { value: 'project', label: 'Projetos', icon: Briefcase, content: <ProjectForm /> },
        { value: 'users', label: 'Usuários', icon: Users2, content: <div className="border rounded-lg p-6"><UserManagement /></div> },
        { value: 'system', label: 'Sistema', icon: Settings, content: <SystemSettings /> },
      ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isLocalRuntime ? 'Configuração Local' : 'Configurações do Projeto'}</h1>
        <p className="text-muted-foreground">
          {isLocalRuntime
            ? 'No desktop, exibimos apenas configurações operacionais suportadas localmente.'
            : 'Gerencie trabalhadores, dispositivos, empresas, projetos e parâmetros do sistema.'}
        </p>
      </div>

      <Tabs defaultValue="workers" className="space-y-6">
        <TabsList className={`grid w-full ${isLocalRuntime ? 'grid-cols-4' : 'grid-cols-6'}`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="space-x-2">
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
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

export default ProjectSettings;
