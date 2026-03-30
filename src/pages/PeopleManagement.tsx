import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkerManagement } from "@/components/workers/WorkerManagement";
import { CompanyManagement } from "@/components/people/CompanyManagement";
import { JobFunctionManagement } from "@/components/people/JobFunctionManagement";
import { PendingRegistrations } from "@/components/people/PendingRegistrations";
import UserManagement from "@/components/UserManagement";
import { DocumentExpirationCheck } from "@/components/admin/DocumentExpirationCheck";
import { Users, Building2, Briefcase, UserPlus, UserCog, FileWarning } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PeopleManagement = () => {
  const location = useLocation();
  
  const getDefaultTab = () => {
    if (location.pathname.includes('/companies')) return 'companies';
    if (location.pathname.includes('/job-functions')) return 'job-functions';
    if (location.pathname.includes('/pending')) return 'pending';
    if (location.pathname.includes('/users')) return 'users';
    return 'workers';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Pessoas e Documentos</h1>
          <p className="text-muted-foreground">Centro administrativo para gerenciamento de trabalhadores, empresas e documentação.</p>
        </div>
        <Button variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Testar Cadastro de Usuário
        </Button>
      </div>

      <Tabs defaultValue={getDefaultTab()} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Cadastros Pendentes
          </TabsTrigger>
          <TabsTrigger value="workers" className="gap-2">
            <Users className="h-4 w-4" />
            Trabalhadores
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <UserCog className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="job-functions" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Requisitos por Cargo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingRegistrations />
        </TabsContent>

        <TabsContent value="workers">
          <WorkerManagement />
        </TabsContent>

        <TabsContent value="companies">
          <CompanyManagement />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="job-functions">
          <JobFunctionManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PeopleManagement;
