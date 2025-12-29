import { useAccessLogs } from '@/hooks/useControlID';
import { useCompanies } from '@/hooks/useSupabase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfDay } from 'date-fns';

interface CompaniesListProps {
  projectId: string | null;
}

export const CompaniesList = ({ projectId }: CompaniesListProps) => {
  const { data: companies = [] } = useCompanies();
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const { data: accessLogs = [], isLoading } = useAccessLogs(projectId, today, today, 500);

  // Filtrar apenas acessos concedidos (entrada)
  const entryLogs = accessLogs.filter(log => 
    log.access_status === 'granted' && 
    (log.direction === 'entry' || log.direction === 'unknown')
  );

  // Agrupar por empresa (usando worker.company_id ou worker_name como fallback)
  const companiesData = entryLogs.reduce((acc, log) => {
    // Usar o nome do trabalhador como identificador temporário
    const workerName = log.worker_name || 'Desconhecido';
    const companyName = log.worker?.company_id 
      ? companies.find(c => c.id === log.worker?.company_id)?.name || 'Empresa não identificada'
      : 'Empresa não identificada';

    if (!acc[companyName]) {
      acc[companyName] = {
        name: companyName,
        entryTime: new Date(log.timestamp),
        workers: new Set([workerName])
      };
    } else {
      acc[companyName].workers.add(workerName);
      // Manter o horário de entrada mais antigo
      const logTime = new Date(log.timestamp);
      if (logTime < acc[companyName].entryTime) {
        acc[companyName].entryTime = logTime;
      }
    }
    return acc;
  }, {} as Record<string, { 
    name: string; 
    entryTime: Date; 
    workers: Set<string>;
  }>);

  // Converter para array e ordenar por nome da empresa
  const companiesOnBoard = Object.values(companiesData)
    .map(company => ({
      name: company.name,
      entryTime: company.entryTime,
      workersCount: company.workers.size
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Empresas a Bordo</h2>
            <span className="px-2 py-1 bg-muted rounded-md text-sm text-muted-foreground">
              {companiesOnBoard.length}
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : projectId ? (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Nome</th>
                  <th className="text-center py-3 text-sm font-medium text-muted-foreground">Entrada</th>
                  <th className="text-center py-3 text-sm font-medium text-muted-foreground">Equipe</th>
                </tr>
              </thead>
              <tbody>
                {companiesOnBoard.map((company, index) => (
                  <tr key={index} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 text-sm text-foreground">{company.name}</td>
                    <td className="py-3 text-sm text-muted-foreground text-center">
                      {format(company.entryTime, 'HH:mm')}
                    </td>
                    <td className="py-3 text-sm text-muted-foreground text-center">
                      {company.workersCount}
                    </td>
                  </tr>
                ))}
                {companiesOnBoard.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-3 text-sm text-muted-foreground text-center">
                      Nenhuma empresa a bordo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="py-3 text-sm text-muted-foreground text-center">
              Selecione um projeto para ver as empresas
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
