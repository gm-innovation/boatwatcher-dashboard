import { useCompanies } from '@/hooks/useSupabase';
import { useEventsWithFallback } from '@/hooks/useEventsWithFallback';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

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

interface CompaniesListProps {
  projectId?: string;
  className?: string;
}

export const CompaniesList = ({ projectId, className = '' }: CompaniesListProps) => {
  const { data: companies = [] } = useCompanies();
  const { data: inmetaEvents } = useEventsWithFallback(projectId);

  console.log('CompaniesList - Raw inmetaEvents data:', inmetaEvents);
  
  const events = inmetaEvents || [];
  console.log('CompaniesList - Events count:', events.length);

  // Get unique companies and their data from Inmeta events
  const companiesData = events.reduce((acc: Record<string, any>, event: AccessEvent) => {
    console.log('Processing event:', {
      eventType: event.tipo,
      eventDate: event.data,
      rawVinculoColaborador: event.vinculoColaborador
    });
    
    // Ensure we're properly accessing the company name, handling different possible structures
    const company = typeof event.vinculoColaborador === 'object' && event.vinculoColaborador !== null
      ? event.vinculoColaborador.empresa
      : typeof event.vinculoColaborador === 'string'
        ? event.vinculoColaborador
        : '';
    
    console.log('Extracted company name:', {
      company,
      vinculoColaboradorType: typeof event.vinculoColaborador,
      hasEmpresaProperty: typeof event.vinculoColaborador === 'object' && event.vinculoColaborador !== null ? 'empresa' in event.vinculoColaborador : false
    });
    
    // Skip if company is null, undefined, or empty string
    if (!company || company.trim() === '') {
      console.log('Skipping event due to missing company name');
      return acc;
    }

    if (!acc[company]) {
      acc[company] = {
        name: company,
        entryTime: new Date(event.data || new Date()),
        workersCount: 1,
      };
      console.log(`Created new company entry: ${company}`);
    } else {
      // Update entry time if this event is earlier
      const eventTime = new Date(event.data || new Date());
      if (eventTime < acc[company].entryTime) {
        acc[company].entryTime = eventTime;
      }
      acc[company].workersCount++;
      console.log(`Updated existing company entry: ${company}, workers count: ${acc[company].workersCount}`);
    }
    return acc;
  }, {} as Record<string, { name: string; entryTime: Date; workersCount: number }>);

  console.log('CompaniesList - Processed companies data:', companiesData);

  // Convert to array and sort alphabetically by company name
  const companiesOnBoard = Object.values(companiesData).sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  console.log('CompaniesList - Final companies on board:', companiesOnBoard);

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
          {companiesOnBoard.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma empresa a bordo
            </div>
          ) : (
            <div className="space-y-4">
              {companiesOnBoard.map(company => (
                <div
                  key={company.name}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div>
                    <h3 className="font-medium text-foreground">{company.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {company.workersCount} {company.workersCount === 1 ? 'trabalhador' : 'trabalhadores'}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(company.entryTime, 'HH:mm')}
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
