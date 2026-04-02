import { useMemo, useState, useRef } from 'react';
import { useCompanies } from '@/hooks/useSupabase';
import { useAccessLogs } from '@/hooks/useControlID';
import { useJobFunctions } from '@/hooks/useJobFunctions';
import { useSystemSetting } from '@/hooks/useSystemSettings';
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
  Tooltip, Legend, LabelList,
} from 'recharts';
import {
  Calendar, TrendingUp, Users, Building2, BarChart3,
  ArrowUp, ArrowDown, Printer, Download,
} from 'lucide-react';
import { format, parseISO, getISOWeek, getDay, differenceInDays, startOfWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from '@/components/ui/use-toast';

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
  const { data: systemLogoSetting } = useSystemSetting('system_logo');

  const [exporting, setExporting] = useState(false);
  const reportContainerRef = useRef<HTMLDivElement>(null);

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
      const { data, error } = await supabase.from('projects').select('id, name, location, client_id');
      if (error) throw error;
      return data;
    },
  });

  const currentProject = projects.find(p => p.id === projectId);

  // Get client company logo
  const clientCompany = currentProject?.client_id
    ? companies.find(c => c.id === currentProject.client_id)
    : null;

  // Logo URLs
  const systemLogoValue = systemLogoSetting?.value as Record<string, any> | null;
  const systemLogoUrl = systemLogoValue?.light_url || systemLogoValue?.url;
  const clientLogoUrl = clientCompany?.logo_url_light;

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

    // By week — format "Sem DD/MM" using start of week (Sunday)
    const byWeekMap: Record<string, { count: number; weekStart: Date }> = {};
    granted.forEach((l: any) => {
      const ts = new Date(l.timestamp);
      const ws = startOfWeek(ts, { weekStartsOn: 0 });
      const key = ws.toISOString();
      if (!byWeekMap[key]) byWeekMap[key] = { count: 0, weekStart: ws };
      byWeekMap[key].count++;
    });
    const weeklyChart = Object.values(byWeekMap)
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map(({ weekStart, count }) => ({
        semana: `Sem ${format(weekStart, 'dd/MM')}`,
        acessos: count,
      }));

    // By day of week (simple)
    const byDayOfWeek: number[] = [0, 0, 0, 0, 0, 0, 0];
    granted.forEach((l: any) => {
      const d = getDay(new Date(l.timestamp));
      byDayOfWeek[d]++;
    });

    // Stacked chart: distribution by day of week per week
    const weeklyByDay: Record<string, { weekStart: Date; days: number[] }> = {};
    granted.forEach((l: any) => {
      const ts = new Date(l.timestamp);
      const ws = startOfWeek(ts, { weekStartsOn: 0 });
      const key = ws.toISOString();
      if (!weeklyByDay[key]) weeklyByDay[key] = { weekStart: ws, days: [0, 0, 0, 0, 0, 0, 0] };
      weeklyByDay[key].days[getDay(ts)]++;
    });
    const weeklyByDayChart = Object.values(weeklyByDay)
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map(({ weekStart, days }) => ({
        semana: `Sem ${format(weekStart, 'dd/MM')}`,
        Domingo: days[0],
        Segunda: days[1],
        Terça: days[2],
        Quarta: days[3],
        Quinta: days[4],
        Sexta: days[5],
        Sábado: days[6],
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

    // Top 10 companies — with access count and avg daily
    const companyWorkerCount: Record<string, Set<string>> = {};
    const companyAccessCount: Record<string, number> = {};
    granted.forEach((l: any) => {
      const w = l.worker_id ? workerById.get(l.worker_id) : null;
      if (w?.company_id) {
        if (!companyWorkerCount[w.company_id]) companyWorkerCount[w.company_id] = new Set();
        companyWorkerCount[w.company_id].add(w.id);
        companyAccessCount[w.company_id] = (companyAccessCount[w.company_id] || 0) + 1;
      }
    });
    const top10Companies = Object.entries(companyWorkerCount)
      .map(([companyId, workerSet]) => ({
        name: companies.find(c => c.id === companyId)?.name || 'Desconhecida',
        workers: workerSet.size,
        totalAccesses: companyAccessCount[companyId] || 0,
        avgDaily: Math.round((companyAccessCount[companyId] || 0) / totalDays),
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

  const handleExportPdf = async () => {
    if (!reportContainerRef.current) return;
    setExporting(true);
    try {
      const container = reportContainerRef.current;

      // Show the print-only header for capture
      const printHeader = container.querySelector('.print-only-header') as HTMLElement | null;
      if (printHeader) printHeader.style.display = 'flex';

      // Hide buttons
      const buttons = container.querySelectorAll('.print\\:hidden, .no-print');
      buttons.forEach(b => (b as HTMLElement).style.display = 'none');

      // Force white background for capture
      const origBg = container.style.background;
      container.style.background = 'white';

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200,
      });

      // Restore
      container.style.background = origBg;
      buttons.forEach(b => (b as HTMLElement).style.display = '');
      if (printHeader) printHeader.style.display = 'none';

      // Build PDF from canvas
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfPageW = pdf.internal.pageSize.getWidth();
      const pdfPageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableW = pdfPageW - margin * 2;
      const usableH = pdfPageH - margin * 2 - 8; // 8mm for footer

      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = usableW / imgW;
      const scaledH = imgH * ratio;

      // How many pages?
      const totalPages = Math.ceil(scaledH / usableH);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        // Source slice in canvas pixels
        const srcY = page * (usableH / ratio);
        const srcH = Math.min(imgH - srcY, usableH / ratio);

        // Create a slice canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgW;
        sliceCanvas.height = srcH;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);
        }

        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceScaledH = srcH * ratio;
        pdf.addImage(sliceData, 'PNG', margin, margin, usableW, sliceScaledH);

        // Footer
        pdf.setFontSize(7);
        pdf.setTextColor(160);
        pdf.text(`Página ${page + 1} de ${totalPages}`, pdfPageW - margin, pdfPageH - 6, { align: 'right' });
        pdf.text(
          `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          margin,
          pdfPageH - 6
        );
      }

      pdf.save(`visao-geral-${startDate}-${endDate}.pdf`);
    } catch (e: any) {
      toast({ title: 'Erro ao gerar PDF', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
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
    <div ref={reportContainerRef} className="space-y-6 print:space-y-4">
      {/* Print-only header with logos */}
      <div className="print-only-header hidden print:flex items-center justify-between mb-6">
        {clientLogoUrl ? (
          <img src={clientLogoUrl} alt="Logo Cliente" className="max-h-14 max-w-[160px] object-contain" />
        ) : (
          <div />
        )}
        {systemLogoUrl ? (
          <img src={systemLogoUrl} alt="Logo Sistema" className="max-h-14 max-w-[160px] object-contain" />
        ) : (
          <div />
        )}
      </div>

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
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={handleExportPdf} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Gerando...' : 'Baixar PDF'}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <Card className="print-no-break">
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
        <Card className="print-no-break">
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
        <Card className="print-no-break">
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
        <Card className="print-no-break">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
        <Card className="print-no-break">
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
        <Card className="print-no-break">
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
      <Card className="print-no-break">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-1">
        <Card className="print-no-break">
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

        <Card className="print-no-break">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-1">
        <Card className="print-no-break">
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

        <Card className="print-no-break">
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
      <Card className="print-no-break">
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
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Total Acessos</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Média Diária</th>
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
                      <td className="p-3 text-center text-sm">{company.totalAccesses.toLocaleString()}</td>
                      <td className="p-3 text-center text-sm">{company.avgDaily}</td>
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
