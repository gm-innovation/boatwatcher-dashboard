import { useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  onExport?: () => void;
}

export const WorkersOnBoardTable = ({ workers, onExport }: WorkersOnBoardTableProps) => {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  // Get unique locations for filter
  const locations = [...new Set(workers.map(w => w.location).filter(Boolean))] as string[];

  // Filter workers
  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter === 'all' || worker.location === locationFilter;
    return matchesSearch && matchesLocation;
  });

  return (
    <div className="bg-card rounded-lg border h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">Trabalhadores</h3>
            <Badge variant="secondary" className="rounded-full">
              {filteredWorkers.length}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Local" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os locais</SelectItem>
              {locations.map(location => (
                <SelectItem key={location} value={location}>
                  {location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Nº</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-right">Entrada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWorkers.length > 0 ? (
              filteredWorkers.map((worker, index) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell>{worker.location || '-'}</TableCell>
                  <TableCell>{worker.role || '-'}</TableCell>
                  <TableCell>{worker.company}</TableCell>
                  <TableCell className="text-right">
                    {format(new Date(worker.entryTime), 'HH:mm')}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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