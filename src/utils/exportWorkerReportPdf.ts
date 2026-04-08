import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RawLog {
  direction: string;
  device_name: string;
  timestamp: string;
}

interface WorkerRow {
  workerId: string;
  workerName: string;
  workerCode?: number;
  documentNumber: string;
  role: string;
  companyId: string;
  companyName: string;
  firstEntry: Date | null;
  lastExit: Date | null;
  totalMinutes: number;
  effectiveMinutes: number;
  isOnBoard: boolean;
  rawLogs: RawLog[];
}

interface PdfOptions {
  rows: WorkerRow[];
  startDate: string;
  endDate: string;
  projectName?: string;
  projectLocation?: string;
  clientLogoDataUrl?: string;
  systemLogoDataUrl?: string;
}

const MARGIN = 14;
const COLORS = {
  dark: [40, 40, 40] as const,
  medium: [100, 100, 100] as const,
  light: [160, 160, 160] as const,
  white: [255, 255, 255] as const,
  headerBg: [50, 50, 50] as const,
  altRowBg: [248, 248, 248] as const,
  summaryBg: [240, 245, 250] as const,
  sectionBg: [235, 245, 255] as const,
  entryColor: [22, 163, 74] as const,
  exitColor: [194, 120, 47] as const,
  onBoardBg: [220, 252, 231] as const,
  separator: [180, 200, 220] as const,
};

function formatTime(date: Date | null): string {
  if (!date) return '-';
  return format(date, 'dd/MM/yyyy HH:mm');
}

function formatTimeShort(date: Date | null): string {
  if (!date) return '-';
  return format(date, 'dd/MM HH:mm');
}

function formatDuration(mins: number): string {
  if (mins <= 0) return '-';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function isDaytime(timestamp: string): boolean {
  const hour = new Date(timestamp).getHours();
  return hour >= 5 && hour <= 18;
}

function classifyShift(row: WorkerRow): 'day' | 'night' {
  if (!row.firstEntry) return 'day';
  const hour = row.firstEntry.getHours();
  return (hour >= 5 && hour <= 18) ? 'day' : 'night';
}

function classifyLogs(rawLogs: RawLog[]) {
  const day: RawLog[] = [];
  const night: RawLog[] = [];
  for (const log of rawLogs) {
    if (isDaytime(log.timestamp)) day.push(log);
    else night.push(log);
  }
  return { day, night };
}

function addFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.light);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, MARGIN, pageHeight - 8);
  }
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 16) {
    doc.addPage();
    return 18;
  }
  return y;
}

async function drawLogos(doc: jsPDF, clientLogo?: string, systemLogo?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoMaxW = 40;
  const logoMaxH = 14;

  if (clientLogo) {
    try {
      const { w, h } = await fitImageDimensions(clientLogo, logoMaxW, logoMaxH);
      const yOffset = 8 + (logoMaxH - h) / 2;
      doc.addImage(clientLogo, 'PNG', MARGIN, yOffset, w, h);
    } catch {}
  }
  if (systemLogo) {
    try {
      const { w, h } = await fitImageDimensions(systemLogo, logoMaxW, logoMaxH);
      const yOffset = 8 + (logoMaxH - h) / 2;
      doc.addImage(systemLogo, 'PNG', pageWidth - MARGIN - w, yOffset, w, h);
    } catch {}
  }
}

