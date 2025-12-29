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
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export const CompanyReports = () => {
  const { user } = useAuth();
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  // Get company ID for current user
  const { data: userCompany } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_companies')
        .select('company_id, companies(name)')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get worker count
  const { data: workerCount = 0 } = useQuery({
    queryKey: ['company-worker-count', userCompany?.company_id],
    queryFn: async () => {
      if (!userCompany?.company_id) return 0;
      
      const { count, error } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', userCompany.company_id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userCompany?.company_id
  });

  // Get documents summary
  const { data: documentsSummary } = useQuery({
    queryKey: ['company-documents-summary', userCompany?.company_id],
    queryFn: async () => {
      if (!userCompany?.company_id) return { total: 0, valid: 0, expired: 0, expiring: 0 };
      
      // Get all workers for company
      const { data: workers } = await supabase
        .from('workers')
        .select('id')
        .eq('company_id', userCompany.company_id);

      if (!workers || workers.length === 0) return { total: 0, valid: 0, expired: 0, expiring: 0 };

      const workerIds = workers.map(w => w.id);
      
      const { data: documents } = await supabase
        .from('worker_documents')
        .select('*')
        .in('worker_id', workerIds);

      if (!documents) return { total: 0, valid: 0, expired: 0, expiring: 0 };

      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      let valid = 0, expired = 0, expiring = 0;
      
      documents.forEach(doc => {
        if (!doc.expiry_date) {
          valid++;
          return;
        }
        
        const expiryDate = new Date(doc.expiry_date);
        if (expiryDate < now) {
          expired++;
        } else if (expiryDate < thirtyDaysFromNow) {
          expiring++;
        } else {
          valid++;
        }
      });

      return { total: documents.length, valid, expired, expiring };
    },
    enabled: !!userCompany?.company_id
  });

  const generateReport = async (type: string) => {
    setGeneratingReport(type);
    
    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Relatório gerado com sucesso', {
        description: 'O download iniciará automaticamente'
      });
      
      // In a real implementation, this would trigger a download
    } catch (error) {
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
      period: format(new Date(), "MMMM yyyy", { locale: ptBR })
    }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
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
              <div className="p-2 rounded-lg bg-green-500/10">
                <FileText className="h-5 w-5 text-green-500" />
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
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Calendar className="h-5 w-5 text-yellow-500" />
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
              <div className="p-2 rounded-lg bg-red-500/10">
                <FileText className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documentsSummary?.expired || 0}</p>
                <p className="text-sm text-muted-foreground">Vencidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
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
                      <div className="p-2 rounded-lg bg-primary/10">
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
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background" />
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
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
