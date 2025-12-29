import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FolderKanban, FileText, Building2 } from "lucide-react";
import { MyWorkers } from "@/components/company-portal/MyWorkers";
import { MyProjects } from "@/components/company-portal/MyProjects";
import { CompanyReports } from "@/components/company-portal/CompanyReports";
import { CompanyProfile } from "@/components/company-portal/CompanyProfile";
import { CompanyRegistrationForm } from "@/components/company-portal/CompanyRegistrationForm";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const CompanyPortal = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showRegistration, setShowRegistration] = useState(false);

  // Check if user has a company associated
  const { data: userCompany, isLoading: companyLoading } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('user_companies')
        .select('company_id, companies(*)')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.companies || null;
    },
    enabled: !!user
  });

  if (loading || companyLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-semibold">Acesso Necessário</h2>
              <p className="text-muted-foreground">
                Você precisa estar logado para acessar o portal da empresa.
              </p>
              <Button onClick={() => navigate('/login')}>
                Fazer Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show registration form if user doesn't have a company
  if (!userCompany || showRegistration) {
    return <CompanyRegistrationForm onSuccess={() => setShowRegistration(false)} />;
  }

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
          <MyWorkers />
        </TabsContent>

        <TabsContent value="projects">
          <MyProjects />
        </TabsContent>

        <TabsContent value="reports">
          <CompanyReports />
        </TabsContent>

        <TabsContent value="company">
          <CompanyProfile />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompanyPortal;
