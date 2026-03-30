import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface CompanyOnBoard {
  id: string;
  name: string;
  workersCount: number;
  entryTime?: string;
}

interface CompaniesOnBoardListProps {
  companies: CompanyOnBoard[];
}

export const CompaniesOnBoardList = ({ companies }: CompaniesOnBoardListProps) => {
  return (
    <div className="bg-white dark:bg-card rounded-xl border shadow-sm h-full flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-xl">Empresas a Bordo</h3>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-semibold">
            {companies.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-center">Equipe</TableHead>
              <TableHead className="text-right">Entrada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length > 0 ? (
              companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="text-center">{company.workersCount}</TableCell>
                  <TableCell className="text-right">
                    {company.entryTime ? (
                      <Badge variant="outline" className="text-primary border-primary">
                        {format(new Date(company.entryTime), 'HH:mm')}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Nenhuma empresa no momento
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
