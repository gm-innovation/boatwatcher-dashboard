import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjects } from '@/hooks/useSupabase';
import { useAccessLogs } from '@/hooks/useControlID';
import { format, subDays, subMonths, startOfDay } from 'date-fns';
import { FileText, Download, Search, CheckCircle, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { exportAccessLogsToPdf, exportAccessLogsToExcel } from '@/utils/exportReports';

function getDateRange(period: string, specificDate?: string) {
  const today = new Date();
  
  switch (period) {
    case 'today':
      return { startDate: format(startOfDay(today), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
    case 'yesterday':
      const yesterday = subDays(today, 1);
      return { startDate: format(startOfDay(yesterday), 'yyyy-MM-dd'), endDate: format(yesterday, 'yyyy-MM-dd') };
    case '7days':
      return { startDate: format(subDays(today, 7), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
    case '1month':
      return { startDate: format(subMonths(today, 1), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
    case 'specific':
      return { startDate: specificDate || format(today, 'yyyy-MM-dd'), endDate: specificDate || format(today, 'yyyy-MM-dd') };
    default:
      return { startDate: format(subMonths(today, 1), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
  }
}

export const ReportsList = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const { data: projects = [] } = useProjects();

  const { startDate, endDate } = getDateRange(selectedPeriod, selectedDate);
  const { data: accessLogs = [], isLoading } = useAccessLogs(selectedProject, startDate, endDate, 500);

  // Filtrar por termo de busca
  const filteredLogs = accessLogs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.worker_name?.toLowerCase().includes(search) ||
      log.worker_document?.toLowerCase().includes(search) ||
      log.device_name?.toLowerCase().includes(search) ||
      log.reason?.toLowerCase().includes(search)
    );
  });

  const handleExportPdf = () => {
    const projectName = projects.find(p => p.id === selectedProject)?.name || 'Todos os projetos';
    exportAccessLogsToPdf(filteredLogs, projectName, startDate, endDate);
  };

  const handleExportExcel = () => {
    const projectName = projects.find(p => p.id === selectedProject)?.name || 'Todos os projetos';
    exportAccessLogsToExcel(filteredLogs, projectName, startDate, endDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h1 className="text-2xl font-semibold">Relatório de Acessos</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button className="gap-2" onClick={handleExportPdf}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select value={selectedProject || ''} onValueChange={setSelectedProject}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name || 'Sem nome'}
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
              <SelectItem value="specific">Dia específico</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="1month">Último mês</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {selectedPeriod === 'specific' && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background"
          />
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF, dispositivo..."
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <ScrollArea className="h-[600px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredLogs.length > 0 ? (
            <table className="w-full">
              <thead className="sticky top-0 bg-card border-b">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data/Hora</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Trabalhador</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">CPF</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Dispositivo</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Direção</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-4 text-sm text-foreground">
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                    <td className="p-4 text-sm text-foreground">
                      {log.worker_name || 'Não identificado'}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {log.worker_document || '-'}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {log.device_name || '-'}
                    </td>
                    <td className="p-4 text-center">
                      {log.direction === 'entry' ? (
                        <ArrowRight className="h-4 w-4 text-green-500 inline" />
                      ) : log.direction === 'exit' ? (
                        <ArrowLeft className="h-4 w-4 text-orange-500 inline" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {log.access_status === 'granted' ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Liberado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                          <XCircle className="h-3 w-3 mr-1" />
                          Negado
                        </Badge>
                      )}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {log.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              {selectedProject ? 'Nenhum registro encontrado' : 'Selecione um projeto para ver os registros'}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
