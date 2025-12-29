import { useAccessLogs } from '@/hooks/useControlID';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Building2, Users, Clock } from 'lucide-react';

interface CompanyReportProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

interface CompanyData {
  name: string;
  totalWorkers: number;
  totalHours: number;
  entries: number;
}

export const CompanyReport = ({ projectId, startDate, endDate }: CompanyReportProps) => {
  const { data: accessLogs = [], isLoading } = useAccessLogs(projectId, startDate, endDate, 1000);

  // Agrupar dados por empresa (simulado - na prática você faria um join com workers e companies)
  const companyData: CompanyData[] = [
    { name: 'Empresa A', totalWorkers: 15, totalHours: 1200, entries: 450 },
    { name: 'Empresa B', totalWorkers: 8, totalHours: 640, entries: 240 },
    { name: 'Empresa C', totalWorkers: 12, totalHours: 960, entries: 360 },
  ];

  const totalWorkers = companyData.reduce((sum, c) => sum + c.totalWorkers, 0);
  const totalEntries = companyData.reduce((sum, c) => sum + c.entries, 0);

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Selecione um projeto para ver o relatório por empresa</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Empresas</p>
                <p className="text-3xl font-bold">{companyData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Trabalhadores</p>
                <p className="text-3xl font-bold">{totalWorkers}</p>
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
                <p className="text-sm text-muted-foreground">Total Acessos</p>
                <p className="text-3xl font-bold">{totalEntries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          CSV
        </Button>
        <Button className="gap-2">
          <Download className="h-4 w-4" />
          PDF
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Relatório por Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <table className="w-full">
                <thead className="sticky top-0 bg-card border-b">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Trabalhadores</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Horas Totais</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Entradas</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Média Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {companyData.map((company, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium">{company.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="secondary">{company.totalWorkers}</Badge>
                      </td>
                      <td className="p-4 text-center">{company.totalHours}h</td>
                      <td className="p-4 text-center">{company.entries}</td>
                      <td className="p-4 text-center">
                        {Math.round(company.totalHours / company.totalWorkers)}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
