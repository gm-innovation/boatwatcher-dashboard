import { useMemo } from 'react';
import { useCompanies } from '@/hooks/useSupabase';
import { useAccessLogs } from '@/hooks/useControlID';
import { useJobFunctions } from '@/hooks/useJobFunctions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip, Legend,
} from 'recharts';
import {
  Calendar, TrendingUp, Users, Building2, BarChart3,
  ArrowUp, ArrowDown, Printer,
} from 'lucide-react';
import { format, parseISO, getISOWeek, getDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PresenceReportProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(200, 70%, 50%)',
  'hsl(120, 50%, 45%)',
  'hsl(45, 90%, 50%)',
  'hsl(0, 65%, 55%)',
  'hsl(260, 55%, 55%)',
];

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const PresenceReport = ({ projectId, startDate, endDate }: PresenceReportProps) => {
  const { data: companies = [] } = useCompanies();
  const { data: accessLogs = [], isLoading } = useAccessLogs(projectId || null, startDate, endDate, 5000);
  const { data: jobFunctions = [] } = useJobFunctions();

  const { data: workers = [] } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('id, name, company_id, job_function_id')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name, location');
      if (error) throw error;
      return data;
    },
  });

  const currentProject = projects.find(p => p.id === projectId);

  const dashboard = useMemo(() => {
    const granted = accessLogs.filter((l: any) => l.access_status === 'granted');
    const totalAccesses = granted.length;

    // Worker lookup
    const workerById = new Map(workers.map(w => [w.id, w]));

    // Unique workers & companies
    const uniqueWorkerIds = new Set<string>();
    const uniqueCompanyIds = new Set<string>();
    granted.forEach((l: any) => {
      const wId = l.worker_id;
      if (wId) {
        uniqueWorkerIds.add(wId);
        const w = workerById.get(wId);
        if (w?.company_id) uniqueCompanyIds.add(w.company_id);
      }
    });

    // By day
    const byDay: Record<string, number> = {};
    granted.forEach((l: any) => {
      const d = format(new Date(l.timestamp), 'yyyy-MM-dd');
      byDay[d] = (byDay[d] || 0) + 1;
    });

    const dayEntries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
    const totalDays = dayEntries.length || 1;
    const avgDaily = Math.round(totalAccesses / totalDays);

    let peakDay = { date: '-', count: 0 };
    let lowDay = { date: '-', count: Infinity };
    dayEntries.forEach(([date, count]) => {
      if (count > peakDay.count) peakDay = { date, count };
      if (count < lowDay.count) lowDay = { date, count };
    });
    if (lowDay.count === Infinity) lowDay = { date: '-', count: 0 };

    const dailyChart = dayEntries.map(([date, count]) => ({
      date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
      fullDate: date,
      acessos: count,
    }));

    // By week
    const byWeek: Record<string, number> = {};
    granted.forEach((l: any) => {
      const w = getISOWeek(new Date(l.timestamp));
      const key = `Sem ${w}`;
      byWeek[key] = (byWeek[key] || 0) + 1;
    });
    const weeklyChart = Object.entries(byWeek)
      .sort(([a], [b]) => {
        const na = parseInt(a.replace('Sem ', ''));
        const nb = parseInt(b.replace('Sem ', ''));
        return na - nb;
      })
      .map(([week, count]) => ({ semana: week, acessos: count }));

    // By day of week
    const byDayOfWeek: number[] = [0, 0, 0, 0, 0, 0, 0];
    granted.forEach((l: any) => {
      const d = getDay(new Date(l.timestamp));
      byDayOfWeek[d]++;
    });
    const dayOfWeekChart = DAY_NAMES.map((name, i) => ({
      dia: name,
      acessos: byDayOfWeek[i],
    }));

    // Weekday vs Weekend
    const weekdayCount = byDayOfWeek.slice(1, 6).reduce((s, v) => s + v, 0);
    const weekendCount = byDayOfWeek[0] + byDayOfWeek[6];
    const weekdayVsWeekend = [
      { name: 'Dias Úteis', value: weekdayCount },
      { name: 'Fins de Semana', value: weekendCount },
    ];

    // By job function
    const byJobFunction: Record<string, number> = {};
    granted.forEach((l: any) => {
      const w = l.worker_id ? workerById.get(l.worker_id) : null;
      const jfId = w?.job_function_id;
      const jfName = jfId
        ? jobFunctions.find(jf => jf.id === jfId)?.name || 'Sem cargo'
        : 'Sem cargo';
      byJobFunction[jfName] = (byJobFunction[jfName] || 0) + 1;
    });
    const jobFunctionChart = Object.entries(byJobFunction)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ cargo: name, acessos: count }));

    // Top 10 companies
    const companyWorkerCount: Record<string, Set<string>> = {};
    granted.forEach((l: any) => {
      const w = l.worker_id ? workerById.get(l.worker_id) : null;
      if (w?.company_id) {
        if (!companyWorkerCount[w.company_id]) companyWorkerCount[w.company_id] = new Set();
        companyWorkerCount[w.company_id].add(w.id);
      }
    });
    const top10Companies = Object.entries(companyWorkerCount)
      .map(([companyId, workerSet]) => ({
        name: companies.find(c => c.id === companyId)?.name || 'Desconhecida',
        workers: workerSet.size,
      }))
      .sort((a, b) => b.workers - a.workers)
      .slice(0, 10);

    return {
      totalAccesses,
      uniqueWorkers: uniqueWorkerIds.size,
      uniqueCompanies: uniqueCompanyIds.size,
      avgDaily,
      peakDay,
      lowDay,
      dailyChart,
      weeklyChart,
      dayOfWeekChart,
      weekdayVsWeekend,
      jobFunctionChart,
      top10Companies,
    };
  }, [accessLogs, workers, companies, jobFunctions]);

  const handlePrint = () => {
    window.print();
  };

  if (!projectId) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Selecione um projeto para ver a visão geral</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            Visão Geral do Projeto: {currentProject?.name || 'Projeto'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Período: {format(parseISO(startDate), 'dd/MM/yyyy')} a {format(parseISO(endDate), 'dd/MM/yyyy')}
            {currentProject?.location && ` • ${currentProject.location}`}
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Acessos</p>
                <p className="text-2xl font-bold">{dashboard.totalAccesses.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trabalhadores Únicos</p>
                <p className="text-2xl font-bold">{dashboard.uniqueWorkers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Empresas</p>
                <p className="text-2xl font-bold">{dashboard.uniqueCompanies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média Diária</p>
                <p className="text-2xl font-bold">{dashboard.avgDaily}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 2 — Peak & Low */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <ArrowUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dia com Mais Acessos</p>
                <p className="text-lg font-bold">
                  {dashboard.peakDay.date !== '-'
                    ? format(parseISO(dashboard.peakDay.date), 'dd/MM/yyyy (EEEE)', { locale: ptBR })
                    : '-'}
                </p>
                <Badge variant="secondary">{dashboard.peakDay.count} acessos</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <ArrowDown className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dia com Menos Acessos</p>
                <p className="text-lg font-bold">
                  {dashboard.lowDay.date !== '-'
                    ? format(parseISO(dashboard.lowDay.date), 'dd/MM/yyyy (EEEE)', { locale: ptBR })
                    : '-'}
                </p>
                <Badge variant="secondary">{dashboard.lowDay.count} acessos</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Access Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acessos por Dia</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.dailyChart.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboard.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="acessos"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Acessos"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground text-sm">Sem dados no período</p>
          )}
        </CardContent>
      </Card>

      {/* Weekly + Day of Week Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quantidade por Semana</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.weeklyChart.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.weeklyChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="semana" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="acessos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Acessos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-sm">Sem dados</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Dia da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.dayOfWeekChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="acessos" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="Acessos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekday vs Weekend + Job Functions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dias Úteis vs Fins de Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard.weekdayVsWeekend}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {dashboard.weekdayVsWeekend.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Cargo/Função</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.jobFunctionChart.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.jobFunctionChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis
                      type="category"
                      dataKey="cargo"
                      tick={{ fontSize: 11 }}
                      width={120}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="acessos" fill={CHART_COLORS[3]} radius={[0, 4, 4, 0]} name="Acessos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-sm">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Companies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 Empresas por Nº de Trabalhadores</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.top10Companies.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">#</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Empresa</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Trabalhadores</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.top10Companies.map((company, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-sm font-medium">{i + 1}</td>
                      <td className="p-3 text-sm">{company.name}</td>
                      <td className="p-3 text-center">
                        <Badge variant="secondary">{company.workers}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground text-sm">Sem dados no período</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
