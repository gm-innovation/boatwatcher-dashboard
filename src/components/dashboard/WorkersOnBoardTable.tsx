import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
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
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base">Trabalhadores</h3>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-semibold">
            {workers.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 py-2 px-3 text-xs whitespace-nowrap">Nº</TableHead>
              <TableHead className="py-2 px-3 text-xs whitespace-nowrap">Nome</TableHead>
              {!isMobile && <TableHead className="py-2 px-3 text-xs whitespace-nowrap">Local</TableHead>}
              {!isMobile && <TableHead className="py-2 px-3 text-xs whitespace-nowrap">Função</TableHead>}
              <TableHead className="py-2 px-3 text-xs whitespace-nowrap">Empresa</TableHead>
              <TableHead className="text-right py-2 px-3 text-xs whitespace-nowrap">Entrada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.length > 0 ? (
              workers.map((worker, index) => (
              <TableRow key={worker.id} className="hover:bg-gray-50 dark:hover:bg-muted/50">
                  <TableCell className="font-medium py-2 px-3 text-sm whitespace-nowrap">{index + 1}</TableCell>
                  <TableCell className="font-medium py-2 px-3 text-sm whitespace-nowrap">{worker.name}</TableCell>
                  {!isMobile && (
                    <TableCell className="py-2 px-3 text-sm whitespace-nowrap">
                      {worker.location ? (
                        <span className="inline-flex items-center bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                          {worker.location}
                        </span>
                      ) : '-'}
                    </TableCell>
                  )}
                  {!isMobile && <TableCell className="py-2 px-3 text-sm whitespace-nowrap">{worker.role || '-'}</TableCell>}
                  <TableCell className="py-2 px-3 text-sm whitespace-nowrap">{worker.company}</TableCell>
                  <TableCell className="text-right py-2 px-3 text-sm whitespace-nowrap">
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
  );
};
