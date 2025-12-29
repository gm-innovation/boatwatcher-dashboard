import { useExpiredDocuments, useWorkersWithExpiringDocuments } from '@/hooks/useWorkerDocuments';
import { useCompanies } from '@/hooks/useSupabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, AlertCircle, AlertTriangle, FileCheck } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ComplianceReport = () => {
  const { data: expiredDocs = [], isLoading: loadingExpired } = useExpiredDocuments();
  const { data: expiringDocs = [], isLoading: loadingExpiring } = useWorkersWithExpiringDocuments(30);
  const { data: companies = [] } = useCompanies();

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return '-';
    return companies.find(c => c.id === companyId)?.name || '-';
  };

  const handleExport = () => {
    const allDocs = [
      ...expiredDocs.map((d: any) => ({ ...d, status: 'Vencido' })),
      ...expiringDocs.map((d: any) => ({ ...d, status: 'Vencendo' })),
    ];

    const csvContent = [
      ['Status', 'Trabalhador', 'Empresa', 'Documento', 'Vencimento', 'Dias'].join(','),
      ...allDocs.map((doc: any) => [
        doc.status,
        doc.worker?.name || 'Desconhecido',
        getCompanyName(doc.worker?.company_id),
        doc.document_type,
        format(new Date(doc.expiry_date), 'dd/MM/yyyy'),
        differenceInDays(new Date(doc.expiry_date), new Date()),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-conformidade-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const isLoading = loadingExpired || loadingExpiring;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Relatório de Conformidade</CardTitle>
          <Button onClick={handleExport} disabled={expiredDocs.length === 0 && expiringDocs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="flex gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm">{expiredDocs.length} documentos vencidos</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">{expiringDocs.length} vencendo em 30 dias</span>
          </div>
        </div>

        <Tabs defaultValue="expired">
          <TabsList className="mb-4">
            <TabsTrigger value="expired" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Vencidos ({expiredDocs.length})
            </TabsTrigger>
            <TabsTrigger value="expiring" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Vencendo ({expiringDocs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expired">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : expiredDocs.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card border-b">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Trabalhador</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Empresa</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Documento</th>
                      <th className="text-center p-3 text-sm font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-center p-3 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiredDocs.map((doc: any) => {
                      const daysExpired = Math.abs(differenceInDays(new Date(doc.expiry_date), new Date()));
                      return (
                        <tr key={doc.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 text-sm font-medium">{doc.worker?.name || 'Desconhecido'}</td>
                          <td className="p-3 text-sm text-muted-foreground">{getCompanyName(doc.worker?.company_id)}</td>
                          <td className="p-3 text-sm">{doc.document_type}</td>
                          <td className="p-3 text-sm text-center">
                            {format(new Date(doc.expiry_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="destructive">
                              Vencido há {daysExpired} dias
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum documento vencido</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="expiring">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : expiringDocs.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card border-b">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Trabalhador</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Empresa</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Documento</th>
                      <th className="text-center p-3 text-sm font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-center p-3 text-sm font-medium text-muted-foreground">Dias Restantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringDocs.map((doc: any) => {
                      const daysRemaining = differenceInDays(new Date(doc.expiry_date), new Date());
                      return (
                        <tr key={doc.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 text-sm font-medium">{doc.worker?.name || 'Desconhecido'}</td>
                          <td className="p-3 text-sm text-muted-foreground">{getCompanyName(doc.worker?.company_id)}</td>
                          <td className="p-3 text-sm">{doc.document_type}</td>
                          <td className="p-3 text-sm text-center">
                            {format(new Date(doc.expiry_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant={daysRemaining <= 7 ? 'destructive' : 'secondary'}>
                              {daysRemaining} dias
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum documento vencendo nos próximos 30 dias</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
