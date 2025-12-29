import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FolderKanban, FileText, Building2 } from "lucide-react";

const CompanyPortal = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portal da Empresa</h1>
        <p className="text-muted-foreground">Gerencie seus trabalhadores e acompanhe projetos</p>
      </div>

      <Tabs defaultValue="workers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="workers" className="gap-2">
            <Users className="h-4 w-4" />
            Meus Trabalhadores
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            Meus Projetos
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileText className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            Dados da Empresa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workers">
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Gestão de Trabalhadores da Empresa</p>
            <p className="text-sm">Em desenvolvimento</p>
          </div>
        </TabsContent>

        <TabsContent value="projects">
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Projetos Associados</p>
            <p className="text-sm">Em desenvolvimento</p>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Relatórios da Empresa</p>
            <p className="text-sm">Em desenvolvimento</p>
          </div>
        </TabsContent>

        <TabsContent value="company">
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Informações da Empresa</p>
            <p className="text-sm">Em desenvolvimento</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompanyPortal;
