import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkerManagement } from "@/components/workers/WorkerManagement";
import { CompanyManagement } from "@/components/people/CompanyManagement";
import { JobFunctionManagement } from "@/components/people/JobFunctionManagement";
import { Users, Building2, Briefcase } from "lucide-react";
import { useLocation } from "react-router-dom";

const PeopleManagement = () => {
  const location = useLocation();
  
  const getDefaultTab = () => {
    if (location.pathname.includes('/companies')) return 'companies';
    if (location.pathname.includes('/job-functions')) return 'job-functions';
    return 'workers';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Pessoas</h1>
        <p className="text-muted-foreground">Gerencie trabalhadores, empresas e cargos</p>
      </div>

      <Tabs defaultValue={getDefaultTab()} className="space-y-6">
        <TabsList>
          <TabsTrigger value="workers" className="gap-2">
            <Users className="h-4 w-4" />
            Trabalhadores
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="job-functions" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Cargos e Requisitos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workers">
          <WorkerManagement />
        </TabsContent>

        <TabsContent value="companies">
          <CompanyManagement />
        </TabsContent>

        <TabsContent value="job-functions">
          <JobFunctionManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PeopleManagement;
