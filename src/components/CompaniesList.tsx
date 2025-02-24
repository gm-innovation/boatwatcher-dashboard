import { useCompanies } from '@/hooks/useSupabase';
import { useInmetaEvents } from '@/hooks/useInmetaApi';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

export const CompaniesList = () => {
  const { data: companies = [] } = useCompanies();
  const { data: inmetaEvents } = useInmetaEvents();

  const events = inmetaEvents || [];

  // Get unique companies and their data from Inmeta events
  const companiesData = events.reduce((acc, event) => {
    const company = event.vinculoColaborador?.empresa;
    if (!company) return acc;

    if (!acc[company]) {
      acc[company] = {
        name: company,
        entryTime: new Date(event.arrival_time || new Date()),
        workersCount: 1,
      };
    } else {
      // Update entry time if this event is earlier
      const eventTime = new Date(event.arrival_time || new Date());
      if (eventTime < acc[company].entryTime) {
        acc[company].entryTime = eventTime;
      }
      acc[company].workersCount++;
    }
    return acc;
  }, {} as Record<string, { name: string; entryTime: Date; workersCount: number }>);

  // Convert to array and sort alphabetically by company name
  const companiesOnBoard = Object.values(companiesData).sort((a, b) => 
    a.name.localeCompare(b.name)
  );

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
