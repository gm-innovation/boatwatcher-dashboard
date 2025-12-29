import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportsList } from "@/components/reports/ReportsList";
import { PresenceReport } from "@/components/reports/PresenceReport";
import { ComplianceReport } from "@/components/reports/ComplianceReport";
import { ReportScheduler } from "@/components/reports/ReportScheduler";
import { FileText, Clock, FileCheck, Calendar } from "lucide-react";

const Reports = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Visualize e exporte relatórios do sistema</p>
      </div>

      <Tabs defaultValue="access" className="space-y-6">
        <TabsList>
          <TabsTrigger value="access" className="gap-2">
            <FileText className="h-4 w-4" />
            Acessos
          </TabsTrigger>
          <TabsTrigger value="presence" className="gap-2">
            <Clock className="h-4 w-4" />
            Presença
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Conformidade
          </TabsTrigger>
          <TabsTrigger value="scheduler" className="gap-2">
            <Calendar className="h-4 w-4" />
            Agendamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="access">
          <ReportsList />
        </TabsContent>

        <TabsContent value="presence">
          <PresenceReport />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceReport />
        </TabsContent>

        <TabsContent value="scheduler">
          <ReportScheduler />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
