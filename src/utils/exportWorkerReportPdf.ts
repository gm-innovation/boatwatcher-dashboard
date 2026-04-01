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

interface StandardPdfOptions {
  rows: WorkerRow[];
  grouped: [string, WorkerRow[]][];
  startDate: string;
  endDate: string;
  projectName?: string;
}

interface DetailedPdfOptions extends StandardPdfOptions {}

const MARGIN = 14;
const COLORS = {
  dark: [40, 40, 40] as const,
  medium: [100, 100, 100] as const,
  light: [160, 160, 160] as const,
  white: [255, 255, 255] as const,
  headerBg: [50, 50, 50] as const,
  altRowBg: [248, 248, 248] as const,
  summaryBg: [245, 245, 245] as const,
  companyBg: [230, 240, 255] as const,
  entryBg: [220, 252, 231] as const,
  exitBg: [255, 237, 213] as const,
  onBoardBg: [220, 252, 231] as const,
};

function formatTime(date: Date | null): string {
  if (!date) return '-';
  return format(date, 'dd/MM HH:mm');
}

function formatDuration(mins: number): string {
  if (mins <= 0) return '-';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
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

function drawHeader(doc: jsPDF, title: string, startDate: string, endDate: string, projectName?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(title, MARGIN, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.medium);
  const period = `Período: ${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`;
  doc.text(period, MARGIN, y);
  if (projectName) {
    doc.text(`Projeto: ${projectName}`, pageWidth - MARGIN, y, { align: 'right' });
  }
  y += 10;

  return y;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 16) {
    doc.addPage();
    return 18;
  }
  return y;
}

/* ═══════════════════════════════════════════════════
   PDF PADRÃO — Tabela resumida landscape
   ═══════════════════════════════════════════════════ */

export function exportStandardWorkerPdf({ rows, grouped, startDate, endDate, projectName }: StandardPdfOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - MARGIN * 2;

  let y = drawHeader(doc, 'Relatório de Trabalhadores', startDate, endDate, projectName);

  // Summary box
  const onBoard = rows.filter(r => r.isOnBoard).length;
  const companiesCount = new Set(rows.map(r => r.companyName)).size;
  doc.setFillColor(...COLORS.summaryBg);
  doc.roundedRect(MARGIN, y - 2, availableWidth, 10, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${rows.length} trabalhadores`, MARGIN + 4, y + 5);
  doc.text(`A bordo: ${onBoard}`, MARGIN + 70, y + 5);
  doc.text(`Empresas: ${companiesCount}`, MARGIN + 120, y + 5);
  y += 14;

  // Column definitions
  const cols = [
    { header: 'Nº', width: 12, align: 'center' as const },
    { header: 'Nome', width: 0, align: 'left' as const },
    { header: 'CPF', width: 30, align: 'center' as const },
    { header: 'Função', width: 35, align: 'left' as const },
    { header: 'Empresa', width: 45, align: 'left' as const },
    { header: 'Entrada', width: 28, align: 'center' as const },
    { header: 'Saída', width: 28, align: 'center' as const },
    { header: 'Total', width: 22, align: 'center' as const },
  ];
  const fixedWidth = cols.reduce((s, c) => s + c.width, 0);
  const nameWidth = availableWidth - fixedWidth;
  const colWidths = cols.map(c => c.width || nameWidth);

  const drawTableHeader = () => {
    doc.setFillColor(...COLORS.headerBg);
    doc.rect(MARGIN, y, availableWidth, 7, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    let x = MARGIN;
    cols.forEach((col, i) => {
      const tx = col.align === 'center' ? x + colWidths[i] / 2 : x + 2;
      doc.text(col.header, tx, y + 5, { align: col.align === 'center' ? 'center' : 'left' });
      x += colWidths[i];
    });
    y += 7;
  };

  let rowNum = 0;

  grouped.forEach(([companyName, companyRows]) => {
    y = checkPageBreak(doc, y, 14);

    // Company group header
    doc.setFillColor(...COLORS.companyBg);
    doc.rect(MARGIN, y, availableWidth, 7, 'F');
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${companyName} (${companyRows.length})`, MARGIN + 3, y + 5);
    y += 8;

    // Table header after each company
    drawTableHeader();

    companyRows.forEach((row, ri) => {
      y = checkPageBreak(doc, y, 7);
      if (y <= 18) drawTableHeader(); // re-draw header on new page

      rowNum++;
      if (ri % 2 === 0) {
        doc.setFillColor(...COLORS.altRowBg);
        doc.rect(MARGIN, y, availableWidth, 6, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.dark);

      const values = [
        String(rowNum),
        row.workerName + (row.isOnBoard ? ' *' : ''),
        row.documentNumber || '-',
        row.role,
        row.companyName,
        formatTime(row.firstEntry),
        row.isOnBoard ? 'A bordo' : formatTime(row.lastExit),
        formatDuration(row.totalMinutes),
      ];

      let x = MARGIN;
      cols.forEach((col, i) => {
        const tx = col.align === 'center' ? x + colWidths[i] / 2 : x + 2;
        const maxW = colWidths[i] - 4;
        let val = values[i];
        if (doc.getTextWidth(val) > maxW) {
          while (doc.getTextWidth(val + '…') > maxW && val.length > 1) val = val.slice(0, -1);
          val += '…';
        }
        doc.text(val, tx, y + 4, { align: col.align === 'center' ? 'center' : 'left' });
        x += colWidths[i];
      });
      y += 6;
    });

    y += 3;
  });

  // Legend
  y = checkPageBreak(doc, y, 10);
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.light);
  doc.text('(*) Trabalhador atualmente a bordo — sem saída registrada.', MARGIN, y + 4);
  doc.text('Total = Última saída − Primeira entrada (tempo bruto, sem descontar ausências).', MARGIN, y + 9);

  addFooters(doc);
  doc.save(`trabalhadores-padrao-${startDate}-${endDate}.pdf`);
}

