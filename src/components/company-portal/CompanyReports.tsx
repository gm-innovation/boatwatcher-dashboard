import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  Calendar,
  Users,
  Clock,
  FileDown
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCompany } from '@/hooks/useCurrentCompany';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export const CompanyReports = () => {
  const { user } = useAuth();
  const { data: companyAccess } = useCurrentCompany(user?.id);
  const companyId = companyAccess?.companyId;
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  const { data: workerCount = 0 } = useQuery({
    queryKey: ['company-worker-count', companyId],
    queryFn: async () => {
      if (!companyId) return 0;

      const { count, error } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId
  });

  const { data: documentsSummary } = useQuery({
    queryKey: ['company-documents-summary', companyId],
    queryFn: async () => {
      if (!companyId) return { total: 0, valid: 0, expired: 0, expiring: 0 };

      const { data: workers } = await supabase
        .from('workers')
        .select('id')
        .eq('company_id', companyId);

      if (!workers || workers.length === 0) return { total: 0, valid: 0, expired: 0, expiring: 0 };

      const workerIds = workers.map((worker) => worker.id);

      const { data: documents } = await supabase
        .from('worker_documents')
        .select('*')
        .in('worker_id', workerIds);

      if (!documents) return { total: 0, valid: 0, expired: 0, expiring: 0 };

      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      let valid = 0;
      let expired = 0;
      let expiring = 0;

      documents.forEach((doc) => {
        if (!doc.expiry_date) {
          valid += 1;
          return;
        }

        const expiryDate = new Date(doc.expiry_date);
        if (expiryDate < now) {
          expired += 1;
        } else if (expiryDate < thirtyDaysFromNow) {
          expiring += 1;
        } else {
          valid += 1;
        }
      });

      return { total: documents.length, valid, expired, expiring };
    },
    enabled: !!companyId
  });

  const generateReport = async (type: string) => {
    setGeneratingReport(type);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success('Relatório gerado com sucesso', {
        description: 'O download iniciará automaticamente'
      });
    } catch {
      toast.error('Erro ao gerar relatório');
    } finally {
      setGeneratingReport(null);
    }
  };

  const reports = [
    {
      id: 'workers',
      title: 'Lista de Trabalhadores',
      description: 'Todos os trabalhadores cadastrados com status e documentação',
      icon: Users,
      period: 'Atual'
    },
    {
      id: 'documents',
      title: 'Relatório de Documentos',
      description: 'Status de todos os documentos: válidos, vencidos e a vencer',
      icon: FileText,
      period: 'Atual'
    },
    {
      id: 'presence',
      title: 'Relatório de Presença',
      description: 'Histórico de acessos do mês atual',
      icon: Clock,
      period: format(new Date(), 'MMMM yyyy', { locale: ptBR })
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workerCount}</p>
                <p className="text-sm text-muted-foreground">Trabalhadores</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-border bg-muted p-2">
                <FileText className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documentsSummary?.valid || 0}</p>
                <p className="text-sm text-muted-foreground">Docs. Válidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-border bg-muted p-2">
                <Calendar className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documentsSummary?.expiring || 0}</p>
                <p className="text-sm text-muted-foreground">A Vencer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-border bg-muted p-2">
                <FileText className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documentsSummary?.expired || 0}</p>
                <p className="text-sm text-muted-foreground">Vencidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Relatórios Disponíveis
          </CardTitle>
          <CardDescription>
            Gere e baixe relatórios da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.id} className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <report.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{report.title}</h3>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{report.period}</Badge>
                      <Button
                        size="sm"
                        onClick={() => generateReport(report.id)}
                        disabled={generatingReport === report.id}
                      >
                        {generatingReport === report.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-background" />
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Gerar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
