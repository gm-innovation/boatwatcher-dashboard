
import { Button } from "@/components/ui/button";
import { Building2, Settings, Users2, Briefcase } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserManagement from "@/components/UserManagement";
import { CompanyForm } from "@/components/settings/CompanyForm";
import { ProjectForm } from "@/components/settings/ProjectForm";
import { SystemSettings } from "@/components/settings/SystemSettings";

const ProjectSettings = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
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
