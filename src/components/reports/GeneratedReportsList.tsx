import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Eye, Download, Loader2, Play } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useProject } from '@/contexts/ProjectContext';

const reportTypeLabels: Record<string, string> = {
  presence: 'Presença',
  access: 'Acessos',
  compliance: 'Conformidade',
  device: 'Dispositivos',
};

export const GeneratedReportsList = () => {
  const { selectedProjectId } = useProject();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [generateType, setGenerateType] = useState('presence');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['generated-reports', selectedProjectId],
    queryFn: async () => {
      let query = supabase
        .from('generated_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedProjectId) {
        query = query.eq('project_id', selectedProjectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (type: string) => {
      const { data, error } = await supabase.functions.invoke('scheduled-reports', {
        body: {
          manual: true,
          report_type: type,
          project_id: selectedProjectId || null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-reports'] });
      toast.success('Relatório gerado com sucesso');
    },
    onError: (err: Error) => {
      toast.error('Erro ao gerar relatório: ' + err.message);
    },
  });

  const exportCSV = (report: any) => {
    const data = report.data as any;
    if (!data?.details?.length) {
      toast.error('Sem dados para exportar');
      return;
    }
    const details = data.details;
    const headers = Object.keys(details[0]);
    const csv = [headers.join(','), ...details.map((r: any) => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${report.report_type}-${format(new Date(report.created_at), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Generate manually */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Tipo de Relatório</label>
              <Select value={generateType} onValueChange={setGenerateType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presence">Presença</SelectItem>
                  <SelectItem value="access">Acessos</SelectItem>
                  <SelectItem value="compliance">Conformidade</SelectItem>
                  <SelectItem value="device">Dispositivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => generateMutation.mutate(generateType)}
              disabled={generateMutation.isPending}
              className="gap-2"
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Gerar Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatórios Gerados
          </CardTitle>
          <CardDescription>Snapshots de relatórios salvos para consulta e exportação</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum relatório gerado ainda</p>
              <p className="text-sm mt-1">Use o botão acima para gerar um relatório</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Gerado em</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report: any) => {
                    const data = report.data as any;
                    return (
                      <TableRow key={report.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {reportTypeLabels[report.report_type] || report.report_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(report.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{data?.total_records ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {report.filters?.manual ? 'Manual' : 'Agendado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedReport(report)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => exportCSV(report)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {reportTypeLabels[selectedReport?.report_type] || 'Relatório'} —{' '}
              {selectedReport && format(new Date(selectedReport.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <ReportDetail report={selectedReport} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

function ReportDetail({ report }: { report: any }) {
  if (!report) return null;
  const data = report.data as any;
  if (!data) return <p className="text-muted-foreground">Sem dados</p>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {data.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.summary).map(([key, value]) => (
            <Card key={key}>
              <CardContent className="pt-3 pb-3">
                <p className="text-2xl font-bold">{String(value)}</p>
                <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details table */}
      {data.details?.length > 0 && (
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                {Object.keys(data.details[0]).map((key) => (
                  <TableHead key={key} className="capitalize text-xs">
                    {key.replace(/_/g, ' ')}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.details.slice(0, 200).map((row: any, i: number) => (
                <TableRow key={i}>
                  {Object.values(row).map((val: any, j: number) => (
                    <TableCell key={j} className="text-xs">
                      {val === null ? '-' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}
