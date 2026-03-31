import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { useResolvedUrl } from '@/hooks/useResolvedUrl';
import { Printer } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

interface BadgePrinterProps {
  worker: {
    name: string;
    document_number?: string | null;
    photo_url?: string | null;
    role?: string | null;
    code?: number;
  };
  companyName?: string;
  jobFunctionName?: string;
}

export function BadgePrinter({ worker, companyName, jobFunctionName }: BadgePrinterProps) {
  const resolvedPhotoUrl = useResolvedUrl(worker.photo_url);

  const handlePrint = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [86, 54] });

    // Generate QR Code as data URL
    let qrDataUrl: string | null = null;
    if (worker.code) {
      try {
        const { QRCodeCanvas } = await import('qrcode.react');
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
          root.render(<QRCodeCanvas value={String(worker.code)} size={128} />);
        });
        const canvas = container.querySelector('canvas');
        if (canvas) qrDataUrl = canvas.toDataURL('image/png');
        root.unmount();
        document.body.removeChild(container);
      } catch {}
    }

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 86, 54, 'F');

    // Header bar
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 86, 12, 'F');
    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName || 'IDENTIFICAÇÃO', 43, 7, { align: 'center' });

    // Photo placeholder
    if (resolvedPhotoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = resolvedPhotoUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        doc.addImage(img, 'JPEG', 4, 15, 20, 24);
      } catch {
        doc.setFillColor(220, 220, 220);
        doc.rect(4, 15, 20, 24, 'F');
        doc.setTextColor(120);
        doc.setFontSize(16);
        doc.text(worker.name.slice(0, 2).toUpperCase(), 14, 30, { align: 'center' });
      }
    } else {
      doc.setFillColor(220, 220, 220);
      doc.rect(4, 15, 20, 24, 'F');
      doc.setTextColor(120);
      doc.setFontSize(16);
      doc.text(worker.name.slice(0, 2).toUpperCase(), 14, 30, { align: 'center' });
    }

    // Name
    doc.setTextColor(30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(worker.name, 52);
    doc.text(nameLines, 28, 18);

    // Function
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    if (jobFunctionName) {
      doc.text(jobFunctionName, 28, 26);
    }

    // Document
    if (worker.document_number) {
      doc.text(`Doc: ${worker.document_number}`, 28, 31);
    }

    // Code
    if (worker.code) {
      doc.text(`Matrícula: ${worker.code}`, 28, 36);
    }

    // QR Code
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', 68, 15, 14, 14);
    }

    // Bottom bar
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 46, 86, 8, 'F');
    doc.setTextColor(200);
    doc.setFontSize(6);
    doc.text(`ID: ${worker.code || '---'}`, 4, 51);
    doc.text(new Date().toLocaleDateString('pt-BR'), 82, 51, { align: 'right' });

    doc.save(`cracha-${worker.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
      <Printer className="h-4 w-4" />
      Imprimir Crachá
    </Button>
  );
}
