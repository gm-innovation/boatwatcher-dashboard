import { Search } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkers } from '@/hooks/useSupabase';

interface WorkersListProps {
  className?: string;
  projectId: string | null;
}

export const WorkersList = ({ className = "", projectId }: WorkersListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: workers = [], isLoading } = useWorkers();

  const filteredWorkers = workers.filter(worker =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`bg-card/80 backdrop-blur-sm rounded-lg border border-border flex flex-col ${className}`}>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Trabalhadores</h2>
            <span className="px-2 py-1 bg-muted rounded-md text-sm text-muted-foreground">
              {workers.length}
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
              <th className="w-[150px] text-center py-3 text-sm font-medium text-muted-foreground">Status</th>
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
          ) : (
            <table className="w-full">
              <tbody>
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="border-b border-border hover:bg-muted/50">
                    <td className="w-[200px] py-3 text-sm text-foreground text-center">{worker.name}</td>
                    <td className="w-[200px] py-3 text-sm text-muted-foreground text-center">{worker.company || 'N/A'}</td>
                    <td className="w-[200px] py-3 text-sm text-muted-foreground text-center">{worker.role || 'N/A'}</td>
                    <td className="w-[150px] py-3 text-sm text-muted-foreground text-center">{worker.status || 'Ativo'}</td>
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
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
