
import { Search } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkers } from '@/hooks/useSupabase';
import { useInmetaEvents } from '@/hooks/useInmetaApi';
import { format } from 'date-fns';
import type { Worker } from '@/types/supabase';
import { useProjects } from '@/hooks/useSupabase';

interface WorkersListProps {
  className?: string;
  projectId: string | null;
}

export const WorkersList = ({ className = "", projectId }: WorkersListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: workers = [], isLoading: isLoadingWorkers } = useWorkers();
  const { data: projects = [] } = useProjects();
  const selectedProject = projects.find(p => p.id === projectId);
  const { data: inmetaEvents = [], isLoading: isLoadingInmeta } = useInmetaEvents(selectedProject?.external_project_id || null);

  // Combinar trabalhadores apenas quando houver um projeto selecionado
  const allWorkers = projectId ? [
    ...workers.filter(worker => worker.project_id === projectId || !worker.project_id),
    ...inmetaEvents.map(event => ({
      id: event.id,
      name: event.nomePessoa,
      role: event.cargoPessoa,
      arrival_time: event.data,
      photo_url: "",
      company: event.vinculoColaborador?.empresa || 'N/A',
      company_id: "",  // Campo obrigatório da interface Worker
      created_at: event.data, // Usando a data do evento como created_at
      project_id: projectId // Adicionando o project_id do projeto atual
    } as Worker)),
  ] : [];

  // Ordenar por horário de chegada
  const sortedWorkers = allWorkers.sort((a, b) => 
    new Date(b.arrival_time).getTime() - new Date(a.arrival_time).getTime()
  );

  const filteredWorkers = sortedWorkers.filter(worker =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = isLoadingWorkers || isLoadingInmeta;

  return (
    <div className={`bg-card/80 backdrop-blur-sm rounded-lg border border-border flex flex-col ${className}`}>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Trabalhadores</h2>
            <span className="px-2 py-1 bg-muted rounded-md text-sm text-muted-foreground">
              {allWorkers.length}
            </span>
          </div>
          <div className="relative">
            <Search className="h-5 w-5 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar..."
              className="pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="px-6 border-b border-border">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-[200px] text-center py-3 text-sm font-medium text-muted-foreground">Nome</th>
              <th className="w-[200px] text-center py-3 text-sm font-medium text-muted-foreground">Empresa</th>
              <th className="w-[200px] text-center py-3 text-sm font-medium text-muted-foreground">Função</th>
              <th className="w-[150px] text-center py-3 text-sm font-medium text-muted-foreground">Entrada</th>
            </tr>
          </thead>
        </table>
      </div>

      <ScrollArea className="flex-1 h-[400px]">
        <div className="px-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : projectId ? (
            <table className="w-full">
              <tbody>
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="border-b border-border hover:bg-muted/50">
                    <td className="w-[200px] py-3 text-sm text-foreground text-center">{worker.name}</td>
                    <td className="w-[200px] py-3 text-sm text-muted-foreground text-center">{worker.company}</td>
                    <td className="w-[200px] py-3 text-sm text-muted-foreground text-center">{worker.role}</td>
                    <td className="w-[150px] py-3 text-sm text-muted-foreground text-center">
                      {format(new Date(worker.arrival_time), 'HH:mm')}
                    </td>
                  </tr>
                ))}
                {filteredWorkers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-sm text-muted-foreground text-center">
                      Nenhum trabalhador encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="py-3 text-sm text-muted-foreground text-center">
              Selecione um projeto para ver os trabalhadores
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
