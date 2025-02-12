
import { useCompanies } from '@/hooks/useSupabase';
import { useInmetaEvents } from '@/hooks/useInmetaApi';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

export const CompaniesList = () => {
  const { data: companies = [] } = useCompanies();
  const { data: inmetaEvents = [] } = useInmetaEvents();

  // Primeiro, ordenar todos os eventos por data (do mais antigo para o mais recente)
  const sortedEvents = [...inmetaEvents].sort((a, b) => 
    new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  // Agrupar eventos por empresa
  const companiesData = sortedEvents.reduce((acc, event) => {
    const company = event.vinculoColaborador?.empresa;
    if (!company) return acc;

    if (!acc[company]) {
      // Se é a primeira vez que vemos esta empresa, este é o horário de entrada
      // pois os eventos estão ordenados do mais antigo para o mais recente
      acc[company] = {
        name: company,
        entryTime: new Date(event.data),
        workers: new Set([event.nomePessoa])
      };
    } else {
      // Apenas adicionar o trabalhador ao conjunto de trabalhadores únicos
      acc[company].workers.add(event.nomePessoa);
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
      ...company,
      workersCount: company.workers.size
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log('Dados finais das empresas:', companiesOnBoard.map(company => ({
    name: company.name,
    entryTime: format(company.entryTime, 'HH:mm'),
    workersCount: company.workersCount,
    workers: Array.from(company.workers)
  })));

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
        </div>
      </ScrollArea>
    </div>
  );
};
