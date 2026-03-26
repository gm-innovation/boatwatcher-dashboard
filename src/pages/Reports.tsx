import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportsList } from "@/components/reports/ReportsList";
import { PresenceReport } from "@/components/reports/PresenceReport";
import { CompanyReport } from "@/components/reports/CompanyReport";
import { OvernightControl } from "@/components/reports/OvernightControl";
import { WorkerTimeReport } from "@/components/reports/WorkerTimeReport";
import { Users, Building2, FileText, Clock, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useProjects } from "@/hooks/useSupabase";
import { format } from "date-fns";

const Reports = () => {
  const { data: projects = [] } = useProjects();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios de Acesso</h1>
        <p className="text-muted-foreground">Visualize e exporte relatórios do sistema</p>
      </div>

      {/* Global Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-card rounded-lg border">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Projeto *</label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Data Início</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Data Fim</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <Button className="gap-2">
          Buscar Dados
        </Button>
      </div>

      <Tabs defaultValue="workers" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="workers" className="gap-2">
            <Users className="h-4 w-4" />
            Trabalhadores
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <FileText className="h-4 w-4" />
            Todos Trabalhadores
          </TabsTrigger>
          <TabsTrigger value="presence" className="gap-2">
            <Clock className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="overnight" className="gap-2">
            <Moon className="h-4 w-4" />
            Controle de Pernoite
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workers">
          <WorkerTimeReport projectId={selectedProject} startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="companies">
          <CompanyReport projectId={selectedProject} startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="access">
          <ReportsList projectId={selectedProject} startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="presence">
          <PresenceReport projectId={selectedProject} startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="overnight">
          <OvernightControl projectId={selectedProject} startDate={startDate} endDate={endDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