async function drawHeader(
  doc: jsPDF,
  title: string,
  opts: PdfOptions,
  dayCount: number,
  nightCount: number,
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - MARGIN * 2;

  await drawLogos(doc, opts.clientLogoDataUrl, opts.systemLogoDataUrl);

  let y = 26;

  // Title
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Project + location
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.medium);
  const projectLine = [
    opts.projectName ? `Projeto: ${opts.projectName}` : null,
    opts.projectLocation ? `Local: ${opts.projectLocation}` : null,
  ].filter(Boolean).join(' | ');
  if (projectLine) {
    doc.text(projectLine, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // Period
  const period = `Período: ${format(new Date(opts.startDate), 'dd/MM/yyyy')} a ${format(new Date(opts.endDate), 'dd/MM/yyyy')}`;
  doc.text(period, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Summary line
  const companiesCount = new Set(opts.rows.map(r => r.companyName)).size;
  doc.setFillColor(...COLORS.summaryBg);
  doc.roundedRect(MARGIN, y - 3, availableWidth, 10, 1, 1, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  const summaryText = `Total de Trabalhadores: ${opts.rows.length} (Diurnos: ${dayCount}, Noturnos: ${nightCount})  |  Total de Empresas: ${companiesCount}`;
  doc.text(summaryText, pageWidth / 2, y + 4, { align: 'center' });
  y += 12;

  // Separator
  doc.setDrawColor(...COLORS.separator);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 4;

  // Note
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.light);
  doc.text('(*) Trabalhador com entrada registrada mas sem saída — permanência além do período ou em andamento.', MARGIN, y);
  y += 6;

  return y;
}

/* ═══════════════════════════════════════════════════
   PDF PADRÃO — Retrato, agrupado por turno
   ═══════════════════════════════════════════════════ */

export async function exportStandardWorkerPdf(opts: PdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - MARGIN * 2;

  const dayRows = opts.rows.filter(r => classifyShift(r) === 'day');
  const nightRows = opts.rows.filter(r => classifyShift(r) === 'night');

  let y = await drawHeader(doc, 'Relatório de Acesso por Trabalhador', opts, dayRows.length, nightRows.length);

  // Column definitions for portrait A4 (~182mm available)
  const cols = [
    { header: 'Nº', width: 12, align: 'center' as const },
    { header: 'Nome', width: 0, align: 'left' as const },
    { header: 'CPF', width: 26, align: 'center' as const },
    { header: 'Função', width: 28, align: 'left' as const },
    { header: 'Empresa', width: 32, align: 'left' as const },
    { header: 'Entrada', width: 24, align: 'center' as const },
    { header: 'Saída', width: 24, align: 'center' as const },
    { header: 'Total', width: 18, align: 'center' as const },
  ];
  const fixedWidth = cols.reduce((s, c) => s + c.width, 0);
  const nameWidth = availableWidth - fixedWidth;
  const colWidths = cols.map(c => c.width || nameWidth);

  const drawTableHeader = (currentY: number) => {
    doc.setFillColor(...COLORS.headerBg);
    doc.rect(MARGIN, currentY, availableWidth, 7, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    let x = MARGIN;
    cols.forEach((col, i) => {
      const tx = col.align === 'center' ? x + colWidths[i] / 2 : x + 1.5;
      doc.text(col.header, tx, currentY + 5, { align: col.align === 'center' ? 'center' : 'left' });
      x += colWidths[i];
    });
    return currentY + 7;
  };

  const drawShiftRows = (shiftRows: WorkerRow[], startY: number) => {
    let cy = startY;
    shiftRows.forEach((row, ri) => {
      cy = checkPageBreak(doc, cy, 7);
      if (cy <= 18) cy = drawTableHeader(cy);

      if (ri % 2 === 0) {
        doc.setFillColor(...COLORS.altRowBg);
        doc.rect(MARGIN, cy, availableWidth, 5.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.dark);

      const values = [
        String(row.workerCode || '-'),
        row.workerName + (row.isOnBoard ? ' (*)' : ''),
        row.documentNumber || '-',
        row.role,
        row.companyName,
        formatTimeShort(row.firstEntry),
        row.isOnBoard ? 'A bordo' : formatTimeShort(row.lastExit),
        formatDuration(row.totalMinutes),
      ];

      // Pre-calculate wrapped text for dynamic row height
      const wrappedVals = values.map((val, i) => {
        const maxW = colWidths[i] - 3;
        return doc.splitTextToSize(val, maxW) as string[];
      });
      const wMaxLines = Math.max(...wrappedVals.map(l => l.length));
      const wLineH = 3.5;
      const wRowH = Math.max(5.5, wMaxLines * wLineH + 2);

      if (ri % 2 === 0) {
        doc.setFillColor(...COLORS.altRow);
        doc.rect(MARGIN, cy, availableWidth, wRowH, 'F');
      }

      let x = MARGIN;
      cols.forEach((col, i) => {
        const tx = col.align === 'center' ? x + colWidths[i] / 2 : x + 1.5;
        const lines = wrappedVals[i];
        if (i === 6 && row.isOnBoard) {
          doc.setTextColor(...COLORS.entryColor);
          doc.setFont('helvetica', 'bold');
        }
        lines.forEach((line, li) => {
          doc.text(line, tx, cy + 4 + li * wLineH, { align: col.align === 'center' ? 'center' : 'left' });
        });
        doc.setTextColor(...COLORS.dark);
        doc.setFont('helvetica', 'normal');
        x += colWidths[i];
      });
      cy += wRowH;
    });
    return cy;
  };

  // Day shift section
  doc.setFillColor(...COLORS.sectionBg);
  doc.roundedRect(MARGIN, y, availableWidth, 7, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(`Trabalhadores - Período Diurno (05:00 - 18:59)  [${dayRows.length}]`, MARGIN + 3, y + 5);
  y += 9;

  if (dayRows.length > 0) {
    y = drawTableHeader(y);
    y = drawShiftRows(dayRows, y);
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.light);
    doc.text('Nenhum trabalhador diurno neste período.', MARGIN + 3, y + 4);
    y += 8;
  }

  y += 5;
  y = checkPageBreak(doc, y, 25);

  // Night shift section
  doc.setFillColor(...COLORS.sectionBg);
  doc.roundedRect(MARGIN, y, availableWidth, 7, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(`Trabalhadores - Período Noturno (19:00 - 04:59)  [${nightRows.length}]`, MARGIN + 3, y + 5);
  y += 9;

  if (nightRows.length > 0) {
    y = drawTableHeader(y);
    y = drawShiftRows(nightRows, y);
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.light);
    doc.text('Nenhum trabalhador noturno neste período.', MARGIN + 3, y + 4);
    y += 8;
  }

  addFooters(doc);
  doc.save(`trabalhadores-padrao-${opts.startDate}-${opts.endDate}.pdf`);
}

/* ═══════════════════════════════════════════════════
   PDF DETALHADO — Retrato, ficha por trabalhador
   ═══════════════════════════════════════════════════ */

export async function exportDetailedWorkerPdf(opts: PdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - MARGIN * 2;

  const dayRows = opts.rows.filter(r => classifyShift(r) === 'day');
  const nightRows = opts.rows.filter(r => classifyShift(r) === 'night');

  let y = await drawHeader(doc, 'Relatório de Controle de Acessos de Colaboradores', opts, dayRows.length, nightRows.length);

  opts.rows.forEach((row, idx) => {
    // Estimate space
    const { day, night } = classifyLogs(row.rawLogs);
    const logsHeight = 20 + Math.max(day.length, 1) * 5 + Math.max(night.length, 1) * 5 + 30;
    const needed = Math.min(logsHeight, 80);

    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 18;
    }

    // Separator
    if (idx > 0) {
      doc.setDrawColor(...COLORS.separator);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y, pageWidth - MARGIN, y);
      y += 4;
    }

    // Worker header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(`Trabalhador: ${row.workerName} (Nº: ${row.workerCode || '-'})`, MARGIN, y);

    if (row.isOnBoard) {
      const badge = '(*)';
      doc.setTextColor(...COLORS.entryColor);
      doc.text(badge, MARGIN + doc.getTextWidth(`Trabalhador: ${row.workerName} (Nº: ${row.workerCode || '-'})`) + 3, y);
    }
    y += 5;

    // Worker info line
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.medium);
    doc.text(`CPF: ${row.documentNumber || '-'}  |  Função: ${row.role}  |  Empresa: ${row.companyName}`, MARGIN, y);
    y += 6;

    // Summary stats
    doc.setFillColor(...COLORS.summaryBg);
    doc.roundedRect(MARGIN, y - 2, availableWidth, 12, 1, 1, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);

    const col1 = MARGIN + 3;
    const col2 = MARGIN + availableWidth / 4;
    const col3 = MARGIN + availableWidth / 2;
    const col4 = MARGIN + (3 * availableWidth) / 4;

    doc.text(`Primeira Entrada:`, col1, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.text(formatTime(row.firstEntry), col1, y + 7.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`Status ao Final:`, col2, y + 3);
    doc.setFont('helvetica', 'normal');
    if (row.isOnBoard) {
      doc.setTextColor(...COLORS.entryColor);
      doc.text('A bordo (*)', col2, y + 7.5);
      doc.setTextColor(...COLORS.dark);
    } else {
      doc.text(formatTime(row.lastExit), col2, y + 7.5);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`Tempo Total:`, col3, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDuration(row.totalMinutes), col3, y + 7.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`Tempo Efetivo:`, col4, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDuration(row.effectiveMinutes), col4, y + 7.5);

    y += 14;

    // Draw log tables for day and night
    const drawPeriodLogs = (periodTitle: string, logs: RawLog[], startY: number): number => {
      let cy = checkPageBreak(doc, startY, 12);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text(periodTitle, MARGIN, cy);
      cy += 4;

      if (logs.length === 0) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.light);
        doc.text('Nenhum registro neste período.', MARGIN + 3, cy + 3);
        return cy + 7;
      }

      // Mini header
      doc.setFillColor(...COLORS.headerBg);
      doc.rect(MARGIN, cy, availableWidth, 5.5, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Data/Hora', MARGIN + 2, cy + 4);
      doc.text('Evento', MARGIN + 50, cy + 4);
      doc.text('Dispositivo', MARGIN + 80, cy + 4);
      cy += 5.5;

      logs.forEach((log, li) => {
        cy = checkPageBreak(doc, cy, 5);

        if (li % 2 === 0) {
          doc.setFillColor(...COLORS.altRowBg);
          doc.rect(MARGIN, cy, availableWidth, 4.5, 'F');
        }

        const isEntry = log.direction === 'entry';

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...COLORS.dark);

        doc.text(format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss'), MARGIN + 2, cy + 3.5);

        if (isEntry) {
          doc.setTextColor(...COLORS.entryColor);
        } else {
          doc.setTextColor(...COLORS.exitColor);
        }
        doc.setFont('helvetica', 'bold');
        doc.text(isEntry ? 'ENTRADA' : 'SAÍDA', MARGIN + 50, cy + 3.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.medium);
        doc.text(log.device_name || '-', MARGIN + 80, cy + 3.5);

        cy += 4.5;
      });

      return cy + 2;
    };

    y = drawPeriodLogs(`Registros Diurnos (05:00 - 18:59)  [${day.length}]`, day, y);
    y = drawPeriodLogs(`Registros Noturnos (19:00 - 04:59)  [${night.length}]`, night, y);

    y += 4;
  });

  addFooters(doc);
  doc.save(`trabalhadores-detalhado-${opts.startDate}-${opts.endDate}.pdf`);
}

/* ═══════════════════════════════════════════════════
   PDF TODOS OS TRABALHADORES — Lista deduplicada
   ═══════════════════════════════════════════════════ */

interface AllWorkersWorker {
  code: number | null;
  name: string;
  companyName: string;
  document: string;
  jobFunction: string;
}

interface AllWorkersReportOptions {
  workers: AllWorkersWorker[];
  startDate: string;
  endDate: string;
  projectName?: string;
  projectLocation?: string;
  clientLogoDataUrl?: string;
  systemLogoDataUrl?: string;
}

export async function exportAllWorkersReportPdf(opts: AllWorkersReportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - MARGIN * 2;

  await drawLogos(doc, opts.clientLogoDataUrl, opts.systemLogoDataUrl);

  let y = 26;

  // Title
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Relatório de Todos os Trabalhadores Registrados', pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Project + location
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.medium);
  const projectLine = [
    opts.projectName ? `Projeto: ${opts.projectName}` : null,
    opts.projectLocation ? `Local: ${opts.projectLocation}` : null,
  ].filter(Boolean).join(' | ');
  if (projectLine) {
    doc.text(projectLine, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // Period
  const period = `Período: ${format(new Date(opts.startDate), 'dd/MM/yyyy')} a ${format(new Date(opts.endDate), 'dd/MM/yyyy')}`;
  doc.text(period, pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Generated at
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.light);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Summary bar
  const companiesCount = new Set(opts.workers.map(w => w.companyName)).size;
  doc.setFillColor(...COLORS.summaryBg);
  doc.roundedRect(MARGIN, y - 3, availableWidth, 10, 1, 1, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  const summaryText = `Total de Trabalhadores: ${opts.workers.length}  |  Total de Empresas: ${companiesCount}`;
  doc.text(summaryText, pageWidth / 2, y + 4, { align: 'center' });
  y += 12;

  // Separator
  doc.setDrawColor(...COLORS.separator);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 4;

  // Group by company
  const grouped = new Map<string, AllWorkersWorker[]>();
  for (const w of opts.workers) {
    const key = w.companyName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(w);
  }
  // Sort groups alphabetically
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // Column defs
  const cols = [
    { header: 'Nº', width: 14, align: 'center' as const },
    { header: 'Nome', width: 0, align: 'left' as const },
    { header: 'Empresa', width: 38, align: 'left' as const },
    { header: 'CPF', width: 30, align: 'center' as const },
    { header: 'Função', width: 34, align: 'left' as const },
  ];
  const fixedWidth = cols.reduce((s, c) => s + c.width, 0);
  const nameWidth = availableWidth - fixedWidth;
  const colWidths = cols.map(c => c.width || nameWidth);

  const drawTableHeader = (currentY: number) => {
    doc.setFillColor(...COLORS.headerBg);
    doc.rect(MARGIN, currentY, availableWidth, 7, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    let x = MARGIN;
    cols.forEach((col, i) => {
      const tx = col.align === 'center' ? x + colWidths[i] / 2 : x + 1.5;
      doc.text(col.header, tx, currentY + 5, { align: col.align === 'center' ? 'center' : 'left' });
      x += colWidths[i];
    });
    return currentY + 7;
  };

  for (const [companyName, companyWorkers] of sortedGroups) {
    // Company section header
    y = checkPageBreak(doc, y, 20);
    if (y <= 18) y = 18;

    doc.setFillColor(...COLORS.sectionBg);
    doc.roundedRect(MARGIN, y, availableWidth, 7, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(`${companyName}  [${companyWorkers.length}]`, MARGIN + 3, y + 5);
    y += 9;

    y = drawTableHeader(y);

    companyWorkers.sort((a, b) => (a.code ?? 9999) - (b.code ?? 9999));

    companyWorkers.forEach((worker, ri) => {
      y = checkPageBreak(doc, y, 7);
      if (y <= 18) y = drawTableHeader(y);

      if (ri % 2 === 0) {
        doc.setFillColor(...COLORS.altRowBg);
        doc.rect(MARGIN, y, availableWidth, 5.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.dark);

      const values = [
        String(worker.code || '-'),
        worker.name,
        worker.companyName,
        worker.document || '-',
        worker.jobFunction,
      ];

      let x = MARGIN;
      cols.forEach((col, i) => {
        const tx = col.align === 'center' ? x + colWidths[i] / 2 : x + 1.5;
        const maxW = colWidths[i] - 3;
        let val = values[i];
        if (doc.getTextWidth(val) > maxW) {
          while (doc.getTextWidth(val + '…') > maxW && val.length > 1) val = val.slice(0, -1);
          val += '…';
        }
        doc.text(val, tx, y + 4, { align: col.align === 'center' ? 'center' : 'left' });
        x += colWidths[i];
      });
      y += 5.5;
    });

    y += 4;
  }

  addFooters(doc);
  doc.save(`todos-trabalhadores-${opts.startDate}-${opts.endDate}.pdf`);
}

/* ═══════════════════════════════════════════════════
   Utilitário: carregar imagem como data URL (CORS-safe)
   ═══════════════════════════════════════════════════ */

export async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Calculate dimensions that fit inside a bounding box while preserving aspect ratio.
 */
export function fitImageDimensions(
  dataUrl: string,
  maxW: number,
  maxH: number
): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      resolve({ w: img.naturalWidth * ratio, h: img.naturalHeight * ratio });
    };
    img.onerror = () => resolve({ w: maxW, h: maxH });
    img.src = dataUrl;
  });
}

