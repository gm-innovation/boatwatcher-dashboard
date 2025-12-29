import { useAuditLogs } from '@/hooks/useAudit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Activity, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

export const AuditLog = () => {
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: auditLogs = [], isLoading } = useAuditLogs({
    action: actionFilter !== 'all' ? actionFilter : undefined,
    entityType: entityFilter !== 'all' ? entityFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
      case 'insert':
        return <Badge className="bg-green-500/10 text-green-500">Criar</Badge>;
      case 'update':
        return <Badge className="bg-blue-500/10 text-blue-500">Atualizar</Badge>;
      case 'delete':
        return <Badge className="bg-red-500/10 text-red-500">Excluir</Badge>;
      case 'login':
        return <Badge className="bg-purple-500/10 text-purple-500">Login</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Data/Hora', 'Ação', 'Entidade', 'ID Entidade', 'Usuário', 'IP'].join(','),
      ...auditLogs.map(log => [
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
        log.action,
        log.entity_type,
        log.entity_id || '-',
        log.user_id,
        log.ip_address || '-',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Logs de Auditoria
          </CardTitle>
          <Button onClick={handleExport} disabled={auditLogs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ação</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="INSERT">Criar</SelectItem>
                <SelectItem value="UPDATE">Atualizar</SelectItem>
                <SelectItem value="DELETE">Excluir</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Entidade</Label>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="workers">Trabalhadores</SelectItem>
                <SelectItem value="companies">Empresas</SelectItem>
                <SelectItem value="devices">Dispositivos</SelectItem>
                <SelectItem value="projects">Projetos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : auditLogs.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Data/Hora</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Ação</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Entidade</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{format(new Date(log.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'HH:mm:ss')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{getActionBadge(log.action)}</td>
                    <td className="p-3 text-sm capitalize">{log.entity_type}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {log.entity_id ? `ID: ${log.entity_id.slice(0, 8)}...` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum log de auditoria encontrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
