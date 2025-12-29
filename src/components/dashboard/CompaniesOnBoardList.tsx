import { Building } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface CompanyOnBoard {
  id: string;
  name: string;
  workersCount: number;
}

interface CompaniesOnBoardListProps {
  companies: CompanyOnBoard[];
}

export const CompaniesOnBoardList = ({ companies }: CompaniesOnBoardListProps) => {
  return (
    <div className="bg-card rounded-lg border h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Empresas a Bordo</h3>
          <Badge variant="secondary" className="rounded-full">
            {companies.length}
          </Badge>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {companies.length > 0 ? (
            companies.map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <Building className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="font-medium">{company.name}</span>
                </div>
                <Badge variant="secondary">
                  {company.workersCount} {company.workersCount === 1 ? 'pessoa' : 'pessoas'}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma empresa no momento
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};