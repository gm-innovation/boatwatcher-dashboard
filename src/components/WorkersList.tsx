import { Search } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkers } from '@/hooks/useSupabase';
import { useInmetaEvents } from '@/hooks/useInmetaApi';
import { format } from 'date-fns';

export const WorkersList = ({ className = "" }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: workers = [], isLoading: isLoadingWorkers } = useWorkers();
  const { data: inmetaEvents, isLoading: isLoadingInmeta } = useInmetaEvents();

  const events = inmetaEvents || [];

  // Combine workers from both sources
  const allWorkers = [
    ...workers,
    ...events.map(event => ({
      id: event.id || '',
      name: event.name || '',
      role: event.role || '',
      arrival_time: event.arrival_time || '',
      photo_url: event.photo_url || '',
      company: event.vinculoColaborador?.empresa || 'N/A',
    })),
  ];

  const filteredWorkers = allWorkers.filter(worker =>
    (worker.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (worker.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (worker.role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = isLoadingWorkers || isLoadingInmeta;

  if (isLoading) {
    return (
      <div className={`bg-card/80 backdrop-blur-sm rounded-lg border border-border p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card/80 backdrop-blur-sm rounded-lg border border-border flex flex-col ${className}`}>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Trabalhadores</h2>
            <span className="px-2 py-1 bg-muted rounded-md text-sm text-muted-foreground">
              {filteredWorkers.length}
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

      <ScrollArea className="flex-1">
        <div className="p-6">
          {filteredWorkers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhum trabalhador encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {filteredWorkers.map(worker => (
                <div
                  key={worker.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{worker.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {worker.company} • {worker.role}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {worker.arrival_time ? format(new Date(worker.arrival_time), 'HH:mm') : '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
