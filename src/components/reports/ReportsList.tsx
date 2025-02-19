
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useInmetaEvents } from '@/hooks/useInmetaApi';
import { useProjects } from '@/hooks/useSupabase';
import { format, differenceInMinutes } from 'date-fns';
import { FileText, Download, Filter, Search, Calendar } from 'lucide-react';

interface CompanyGroup {
  name: string;
  workers: any[];
  firstEntry: Date;
  lastExit: Date;
  duration: number;
}

export const ReportsList = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('1month');
  const [searchTerm, setSearchTerm] = useState('');
  const { data: projects = [] } = useProjects();
  const selectedProjectData = projects.find(p => p.id === selectedProject);
  const { data: events = [], isLoading } = useInmetaEvents(selectedProjectData?.external_project_id, selectedPeriod);

  const filteredEvents = events.filter(event => 
    event.nomePessoa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.cargoPessoa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.vinculoColaborador?.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agrupar eventos por empresa
  const groupedByCompany = filteredEvents.reduce((acc: { [key: string]: any[] }, event) => {
    const companyName = event.vinculoColaborador?.empresa || 'Sem empresa';
    if (!acc[companyName]) {
      acc[companyName] = [];
    }
    acc[companyName].push(event);
    return acc;
  }, {});

  // Calcular métricas por empresa
  const companiesData: CompanyGroup[] = Object.entries(groupedByCompany).map(([companyName, companyEvents]) => {
    const sortedEvents = companyEvents.sort((a, b) => 
      new Date(a.data).getTime() - new Date(b.data).getTime()
    );
    
    const firstEntry = new Date(sortedEvents[0].data);
    const lastExit = new Date(sortedEvents[sortedEvents.length - 1].data);
    const duration = differenceInMinutes(lastExit, firstEntry);

    return {
      name: companyName,
      workers: companyEvents,
      firstEntry,
      lastExit,
      duration
    };
  });

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes}min`;
  };

  const handleExport = () => {
    // Implementar exportação para Excel/CSV
    console.log('Exportar relatório');
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h1 className="text-2xl font-semibold">Relatório de Acessos</h1>
        </div>
        <Button onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select value={selectedProject || ''} onValueChange={setSelectedProject}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.vessel_name || 'Sem nome'}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="1month">Último mês</SelectItem>
              <SelectItem value="all">Todo o projeto</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, cargo ou empresa..."
            className="w-full pl-10 pr-4 py-2 border rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Colunas
          </Button>
        </div>
      </div>

      {/* Tabela de Resultados */}
      <div className="bg-card rounded-lg border">
        <div className="border-b">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Cargo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Empresa</th>
              </tr>
            </thead>
          </table>
        </div>

        <ScrollArea className="h-[600px]">
          <table className="w-full">
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="text-center py-4">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  </td>
                </tr>
              ) : companiesData.length > 0 ? (
                companiesData.map((company) => (
                  <>
                    <tr key={company.name} className="bg-muted/30">
                      <td colSpan={3} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{company.name}</span>
                            <span className="ml-4 text-sm text-muted-foreground">
                              {company.workers.length} trabalhadores
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="mr-4">Primeiro acesso: {format(company.firstEntry, 'HH:mm')}</span>
                            <span className="mr-4">Último acesso: {format(company.lastExit, 'HH:mm')}</span>
                            <span>Permanência: {formatDuration(company.duration)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {company.workers.map((event) => (
                      <tr key={event.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{event.nomePessoa}</div>
                          <div className="text-sm text-muted-foreground">{format(new Date(event.data), 'HH:mm')}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{event.cargoPessoa}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{event.vinculoColaborador?.empresa || 'N/A'}</div>
                        </td>
                      </tr>
                    ))}
                  </>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-muted-foreground">
                    {selectedProject ? 'Nenhum registro encontrado' : 'Selecione um projeto para ver os registros'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </div>
  );
};
