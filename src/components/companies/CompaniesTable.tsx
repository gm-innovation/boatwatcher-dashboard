import { format } from 'date-fns';
import { Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CompaniesTableProps {
  companies: any[];
  onEditCompany: (company: any) => void;
}

export const CompaniesTable = ({ companies, onEditCompany }: CompaniesTableProps) => {
  return (
    <>
      <div className="px-6 border-b border-border">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-[200px] text-center py-3 text-sm font-medium text-muted-foreground">Empresa</th>
              <th className="w-[150px] text-center py-3 text-sm font-medium text-muted-foreground">Entrada</th>
              <th className="w-[150px] text-center py-3 text-sm font-medium text-muted-foreground">Equipe</th>
              <th className="w-[100px] text-center py-3 text-sm font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
        </table>
      </div>

      <ScrollArea className="flex-1 h-[400px]">
        <div className="px-6">
          <table className="w-full">
            <tbody>
              {companies.map((company) => (
                <tr 
                  key={company.id} 
                  className="border-b border-border hover:bg-muted/50 cursor-pointer" 
                  onClick={() => onEditCompany(company)}
                >
                  <td className="w-[200px] py-3 text-sm text-foreground text-center">{company.name}</td>
                  <td className="w-[150px] py-3 text-sm text-muted-foreground text-center">
                    {company.entry_time ? format(new Date(company.entry_time), 'HH:mm') : '-'}
                  </td>
                  <td className="w-[150px] py-3 text-sm text-muted-foreground text-center">
                    {company.workers_count || 0}
                  </td>
                  <td className="w-[100px] py-3 text-sm text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCompany(company);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </>
  );
};