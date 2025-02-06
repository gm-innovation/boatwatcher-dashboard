import { useCompanies } from '@/hooks/useSupabase';
import { useInmetaEvents } from '@/hooks/useInmetaApi';
import { ScrollArea } from '@/components/ui/scroll-area';

export const CompaniesList = () => {
  const { data: companies = [] } = useCompanies();
  const { data: inmetaEvents = [] } = useInmetaEvents();

  // Get unique companies from Inmeta events
  const inmetaCompanies = new Set(
    inmetaEvents
      .map(event => event.vinculoColaborador?.empresa)
      .filter(Boolean)
  );

  // Convert Set to array and sort alphabetically
  const companiesOnBoard = Array.from(inmetaCompanies).sort();

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
              </tr>
            </thead>
            <tbody>
              {companiesOnBoard.map((company, index) => (
                <tr key={index} className="border-b border-border hover:bg-muted/50">
                  <td className="py-3 text-sm text-foreground">{company}</td>
                </tr>
              ))}
              {companiesOnBoard.length === 0 && (
                <tr>
                  <td className="py-3 text-sm text-muted-foreground text-center">
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