
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useInmetaEvents } from '@/hooks/useInmetaApi';
import { useProjects } from '@/hooks/useSupabase';
import { format } from 'date-fns';
import { FileText, Download, Filter, Search } from 'lucide-react';

export const ReportsList = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { data: projects = [] } = useProjects();
  const selectedProjectData = projects.find(p => p.id === selectedProject);
  const { data: events = [], isLoading } = useInmetaEvents(selectedProjectData?.external_project_id);

  const filteredEvents = events.filter(event => 
    event.nomePessoa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.cargoPessoa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.vinculoColaborador?.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Data | Evento</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Nome | Cargo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Vínculo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Projeto</th>
              </tr>
            </thead>
          </table>
        </div>

        <ScrollArea className="h-[600px]">
          <table className="w-full">
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-4">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredEvents.length > 0 ? (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b last:border-b-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{format(new Date(event.data), 'dd/MM/yyyy HH:mm:ss')}</div>
                      <div className="text-sm text-muted-foreground">{event.tipo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{event.nomePessoa}</div>
                      <div className="text-sm text-muted-foreground">{event.cargoPessoa}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{event.vinculoColaborador?.empresa || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{selectedProjectData?.vessel_name || 'N/A'}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted-foreground">
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
