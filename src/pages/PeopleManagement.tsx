import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkerManagement } from "@/components/workers/WorkerManagement";
import { CompaniesList } from "@/components/CompaniesList";
import { Users, Building2, Briefcase } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const PeopleManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
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
          <CompaniesList />
        </TabsContent>

        <TabsContent value="job-functions">
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Gestão de Cargos e Requisitos</p>
            <p className="text-sm">Em desenvolvimento</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PeopleManagement;
