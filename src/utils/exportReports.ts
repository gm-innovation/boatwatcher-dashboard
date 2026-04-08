
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AccessLog } from '@/types/supabase';
import { fitImageDimensions } from './exportWorkerReportPdf';
import { formatBrtTime, formatBrtShort, formatBrtDateTime, formatBrtDateTimeFull } from '@/utils/brt';

interface WorkerData {
  name: string;
  role: string;
  firstEntry: Date;
  lastExit: Date;
}

interface CompanyData {
  name: string;
  workers: WorkerData[];
  firstEntry: Date;
  lastExit: Date;
  duration: number;
}

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h${remainingMinutes}min`;
};

const loadImage = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';  // This is important for CORS
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (e) {
        reject(new Error('Failed to convert image to data URL'));
      }
    };
    img.onerror = () => {
      console.error('Failed to load image:', url);
      reject(new Error('Could not load image'));
    };
    // Append timestamp to bypass cache
    const urlWithCache = `${url}?t=${Date.now()}`;
    img.src = urlWithCache;
  });
};

export const exportToPDF = async (
  companiesData: CompanyData[],
  projectName: string,
  selectedDate: string,
  clientLogoUrl?: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  try {
    // Use the full URL path for the Inmeta logo
    const inmetaLogoUrl = `${window.location.origin}/lovable-uploads/f59c0f54-3c10-436f-a3a4-3d578d4e34ca.png`;
    console.log('Loading Inmeta logo from:', inmetaLogoUrl);
    
    try {
      const inmetaLogoData = await loadImage(inmetaLogoUrl);
      const { w, h } = await fitImageDimensions(inmetaLogoData, 40, 15);
      const yOffset = yPosition + (15 - h) / 2;
      doc.addImage(inmetaLogoData, 'PNG', margin, yOffset, w, h);
    } catch (logoError) {
      console.error('Failed to load Inmeta logo:', logoError);
    }

    // Add client logo if available
    if (clientLogoUrl) {
      try {
        const clientLogoData = await loadImage(clientLogoUrl);
        const { w, h } = await fitImageDimensions(clientLogoData, 40, 15);
        const yOffset = yPosition + (15 - h) / 2;
        doc.addImage(clientLogoData, 'PNG', pageWidth - margin - w, yOffset, w, h);
      } catch (clientLogoError) {
        console.error('Failed to load client logo:', clientLogoError);
      }
    }

    yPosition += 25;

    // Title
    doc.setFontSize(16);
    doc.text('Relatório de Acessos', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    
    // Project information
    doc.setFontSize(12);
    doc.text(String(`Projeto: ${projectName}`), margin, yPosition);
    doc.text(String(`Data: ${format(new Date(selectedDate), 'dd/MM/yyyy')}`), pageWidth - margin, yPosition, { align: 'right' });
    
    yPosition += 10;

    // Company data
    companiesData.forEach(company => {
      // Check if need new page
      if (yPosition > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPosition = margin;
      }

      // Company header
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition, pageWidth - (2 * margin), 20, 'F');
      doc.setFontSize(12);
      doc.text(String(company.name || 'Sem nome'), margin + 5, yPosition + 7);
      doc.text(String(`${company.workers.length} trabalhadores`), margin + 5, yPosition + 15);
      doc.text(String(`Permanência: ${formatDuration(company.duration)}`), pageWidth - margin - 50, yPosition + 15);
      
      yPosition += 25;

      // Table header
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPosition, pageWidth - (2 * margin), 10, 'F');
      doc.setFontSize(10);
      doc.text('Nome', margin + 5, yPosition + 7);
      doc.text('Cargo', margin + 60, yPosition + 7);
      doc.text('Entrada', margin + 120, yPosition + 7);
      doc.text('Saída', margin + 150, yPosition + 7);
      
      yPosition += 15;

      // Workers data
      company.workers.forEach(worker => {
        if (yPosition > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPosition = margin;
        }

        doc.text(String(worker.name || 'Sem nome'), margin + 5, yPosition);
        doc.text(String(worker.role || 'Sem cargo'), margin + 60, yPosition);
        doc.text(formatBrtTime(worker.firstEntry), margin + 120, yPosition);
        doc.text(formatBrtTime(worker.lastExit), margin + 150, yPosition);
        
        yPosition += 10;
      });

      yPosition += 10;
    });

    doc.save(`relatorio-acessos-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const exportToExcel = (
  companiesData: CompanyData[],
  projectName: string,
  selectedDate: string
) => {
  const workbook = XLSX.utils.book_new();
  
  companiesData.forEach(company => {
    const worksheetData = [
      [`Empresa: ${company.name}`],
      [`Total de trabalhadores: ${company.workers.length}`],
      [`Permanência total: ${formatDuration(company.duration)}`],
      [],
      ['Nome', 'Cargo', 'Entrada', 'Saída']
    ];

    company.workers.forEach(worker => {
      worksheetData.push([
        worker.name,
        worker.role,
        formatBrtTime(worker.firstEntry),
        formatBrtTime(worker.lastExit)
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, company.name.slice(0, 31));
  });

  XLSX.writeFile(workbook, `relatorio-acessos-${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
};

// New functions for AccessLog export
export const exportAccessLogsToPdf = async (
  logs: AccessLog[],
  projectName: string,
  startDate: string,
  endDate: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  doc.setFontSize(16);
  doc.text('Relatório de Acessos', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(12);
  doc.text(`Projeto: ${projectName}`, margin, yPosition);
  doc.text(`Período: ${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 15;

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition, pageWidth - (2 * margin), 10, 'F');
  doc.setFontSize(9);
  doc.text('Data/Hora', margin + 2, yPosition + 7);
  doc.text('Trabalhador', margin + 35, yPosition + 7);
  doc.text('CPF', margin + 80, yPosition + 7);
  doc.text('Status', margin + 115, yPosition + 7);
  doc.text('Motivo', margin + 140, yPosition + 7);
  yPosition += 15;

  logs.forEach(log => {
    if (yPosition > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(8);
    doc.text(formatBrtShort(new Date(log.timestamp)), margin + 2, yPosition);
    doc.text((log.worker_name || '-').slice(0, 20), margin + 35, yPosition);
    doc.text(log.worker_document || '-', margin + 80, yPosition);
    doc.text(log.access_status === 'granted' ? 'Liberado' : 'Negado', margin + 115, yPosition);
    doc.text((log.reason || '-').slice(0, 20), margin + 140, yPosition);
    yPosition += 8;
  });

  doc.save(`relatorio-acessos-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
};

export const exportAccessLogsToExcel = (
  logs: AccessLog[],
  projectName: string,
  startDate: string,
  endDate: string
) => {
  const worksheetData = [
    [`Relatório de Acessos - ${projectName}`],
    [`Período: ${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`],
    [],
    ['Data/Hora', 'Trabalhador', 'CPF', 'Dispositivo', 'Direção', 'Status', 'Motivo', 'Score']
  ];

  logs.forEach(log => {
    worksheetData.push([
      formatBrtDateTimeFull(log.timestamp),
      log.worker_name || '-',
      log.worker_document || '-',
      log.device_name || '-',
      log.direction === 'entry' ? 'Entrada' : log.direction === 'exit' ? 'Saída' : '-',
      log.access_status === 'granted' ? 'Liberado' : 'Negado',
      log.reason || '-',
      log.score?.toString() || '-'
    ]);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Acessos');
  XLSX.writeFile(workbook, `relatorio-acessos-${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
};
