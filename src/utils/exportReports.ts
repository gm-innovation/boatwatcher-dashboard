
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
      doc.addImage(inmetaLogoData, 'PNG', margin, yPosition, 40, 15);
    } catch (logoError) {
      console.error('Failed to load Inmeta logo:', logoError);
      // Continue without the logo
    }

    // Add client logo if available
    if (clientLogoUrl) {
      try {
        const clientLogoData = await loadImage(clientLogoUrl);
        doc.addImage(clientLogoData, 'PNG', pageWidth - 60, yPosition, 40, 15);
      } catch (clientLogoError) {
        console.error('Failed to load client logo:', clientLogoError);
        // Continue without the client logo
      }
    }

    yPosition += 25;

    // Title
    doc.setFontSize(16);
    doc.text('Relatório de Acessos', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    
    // Project information
    doc.setFontSize(12);
    const projectText = `Projeto: ${projectName || 'Sem nome'}`;
    const dateText = `Data: ${format(new Date(selectedDate), 'dd/MM/yyyy')}`;
    doc.text(projectText, margin, yPosition);
    doc.text(dateText, pageWidth - margin, yPosition, { align: 'right' });
    
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
      
      const companyName = company.name || 'Sem nome';
      const workersCount = `${company.workers.length} trabalhadores`;
      const durationText = `Permanência: ${formatDuration(company.duration)}`;
      
      doc.text(companyName, margin + 5, yPosition + 7);
      doc.text(workersCount, margin + 5, yPosition + 15);
      doc.text(durationText, pageWidth - margin - 50, yPosition + 15);
      
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

        const workerName = worker.name || 'Sem nome';
        const workerRole = worker.role || 'Sem cargo';
        const entryTime = format(worker.firstEntry, 'HH:mm');
        const exitTime = format(worker.lastExit, 'HH:mm');

        doc.text(workerName, margin + 5, yPosition);
        doc.text(workerRole, margin + 60, yPosition);
        doc.text(entryTime, margin + 120, yPosition);
        doc.text(exitTime, margin + 150, yPosition);
        
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
