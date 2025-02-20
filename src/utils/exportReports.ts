
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
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
    // Load logos
    const inmetaLogoUrl = '/lovable-uploads/f59c0f54-3c10-436f-a3a4-3d578d4e34ca.png';
    const inmetaLogoData = await loadImage(inmetaLogoUrl);
    
    // Add Inmeta logo (left)
    doc.addImage(inmetaLogoData, 'PNG', margin, yPosition, 40, 15);

    // Add client logo (right) if available
    if (clientLogoUrl) {
      const clientLogoData = await loadImage(clientLogoUrl);
      doc.addImage(clientLogoData, 'PNG', pageWidth - 60, yPosition, 40, 15);
    }

    yPosition += 25;

    // Title
    doc.setFontSize(16);
    doc.text('Relatório de Acessos', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    
    // Project information
    doc.setFontSize(12);
    doc.text(`Projeto: ${projectName}`, margin, yPosition);
    doc.text(`Data: ${format(new Date(selectedDate), 'dd/MM/yyyy')}`, pageWidth - margin, yPosition, { align: 'right' });
    
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
      doc.text(company.name, margin + 5, yPosition + 7);
      doc.text(`${company.workers.length} trabalhadores`, margin + 5, yPosition + 15);
      doc.text(`Permanência: ${formatDuration(company.duration)}`, pageWidth - margin - 50, yPosition + 15);
      
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

        doc.text(worker.name, margin + 5, yPosition);
        doc.text(worker.role, margin + 60, yPosition);
        doc.text(format(worker.firstEntry, 'HH:mm'), margin + 120, yPosition);
        doc.text(format(worker.lastExit, 'HH:mm'), margin + 150, yPosition);
        
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
        format(worker.firstEntry, 'HH:mm'),
        format(worker.lastExit, 'HH:mm')
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, company.name.slice(0, 31));
  });

  XLSX.writeFile(workbook, `relatorio-acessos-${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
};
