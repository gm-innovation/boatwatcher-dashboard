import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { SwitchCamera, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = async (facing: 'environment' | 'user') => {
    if (!containerRef.current) return;

    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current.clear();
    }

    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: facing },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {}
      );
    } catch (err) {
      console.error('QR Scanner error:', err);
    }
  };

  useEffect(() => {
    startScanner(facingMode);
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Escanear QR Code</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={toggleCamera}>
              <SwitchCamera className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div ref={containerRef} className="rounded-lg overflow-hidden bg-black">
          <div id="qr-reader" className="w-full" />
        </div>
        <p className="text-sm text-muted-foreground text-center mt-3">
          Aponte a câmera para o QR Code do crachá
        </p>
      </div>
    </div>
  );
}
