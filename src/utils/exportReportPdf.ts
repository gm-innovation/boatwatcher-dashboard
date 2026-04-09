import jsPDF from 'jspdf';
import { ptBR } from 'date-fns/locale';
import { fitImageDimensions } from './exportWorkerReportPdf';
import { formatBrtShort, formatBrtDateTime, formatBrtNow } from '@/utils/brt';

interface PdfColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

interface ExportPdfOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  data: Record<string, any>[];
  filename: string;
  orientation?: 'portrait' | 'landscape';
  summaryRows?: { label: string; value: string }[];
}

export function exportReportPdf({
  title,
  subtitle,
  columns,
  data,
  filename,
  orientation = 'portrait',
  summaryRows,
}: ExportPdfOptions) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  y += 7;

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, margin, y);
    y += 5;
  }

  // Date
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(`Gerado em: ${formatBrtNow()}`, margin, y);
  y += 8;

  // Summary
  if (summaryRows && summaryRows.length > 0) {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 3, pageWidth - margin * 2, summaryRows.length * 6 + 4, 'F');
    doc.setFontSize(9);
    doc.setTextColor(60);
    summaryRows.forEach((row) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${row.label}: `, margin + 2, y + 2);
      doc.setFont('helvetica', 'normal');
      doc.text(row.value, margin + 2 + doc.getTextWidth(`${row.label}: `), y + 2);
      y += 6;
    });
    y += 4;
  }

  // Calculate column widths
  const availableWidth = pageWidth - margin * 2;
  const totalDefinedWidth = columns.reduce((sum, col) => sum + (col.width || 0), 0);
  const colsWithoutWidth = columns.filter(c => !c.width).length;
  const remainingWidth = availableWidth - totalDefinedWidth;
  const autoWidth = colsWithoutWidth > 0 ? remainingWidth / colsWithoutWidth : 0;

  const colWidths = columns.map(col => col.width || autoWidth);

  // Table header
  doc.setFillColor(50, 50, 50);
  doc.rect(margin, y, availableWidth, 7, 'F');
  doc.setTextColor(255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  let x = margin;
  columns.forEach((col, i) => {
    const textX = col.align === 'center' ? x + colWidths[i] / 2 : col.align === 'right' ? x + colWidths[i] - 2 : x + 2;
    const align = col.align || 'left';
    doc.text(col.header, textX, y + 5, { align });
    x += colWidths[i];
  });
  y += 7;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const baseRowH = 6;
  const lineH = 3.5;

  data.forEach((row, rowIndex) => {
    // Pre-calculate wrapped text for all columns to determine row height
    const wrappedCols = columns.map((col, i) => {
      const value = String(row[col.key] ?? '-');
      const maxW = colWidths[i] - 4;
      const lines: string[] = doc.splitTextToSize(value, maxW);
      return lines;
    });
    const maxLines = Math.max(...wrappedCols.map(l => l.length));
    const rowH = Math.max(baseRowH, maxLines * lineH + 2);

    if (y + rowH > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 15;
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y, availableWidth, rowH, 'F');
    }

    doc.setTextColor(40);
    x = margin;
    columns.forEach((col, i) => {
      const lines = wrappedCols[i];
      const align = col.align || 'left';
      const textX = col.align === 'center' ? x + colWidths[i] / 2 : col.align === 'right' ? x + colWidths[i] - 2 : x + 2;
      lines.forEach((line, li) => {
        doc.text(line, textX, y + 4 + li * lineH, { align });
      });
      x += colWidths[i];
    });
    y += rowH;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' }
    );
  }

  doc.save(filename);
}

/* ═══════════════════════════════════════════════════
   PDF DE EMPRESAS — Seguindo padrão do relatório de trabalhadores
   ═══════════════════════════════════════════════════ */

interface CompanyPdfRow {
  name: string;
  totalWorkers: number;
  firstEntry: Date | null;
  lastExit: Date | null;
  allExited: boolean;
  onBoardNow: number;
  totalMinutes: number;
  dayWorkers: number;
  nightWorkers: number;
}

interface CompanyPdfOptions {
  companies: CompanyPdfRow[];
  startDate: string;
  endDate: string;
  projectName?: string;
  projectLocation?: string;
  clientLogoDataUrl?: string;
  systemLogoDataUrl?: string;
}

const MARGIN = 14;
const CLR = {
  dark: [40, 40, 40] as const,
  medium: [100, 100, 100] as const,
  light: [160, 160, 160] as const,
  white: [255, 255, 255] as const,
  headerBg: [50, 50, 50] as const,
  altRowBg: [248, 248, 248] as const,
  summaryBg: [240, 245, 250] as const,
  separator: [180, 200, 220] as const,
  onBoardColor: [22, 163, 74] as const,
};

function fmtDuration(mins: number): string {
  if (mins <= 0) return '-';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function fmtShort(date: Date | null): string {
  if (!date) return '-';
  return format(date, 'dd/MM HH:mm');
}

export async function exportCompanyReportPdf(opts: CompanyPdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const availableWidth = pageWidth - MARGIN * 2;

  // --- Logos (aspect-ratio safe) ---
  const logoMaxW = 40;
  const logoMaxH = 14;
  if (opts.clientLogoDataUrl) {
    try {
      const { w, h } = await fitImageDimensions(opts.clientLogoDataUrl, logoMaxW, logoMaxH);
      const yOffset = 8 + (logoMaxH - h) / 2;
      doc.addImage(opts.clientLogoDataUrl, 'PNG', MARGIN, yOffset, w, h);
    } catch {}
  }
  if (opts.systemLogoDataUrl) {
    try {
      const { w, h } = await fitImageDimensions(opts.systemLogoDataUrl, logoMaxW, logoMaxH);
      const yOffset = 8 + (logoMaxH - h) / 2;
      doc.addImage(opts.systemLogoDataUrl, 'PNG', pageWidth - MARGIN - w, yOffset, w, h);
    } catch {}
  }

  let y = 26;

  // --- Title ---
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLR.dark);
  doc.text('Relatório de Empresas', pageWidth / 2, y, { align: 'center' });
  y += 6;

  // --- Project + Location ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CLR.medium);
  const projectLine = [
    opts.projectName ? `Projeto: ${opts.projectName}` : null,
    opts.projectLocation ? `Local: ${opts.projectLocation}` : null,
  ].filter(Boolean).join(' | ');
  if (projectLine) {
    doc.text(projectLine, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // --- Period ---
  const period = `Período: ${format(new Date(opts.startDate), 'dd/MM/yyyy')} a ${format(new Date(opts.endDate), 'dd/MM/yyyy')}`;
  doc.text(period, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // --- Summary bar ---
  const totalWorkers = opts.companies.reduce((s, c) => s + c.totalWorkers, 0);
  const totalDay = opts.companies.reduce((s, c) => s + c.dayWorkers, 0);
  const totalNight = opts.companies.reduce((s, c) => s + c.nightWorkers, 0);
  const totalOnBoard = opts.companies.reduce((s, c) => s + c.onBoardNow, 0);

  doc.setFillColor(...CLR.summaryBg);
  doc.roundedRect(MARGIN, y - 3, availableWidth, 10, 1, 1, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLR.dark);
  const summaryText = `Total de Empresas: ${opts.companies.length}  |  Funcionários: ${totalWorkers} (Diurnos: ${totalDay}, Noturnos: ${totalNight})  |  A bordo: ${totalOnBoard}`;
  doc.text(summaryText, pageWidth / 2, y + 4, { align: 'center' });
  y += 12;

  // --- Separator ---
  doc.setDrawColor(...CLR.separator);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 6;

  // --- Column definitions ---
  const cols = [
    { header: 'Empresa', width: 0, align: 'left' as const },
    { header: 'Func.', width: 18, align: 'center' as const },
    { header: 'Entrada', width: 28, align: 'center' as const },
    { header: 'Saída', width: 28, align: 'center' as const },
    { header: 'Permanência', width: 28, align: 'center' as const },
  ];
  const fixedWidth = cols.reduce((s, c) => s + c.width, 0);
  const nameWidth = availableWidth - fixedWidth;
  const colWidths = cols.map(c => c.width || nameWidth);

  const drawTableHeader = (cy: number) => {
    doc.setFillColor(...CLR.headerBg);
    doc.rect(MARGIN, cy, availableWidth, 7, 'F');
    doc.setTextColor(...CLR.white);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    let cx = MARGIN;
    cols.forEach((col, i) => {
      const tx = col.align === 'center' ? cx + colWidths[i] / 2 : cx + 2;
      doc.text(col.header, tx, cy + 5, { align: col.align === 'center' ? 'center' : 'left' });
      cx += colWidths[i];
    });
    return cy + 7;
  };

  y = drawTableHeader(y);

  // --- Rows ---
  opts.companies.forEach((company, ri) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...CLR.dark);

    const exitText = company.allExited
      ? fmtShort(company.lastExit)
      : 'A bordo';

    const values = [
      company.name,
      String(company.totalWorkers),
      fmtShort(company.firstEntry),
      exitText,
      fmtDuration(company.totalMinutes),
    ];

    // Pre-calculate wrapped text to determine row height
    const compWrapped = values.map((val, i) => {
      const maxW = colWidths[i] - 3;
      return doc.splitTextToSize(val, maxW) as string[];
    });
    const compMaxLines = Math.max(...compWrapped.map(l => l.length));
    const compLineH = 3.5;
    const compRowH = Math.max(6, compMaxLines * compLineH + 2);

    if (y + compRowH > pageHeight - 20) {
      doc.addPage();
      y = 18;
      y = drawTableHeader(y);
    }

    if (ri % 2 === 0) {
      doc.setFillColor(...CLR.altRowBg);
      doc.rect(MARGIN, y, availableWidth, compRowH, 'F');
    }

    let cx = MARGIN;
    cols.forEach((col, i) => {
      const tx = col.align === 'center' ? cx + colWidths[i] / 2 : cx + 2;
      const lines = compWrapped[i];

      // Highlight "A bordo"
      if (i === 3 && !company.allExited) {
        doc.setTextColor(...CLR.onBoardColor);
        doc.setFont('helvetica', 'bold');
      }

      lines.forEach((line, li) => {
        doc.text(line, tx, y + 4 + li * compLineH, { align: col.align === 'center' ? 'center' : 'left' });
      });
      doc.setTextColor(...CLR.dark);
      doc.setFont('helvetica', 'normal');
      cx += colWidths[i];
    });

    y += compRowH;
  });

  // --- Total row ---
  y += 2;
  doc.setFillColor(...CLR.summaryBg);
  doc.rect(MARGIN, y, availableWidth, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLR.dark);
  doc.text(`Total de Empresas: ${opts.companies.length}`, MARGIN + 3, y + 5);
  doc.text(`Funcionários: ${totalWorkers}`, MARGIN + availableWidth / 2, y + 5);

  // --- Footers ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...CLR.light);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, MARGIN, pageHeight - 8);
  }

  doc.save(`relatorio-empresas-${opts.startDate}-${opts.endDate}.pdf`);
}

/* ═══════════════════════════════════════════════════
   PDF VISÃO GERAL — Dashboard overview
   ═══════════════════════════════════════════════════ */

interface OverviewKpi {
  label: string;
  value: string;
}

interface OverviewDayOfWeekRow {
  dia: string;
  acessos: number;
}

interface OverviewCompanyRow {
  name: string;
  workers: number;
}

interface OverviewPdfOptions {
  projectName?: string;
  projectLocation?: string;
  startDate: string;
  endDate: string;
  clientLogoDataUrl?: string;
  systemLogoDataUrl?: string;
  kpis: OverviewKpi[];
  peakDay: { label: string; count: number };
  lowDay: { label: string; count: number };
  dayOfWeekData: OverviewDayOfWeekRow[];
  top10Companies: OverviewCompanyRow[];
  jobFunctionData: { cargo: string; acessos: number }[];
}

export async function exportOverviewReportPdf(opts: OverviewPdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const availableWidth = pageWidth - MARGIN * 2;

  // --- Logos ---
  const logoMaxW = 40;
  const logoMaxH = 14;
  if (opts.clientLogoDataUrl) {
    try {
      const { w, h } = await fitImageDimensions(opts.clientLogoDataUrl, logoMaxW, logoMaxH);
      const yOffset = 8 + (logoMaxH - h) / 2;
      doc.addImage(opts.clientLogoDataUrl, 'PNG', MARGIN, yOffset, w, h);
    } catch {}
  }
  if (opts.systemLogoDataUrl) {
    try {
      const { w, h } = await fitImageDimensions(opts.systemLogoDataUrl, logoMaxW, logoMaxH);
      const yOffset = 8 + (logoMaxH - h) / 2;
      doc.addImage(opts.systemLogoDataUrl, 'PNG', pageWidth - MARGIN - w, yOffset, w, h);
    } catch {}
  }

  let y = 26;

  // --- Title ---
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLR.dark);
  doc.text('Relatório Visão Geral', pageWidth / 2, y, { align: 'center' });
  y += 6;

  // --- Project + Location ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CLR.medium);
  const projectLine = [
    opts.projectName ? `Projeto: ${opts.projectName}` : null,
    opts.projectLocation ? `Local: ${opts.projectLocation}` : null,
  ].filter(Boolean).join(' | ');
  if (projectLine) {
    doc.text(projectLine, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // --- Period ---
  const period = `Período: ${format(new Date(opts.startDate), 'dd/MM/yyyy')} a ${format(new Date(opts.endDate), 'dd/MM/yyyy')}`;
  doc.text(period, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // --- KPI grid (2 rows x 3 cols) ---
  doc.setDrawColor(...CLR.separator);
  const kpiW = availableWidth / 3;
  const kpiH = 14;
  const allKpis = [
    ...opts.kpis,
    { label: 'Dia Pico', value: `${opts.peakDay.label} (${opts.peakDay.count})` },
    { label: 'Dia Baixo', value: `${opts.lowDay.label} (${opts.lowDay.count})` },
  ];
  allKpis.forEach((kpi, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const kx = MARGIN + col * kpiW;
    const ky = y + row * kpiH;
    doc.setFillColor(...CLR.summaryBg);
    doc.rect(kx, ky, kpiW, kpiH, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CLR.medium);
    doc.text(kpi.label, kx + kpiW / 2, ky + 5, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CLR.dark);
    doc.text(kpi.value, kx + kpiW / 2, ky + 11, { align: 'center' });
  });
  y += Math.ceil(allKpis.length / 3) * kpiH + 6;

  // --- Separator ---
  doc.setDrawColor(...CLR.separator);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 6;

  // --- Day of week table ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLR.dark);
  doc.text('Acessos por Dia da Semana', MARGIN, y + 1);
  y += 6;

  const dowCols = [
    { header: 'Dia', width: 0, align: 'left' as const },
    { header: 'Acessos', width: 30, align: 'center' as const },
  ];
  const dowFixedW = dowCols.reduce((s, c) => s + c.width, 0);
  const dowNameW = availableWidth - dowFixedW;
  const dowWidths = dowCols.map(c => c.width || dowNameW);

  // header row
  doc.setFillColor(...CLR.headerBg);
  doc.rect(MARGIN, y, availableWidth, 7, 'F');
  doc.setTextColor(...CLR.white);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  let cx = MARGIN;
  dowCols.forEach((col, i) => {
    const tx = col.align === 'center' ? cx + dowWidths[i] / 2 : cx + 2;
    doc.text(col.header, tx, y + 5, { align: col.align === 'center' ? 'center' : 'left' });
    cx += dowWidths[i];
  });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  opts.dayOfWeekData.forEach((row, ri) => {
    if (ri % 2 === 0) {
      doc.setFillColor(...CLR.altRowBg);
      doc.rect(MARGIN, y, availableWidth, 6, 'F');
    }
    doc.setTextColor(...CLR.dark);
    doc.text(row.dia, MARGIN + 2, y + 4);
    doc.text(String(row.acessos), MARGIN + dowNameW + 15, y + 4, { align: 'center' });
    y += 6;
  });
  y += 6;

  // --- Top 10 Companies table ---
  if (opts.top10Companies.length > 0) {
    if (y + 20 > pageHeight - 20) { doc.addPage(); y = 18; }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CLR.dark);
    doc.text('Top 10 Empresas por Nº de Trabalhadores', MARGIN, y + 1);
    y += 6;

    const compCols = [
      { header: '#', width: 10, align: 'center' as const },
      { header: 'Empresa', width: 0, align: 'left' as const },
      { header: 'Trabalhadores', width: 30, align: 'center' as const },
    ];
    const compFixedW = compCols.reduce((s, c) => s + c.width, 0);
    const compNameW = availableWidth - compFixedW;
    const compWidths = compCols.map(c => c.width || compNameW);

    doc.setFillColor(...CLR.headerBg);
    doc.rect(MARGIN, y, availableWidth, 7, 'F');
    doc.setTextColor(...CLR.white);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    cx = MARGIN;
    compCols.forEach((col, i) => {
      const tx = col.align === 'center' ? cx + compWidths[i] / 2 : cx + 2;
      doc.text(col.header, tx, y + 5, { align: col.align === 'center' ? 'center' : 'left' });
      cx += compWidths[i];
    });
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    opts.top10Companies.forEach((comp, ri) => {
      if (y + 6 > pageHeight - 20) { doc.addPage(); y = 18; }
      if (ri % 2 === 0) {
        doc.setFillColor(...CLR.altRowBg);
        doc.rect(MARGIN, y, availableWidth, 6, 'F');
      }
      doc.setTextColor(...CLR.dark);
      doc.text(String(ri + 1), MARGIN + 5, y + 4, { align: 'center' });
      doc.text(comp.name, MARGIN + 10 + 2, y + 4);
      doc.text(String(comp.workers), MARGIN + 10 + compNameW + 15, y + 4, { align: 'center' });
      y += 6;
    });
    y += 6;
  }

  // --- Job functions table ---
  if (opts.jobFunctionData.length > 0) {
    if (y + 20 > pageHeight - 20) { doc.addPage(); y = 18; }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CLR.dark);
    doc.text('Distribuição por Cargo/Função', MARGIN, y + 1);
    y += 6;

    doc.setFillColor(...CLR.headerBg);
    doc.rect(MARGIN, y, availableWidth, 7, 'F');
    doc.setTextColor(...CLR.white);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Cargo', MARGIN + 2, y + 5);
    doc.text('Acessos', MARGIN + availableWidth - 15, y + 5, { align: 'center' });
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    opts.jobFunctionData.forEach((row, ri) => {
      if (y + 6 > pageHeight - 20) { doc.addPage(); y = 18; }
      if (ri % 2 === 0) {
        doc.setFillColor(...CLR.altRowBg);
        doc.rect(MARGIN, y, availableWidth, 6, 'F');
      }
      doc.setTextColor(...CLR.dark);
      doc.text(row.cargo, MARGIN + 2, y + 4);
      doc.text(String(row.acessos), MARGIN + availableWidth - 15, y + 4, { align: 'center' });
      y += 6;
    });
  }

  // --- Footers ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...CLR.light);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, MARGIN, pageHeight - 8);
  }

  doc.save(`visao-geral-${opts.startDate}-${opts.endDate}.pdf`);
}
