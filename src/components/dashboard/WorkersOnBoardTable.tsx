import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface WorkerOnBoard {
  id: string;
  name: string;
  location: string | null;
  role: string | null;
  company: string;
  entryTime: string;
}

interface WorkersOnBoardTableProps {
  workers: WorkerOnBoard[];
}

export const WorkersOnBoardTable = ({ workers }: WorkersOnBoardTableProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="bg-white dark:bg-card rounded-xl border shadow-sm h-full flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-xl">Trabalhadores</h3>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-semibold">
            {workers.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Nº</TableHead>
                <TableHead>Nome</TableHead>
                {!isMobile && <TableHead>Local</TableHead>}
                {!isMobile && <TableHead>Função</TableHead>}
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.length > 0 ? (
                workers.map((worker, index) => (
                <TableRow key={worker.id} className="hover:bg-gray-50 dark:hover:bg-muted/50">
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">{worker.name}</TableCell>
                    {!isMobile && (
                      <TableCell>
                        {worker.location ? (
                          <span className="inline-flex items-center bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                            {worker.location}
                          </span>
                        ) : '-'}
                      </TableCell>
                    )}
                    {!isMobile && <TableCell>{worker.role || '-'}</TableCell>}
                    <TableCell>{worker.company}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-md font-semibold">
                        {format(new Date(worker.entryTime), 'dd/MM HH:mm')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isMobile ? 4 : 6} className="text-center py-8 text-muted-foreground">
                    Nenhum trabalhador a bordo
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
