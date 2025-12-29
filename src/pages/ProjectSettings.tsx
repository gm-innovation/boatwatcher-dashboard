import { Button } from "@/components/ui/button";
import { Building2, Settings, Users2, Briefcase, Server, UserCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserManagement from "@/components/UserManagement";
import { CompanyForm } from "@/components/settings/CompanyForm";
import { ProjectForm } from "@/components/settings/ProjectForm";
import { SystemSettings } from "@/components/settings/SystemSettings";
import { DeviceManagement } from "@/components/devices/DeviceManagement";
import { WorkerManagement } from "@/components/workers/WorkerManagement";

const ProjectSettings = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Tabs defaultValue="workers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="workers" className="space-x-2">
            <UserCheck className="h-4 w-4" />
            <span>Trabalhadores</span>
          </TabsTrigger>
          <TabsTrigger value="devices" className="space-x-2">
            <Server className="h-4 w-4" />
            <span>Dispositivos</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="space-x-2">
            <Building2 className="h-4 w-4" />
            <span>Empresas</span>
          </TabsTrigger>
          <TabsTrigger value="project" className="space-x-2">
            <Briefcase className="h-4 w-4" />
            <span>Projetos</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="space-x-2">
            <Users2 className="h-4 w-4" />
            <span>Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="space-x-2">
            <Settings className="h-4 w-4" />
            <span>Sistema</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workers">
          <div className="border rounded-lg p-6">
            <WorkerManagement />
          </div>
        </TabsContent>

        <TabsContent value="devices">
          <div className="border rounded-lg p-6">
            <DeviceManagement />
          </div>
        </TabsContent>

        <TabsContent value="company">
          <CompanyForm />
        </TabsContent>

        <TabsContent value="project">
          <ProjectForm />
        </TabsContent>

        <TabsContent value="users">
          <div className="border rounded-lg p-6">
            <UserManagement />
          </div>
        </TabsContent>

        <TabsContent value="system">
          <SystemSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectSettings;
