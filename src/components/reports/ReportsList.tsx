import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/hooks/useSupabase';
import { format } from 'date-fns';
import { FileText, Download, Search } from 'lucide-react';

export const ReportsList = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('1month');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const { data: projects = [] } = useProjects();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h1 className="text-2xl font-semibold">Relatório de Acessos</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button className="gap-2">
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
            className="px-4 py-2 border rounded-md"
          />
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2 border rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <ScrollArea className="h-[600px]">
          <div className="p-6 text-center text-muted-foreground">
            {selectedProject ? 'Nenhum registro encontrado' : 'Selecione um projeto para ver os registros'}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
