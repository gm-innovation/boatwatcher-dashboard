import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
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

  data.forEach((row, rowIndex) => {
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 15;
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y, availableWidth, 6, 'F');
    }

    doc.setTextColor(40);
    x = margin;
    columns.forEach((col, i) => {
      const value = String(row[col.key] ?? '-');
      const textX = col.align === 'center' ? x + colWidths[i] / 2 : col.align === 'right' ? x + colWidths[i] - 2 : x + 2;
      const align = col.align || 'left';
      const truncated = doc.getTextWidth(value) > colWidths[i] - 4 
        ? value.substring(0, Math.floor((colWidths[i] - 8) / 2)) + '...' 
        : value;
      doc.text(truncated, textX, y + 4, { align });
      x += colWidths[i];
    });
    y += 6;
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
