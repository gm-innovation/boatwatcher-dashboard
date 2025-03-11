import { useState } from "react";
import { Search } from "lucide-react";
import { format } from 'date-fns';
import { useEventsWithFallback } from '@/hooks/useEventsWithFallback';

interface AccessEvent {
  tipo: string;
  data: string;
  nomePessoa: string;
  cargoPessoa: string;
  vinculoColaborador: {
    empresa: string;
  };
  alvo: {
    _id: string;
    nome: string;
  };
}

interface WorkersListProps {
  className?: string;
  projectId?: string;
}

export const WorkersList = ({ className = "", projectId }: WorkersListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: inmetaEvents = [], isLoading: isLoadingInmeta } = useEventsWithFallback(projectId);

  // Adicionar logs para depuração
  console.log('WorkersList - Raw events:', inmetaEvents);

  const workers = inmetaEvents.map((event: AccessEvent) => {
    // Extract company name with better handling of different data structures
    let companyName = '';
    
    if (typeof event.vinculoColaborador === 'object' && event.vinculoColaborador !== null) {
      // Log para depuração
      console.log('Event vinculoColaborador:', event.vinculoColaborador);
      
      if ('empresa' in event.vinculoColaborador && event.vinculoColaborador.empresa) {
        companyName = event.vinculoColaborador.empresa;
      } else if ('nome' in event.vinculoColaborador && event.vinculoColaborador.nome) {
        companyName = event.vinculoColaborador.nome;
      } else {
        const entries = Object.entries(event.vinculoColaborador);
        const possibleCompanyProps = entries
          .find(([key, value]) => 
            typeof value === 'string' && 
            value.length > 0 && 
            key !== 'id' && 
            String(value) !== 'null' && 
            String(value) !== 'undefined' && 
            String(value) !== 'Empresa não informada'
          );
        
        if (possibleCompanyProps) {
          companyName = String(possibleCompanyProps[1]);
        }
      }
    } else if (typeof event.vinculoColaborador === 'string' && 
               event.vinculoColaborador !== 'null' && 
               event.vinculoColaborador !== 'undefined' && 
               event.vinculoColaborador !== 'Empresa não informada') {
      companyName = event.vinculoColaborador;
    }
    
    // Filter out invalid company names and convert to empty string
    if (companyName === 'Empresa não informada' || companyName === 'null' || companyName === 'undefined') {
      companyName = '';
    }

    // Log para depuração
    console.log('Extracted company name:', {
      worker: event.nomePessoa,
      companyName,
      originalVinculo: event.vinculoColaborador
    });

    return {
      id: event.alvo._id + event.data + event.nomePessoa,
      name: event.nomePessoa,
      role: event.cargoPessoa,
      company: companyName,
      entryTime: event.data ? new Date(event.data) : new Date(),
      location: event.alvo.nome
    };
  });

  const filteredWorkers = workers.filter(worker =>
    (worker.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (worker.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (worker.role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoadingInmeta) {
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

      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nome</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Função</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Empresa</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">
                    {projectId ? 'Nenhum trabalhador encontrado neste projeto' : 'Selecione um projeto para ver os trabalhadores'}
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(worker => (
                  <tr 
                    key={worker.id} 
                    className={`border-b border-border hover:bg-muted/50 ${
                      worker.entryTime ? format(worker.entryTime, 'HH:mm') === '00:00' ? 'bg-yellow-50 dark:bg-yellow-900/20' : '' : ''
                     }`}
                  >
                    <td className="py-4 px-4 text-sm text-foreground">{worker.name}</td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">{worker.role}</td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">{worker.company || '-'}</td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">
                      {worker.entryTime ? format(worker.entryTime, 'HH:mm') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