/* ═══════════════════════════════════════════════════
   PDF DETALHADO — Ficha individual por trabalhador
   ═══════════════════════════════════════════════════ */

export function exportDetailedWorkerPdf({ rows, grouped, startDate, endDate, projectName }: DetailedPdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - MARGIN * 2;

  let y = drawHeader(doc, 'Relatório Detalhado de Trabalhadores', startDate, endDate, projectName);

  // Summary
  const onBoard = rows.filter(r => r.isOnBoard).length;
  doc.setFillColor(...COLORS.summaryBg);
  doc.roundedRect(MARGIN, y - 2, availableWidth, 10, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${rows.length} trabalhadores`, MARGIN + 4, y + 5);
  doc.text(`A bordo: ${onBoard}`, MARGIN + 70, y + 5);
  y += 14;

  let workerNum = 0;

  grouped.forEach(([companyName, companyRows]) => {
    companyRows.forEach((row) => {
      workerNum++;

      // Estimate space needed for this worker
      const eventsHeight = 7 + row.rawLogs.length * 5.5 + 10;
      const headerHeight = 30;
      const totalNeeded = headerHeight + eventsHeight + 15;

      // If won't fit, start new page
      if (y + Math.min(totalNeeded, 80) > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 18;
      }

      // Worker header box
      doc.setFillColor(...COLORS.companyBg);
      doc.roundedRect(MARGIN, y, availableWidth, 22, 1, 1, 'F');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text(`${workerNum}. ${row.workerName}`, MARGIN + 3, y + 6);

      if (row.isOnBoard) {
        doc.setFillColor(...COLORS.onBoardBg);
        const badge = 'A BORDO';
        const bw = doc.getTextWidth(badge) + 6;
        doc.roundedRect(pageWidth - MARGIN - bw - 2, y + 1.5, bw, 6, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text(badge, pageWidth - MARGIN - bw / 2, y + 5.5, { align: 'center' });
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.medium);

      const infoY = y + 11;
      doc.text(`CPF: ${row.documentNumber || '-'}`, MARGIN + 3, infoY);
      doc.text(`Função: ${row.role}`, MARGIN + 55, infoY);
      doc.text(`Empresa: ${row.companyName}`, MARGIN + 3, infoY + 5);
      if (row.workerCode) {
        doc.text(`Cód: ${row.workerCode}`, MARGIN + 120, infoY);
      }

      y += 25;

      // Time summary line
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text(`Entrada: ${formatTime(row.firstEntry)}`, MARGIN + 3, y);
      doc.text(`Saída: ${row.isOnBoard ? 'A bordo' : formatTime(row.lastExit)}`, MARGIN + 50, y);
      doc.text(`Tempo bruto: ${formatDuration(row.totalMinutes)}`, MARGIN + 100, y);
      doc.text(`Tempo efetivo: ${formatDuration(row.effectiveMinutes)}`, MARGIN + 145, y);
      y += 6;

      // Events table
      if (row.rawLogs.length > 0) {
        // Events header
        const evCols = [
          { header: 'Data/Hora', width: 45, align: 'left' as const },
          { header: 'Evento', width: 30, align: 'center' as const },
          { header: 'Dispositivo', width: 0, align: 'left' as const },
        ];
        const evFixedW = evCols.reduce((s, c) => s + c.width, 0);
        const evAutoW = availableWidth - evFixedW;
        const evWidths = evCols.map(c => c.width || evAutoW);

        y = checkPageBreak(doc, y, 8);
        doc.setFillColor(...COLORS.headerBg);
        doc.rect(MARGIN, y, availableWidth, 6, 'F');
        doc.setTextColor(...COLORS.white);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        let x = MARGIN;
        evCols.forEach((col, i) => {
          const tx = col.align === 'center' ? x + evWidths[i] / 2 : x + 2;
          doc.text(col.header, tx, y + 4, { align: col.align === 'center' ? 'center' : 'left' });
          x += evWidths[i];
        });
        y += 6;

        row.rawLogs.forEach((log, li) => {
          y = checkPageBreak(doc, y, 6);

          const isEntry = log.direction === 'entry';

          if (li % 2 === 0) {
            doc.setFillColor(...COLORS.altRowBg);
            doc.rect(MARGIN, y, availableWidth, 5.5, 'F');
          }

          // Small colored indicator
          if (isEntry) {
            doc.setFillColor(...COLORS.entryBg);
          } else {
            doc.setFillColor(...COLORS.exitBg);
          }
          doc.rect(MARGIN, y, 2, 5.5, 'F');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...COLORS.dark);

          const dateStr = format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss');
          const eventStr = isEntry ? 'ENTRADA' : 'SAÍDA';
          const deviceStr = log.device_name || '-';

          let x = MARGIN;
          doc.text(dateStr, x + 4, y + 4);
          x += evWidths[0];

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(isEntry ? 22 : 194, isEntry ? 163 : 120, isEntry ? 74 : 47);
          doc.text(eventStr, x + evWidths[1] / 2, y + 4, { align: 'center' });
          x += evWidths[1];

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.medium);
          doc.text(deviceStr, x + 2, y + 4);

          y += 5.5;
        });
      } else {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.light);
        doc.text('Nenhum registro de acesso no período.', MARGIN + 3, y + 3);
        y += 8;
      }

      y += 8; // spacing between workers

      // Separator line
      doc.setDrawColor(...COLORS.light);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y - 4, pageWidth - MARGIN, y - 4);
    });
  });

  // Legend
  y = checkPageBreak(doc, y, 14);
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.light);
  doc.text('Tempo bruto = Última saída − Primeira entrada.', MARGIN, y + 2);
  doc.text('Tempo efetivo = Soma dos pares entrada→saída individuais (desconta ausências).', MARGIN, y + 7);

  addFooters(doc);
  doc.save(`trabalhadores-detalhado-${startDate}-${endDate}.pdf`);
}
