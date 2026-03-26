import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccessLogs } from '@/hooks/useControlID';
import { format } from 'date-fns';
import { FileText, Download, Search, CheckCircle, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { exportAccessLogsToPdf, exportAccessLogsToExcel } from '@/utils/exportReports';

interface ReportsListProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

export const ReportsList = ({ projectId, startDate, endDate }: ReportsListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: accessLogs = [], isLoading } = useAccessLogs(projectId || null, startDate, endDate, 500);

  const filteredLogs = accessLogs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.worker_name?.toLowerCase().includes(search) ||
      log.worker_document?.toLowerCase().includes(search) ||
      log.device_name?.toLowerCase().includes(search) ||
      log.reason?.toLowerCase().includes(search)
    );
  });

  const handleExportPdf = () => {
    exportAccessLogsToPdf(filteredLogs, 'Relatório', startDate, endDate);
  };

  const handleExportExcel = () => {
    exportAccessLogsToExcel(filteredLogs, 'Relatório', startDate, endDate);
  };

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Selecione um projeto para ver os registros de acesso</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF, dispositivo..."
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button size="sm" className="gap-2" onClick={handleExportPdf}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredLogs.length > 0 ? (
            <table className="w-full">
              <thead className="sticky top-0 bg-card border-b">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data/Hora</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Trabalhador</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">CPF</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Dispositivo</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Direção</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-4 text-sm">{format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}</td>
                    <td className="p-4 text-sm">{log.worker_name || 'Não identificado'}</td>
                    <td className="p-4 text-sm text-muted-foreground">{log.worker_document || '-'}</td>
                    <td className="p-4 text-sm text-muted-foreground">{log.device_name || '-'}</td>
                    <td className="p-4 text-center">
                      {log.direction === 'entry' ? (
                        <ArrowRight className="h-4 w-4 text-green-500 inline" />
                      ) : log.direction === 'exit' ? (
                        <ArrowLeft className="h-4 w-4 text-orange-500 inline" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {log.access_status === 'granted' ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Liberado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                          <XCircle className="h-3 w-3 mr-1" />
                          Negado
                        </Badge>
                      )}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{log.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              Nenhum registro encontrado no período
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
