import { useMemo } from 'react';
import { useAccessLogs } from '@/hooks/useControlID';
import { useQuery } from '@tanstack/react-query';
import { isElectron } from '@/lib/dataProvider';
import { fetchWorkers } from '@/hooks/useDataProvider';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { exportReportPdf } from '@/utils/exportReportPdf';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Download, Moon, User, Clock, Building2 } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';

interface OvernightControlProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

interface OvernightWorker {
  id: string;
  name: string;
  company: string;
  entryTime: string;
  nights: number;
  photoUrl?: string;
}

export const OvernightControl = ({ projectId, startDate, endDate }: OvernightControlProps) => {
  const { data: accessLogs = [], isLoading } = useAccessLogs(projectId, startDate, endDate, 1000);

  const { data: workers = [] } = useQuery({
    queryKey: ['workers-with-companies'],
    queryFn: async () => {
      if (isElectron()) {
        return fetchWorkers();
      }
      const { data, error } = await supabase
        .from('workers')
        .select('id, name, photo_url, company:companies(name)')
        .eq('status', 'active');
      if (error) throw error;
      return data;
    },
  });

  const overnightWorkers = useMemo<OvernightWorker[]>(() => {
    if (!accessLogs.length) return [];

    // Build hybrid lookup
    const workerById = new Map(workers.map((w: any) => [w.id, w]));
    const workerByName = new Map(workers.map((w: any) => [w.name?.toLowerCase().trim(), w]));

    const findWorker = (log: any) => {
      if (log.worker_id && workerById.has(log.worker_id)) return workerById.get(log.worker_id)!;
      if (log.worker_name) return workerByName.get(log.worker_name.toLowerCase().trim()) || null;
      return null;
    };

    // Group logs by resolved worker key
    const workerLogs = new Map<string, typeof accessLogs>();
    for (const log of accessLogs) {
      const w = findWorker(log);
      const key = w?.id || log.worker_id || log.worker_name || '';
      if (!key) continue;
      if (!workerLogs.has(key)) workerLogs.set(key, []);
      workerLogs.get(key)!.push(log);
    }

    const result: OvernightWorker[] = [];

    workerLogs.forEach((logs, workerId) => {
      // Sort by timestamp desc
      const sorted = [...logs].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Find last entry without a subsequent exit
      const lastEntry = sorted.find(l => l.direction === 'entry');
      const lastExit = sorted.find(l => l.direction === 'exit');

      const isOnBoard = lastEntry && (!lastExit || new Date(lastEntry.timestamp) > new Date(lastExit.timestamp));

      if (isOnBoard && lastEntry) {
        const entryDate = parseISO(lastEntry.timestamp);
        const nights = differenceInCalendarDays(new Date(), entryDate);

        const worker = workers.find(w => w.id === workerId);
        const companyName = worker?.company && typeof worker.company === 'object' && 'name' in worker.company
          ? (worker.company as { name: string }).name
          : 'Desconhecida';

        result.push({
          id: workerId,
          name: worker?.name || lastEntry.worker_name || 'Desconhecido',
          company: companyName,
          entryTime: format(entryDate, 'HH:mm'),
          nights: Math.max(nights, 0),
          photoUrl: worker?.photo_url || undefined,
        });
      }
    });

    return result.sort((a, b) => b.nights - a.nights);
  }, [accessLogs, workers]);

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Moon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Selecione um projeto para ver o controle de pernoite</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <Moon className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pernoitando Hoje</p>
                <p className="text-3xl font-bold">{overnightWorkers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Empresas</p>
                <p className="text-3xl font-bold">
                  {new Set(overnightWorkers.map(w => w.company)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Noites (Período)</p>
                <p className="text-3xl font-bold">
                  {overnightWorkers.reduce((sum, w) => sum + w.nights, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" className="gap-2" onClick={() => {
          const csvContent = [
            ['Trabalhador', 'Empresa', 'Entrada', 'Noites'].join(','),
            ...overnightWorkers.map(w => [w.name, w.company, w.entryTime, w.nights].join(','))
          ].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `pernoite-${startDate}-${endDate}.csv`;
          link.click();
        }}>
          <Download className="h-4 w-4" />
          CSV
        </Button>
        <Button className="gap-2" onClick={() => {
          exportReportPdf({
            title: 'Controle de Pernoite',
            subtitle: `Período: ${startDate} a ${endDate}`,
            columns: [
              { header: 'Trabalhador', key: 'name' },
              { header: 'Empresa', key: 'company' },
              { header: 'Entrada', key: 'entryTime', width: 35, align: 'center' },
              { header: 'Noites', key: 'nights', width: 20, align: 'center' },
            ],
            data: overnightWorkers,
            filename: `pernoite-${startDate}-${endDate}.pdf`,
            summaryRows: [
              { label: 'Pernoitando', value: String(overnightWorkers.length) },
              { label: 'Total noites', value: String(overnightWorkers.reduce((s, w) => s + w.nights, 0)) },
            ],
          });
        }}>
          <Download className="h-4 w-4" />
          PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trabalhadores Pernoitando</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : overnightWorkers.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <table className="w-full">
                <thead className="sticky top-0 bg-card border-b">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Trabalhador</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Entrada</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Noites</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overnightWorkers.map((worker) => (
                    <tr key={worker.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {worker.photoUrl ? (
                              <AvatarImage src={worker.photoUrl} alt={worker.name} />
                            ) : (
                              <AvatarFallback>
                                <User className="h-5 w-5" />
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <span className="font-medium">{worker.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{worker.company}</td>
                      <td className="p-4 text-center">{worker.entryTime}</td>
                      <td className="p-4 text-center">
                        <Badge variant="secondary">{worker.nights}</Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge className="bg-indigo-500/10 text-indigo-500">
                          <Moon className="h-3 w-3 mr-1" />
                          A bordo
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Moon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum trabalhador pernoitando no período</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
