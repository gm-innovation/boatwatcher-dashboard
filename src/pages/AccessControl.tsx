import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Settings2, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

import { useOfflineAccessControl, type CachedWorker, type PendingAccessLog } from '@/hooks/useOfflineAccessControl';
import { OfflineIndicator } from '@/components/access-control/OfflineIndicator';
import { AccessPointSelector } from '@/components/access-control/AccessPointSelector';
import { WorkerSearch } from '@/components/access-control/WorkerSearch';
import { QRScanner } from '@/components/access-control/QRScanner';
import { WorkerCard } from '@/components/access-control/WorkerCard';
import { AccessConfirmation } from '@/components/access-control/AccessConfirmation';
import { RecentAccessList } from '@/components/access-control/RecentAccessList';
import { AccessControlShell } from '@/components/access-control/AccessControlShell';

interface SelectedPoint {
  id: string;
  name: string;
  access_location: string;
  direction_mode: string;
  is_active: boolean;
}

export default function AccessControl() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    isOnline, workers, pendingLogs, isSyncing,
    saveAccessLog, syncPendingLogs, loadingWorkers,
  } = useOfflineAccessControl();

  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<CachedWorker | null>(null);
  const [direction, setDirection] = useState<'entry' | 'exit'>('entry');
  const [showScanner, setShowScanner] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<PendingAccessLog[]>([]);

  const handleQRScan = useCallback((code: string) => {
    setShowScanner(false);
    const numCode = parseInt(code, 10);
    const worker = workers.find(w =>
      String(w.code) === code || w.code === numCode
    );
    if (worker) {
      setSelectedWorker(worker);
    } else {
      toast({ title: 'Trabalhador não encontrado', description: `Código: ${code}`, variant: 'destructive' });
    }
  }, [workers, toast]);

  const handleConfirm = async () => {
    if (!selectedWorker || !selectedPoint) return;

    const log: PendingAccessLog = {
      id: uuidv4(),
      worker_id: selectedWorker.id,
      worker_name: selectedWorker.name,
      worker_document: selectedWorker.document_number,
      device_name: `Manual - ${selectedPoint.name}`,
      access_status: 'granted',
      direction,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    await saveAccessLog(log);
    setSessionLogs(prev => [...prev, log]);
    setSelectedWorker(null);

    toast({
      title: direction === 'entry' ? '✅ Entrada registrada' : '🔴 Saída registrada',
      description: `${selectedWorker.name} - ${selectedPoint.name}`,
    });
  };

  return (
    <AccessControlShell isOnline={isOnline}>
      <div className="flex flex-col max-w-lg mx-auto min-h-[calc(100vh-3rem)]">
        {/* Header controls */}
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold">Registro de Acesso</h1>
            <Button variant="ghost" size="icon" onClick={() => navigate('/access-control/config')}>
              <Settings2 className="h-5 w-5" />
            </Button>
          </div>

          <OfflineIndicator
            isOnline={isOnline}
            pendingCount={pendingLogs.length}
            isSyncing={isSyncing}
            onSync={syncPendingLogs}
          />

          {/* Access Point Selector */}
          <div className="mt-3">
            <AccessPointSelector
              value={selectedPoint?.id || null}
              onChange={(p) => {
                setSelectedPoint(p as SelectedPoint | null);
                setSelectedWorker(null);
                if (p) {
                  if (p.direction_mode === 'entry') setDirection('entry');
                  else if (p.direction_mode === 'exit') setDirection('exit');
                }
              }}
            />
          </div>

          {/* Location badge + direction */}
          {selectedPoint && (
            <div className="flex items-center justify-between mt-3">
              <Badge variant="outline" className="text-sm">
                {selectedPoint.access_location === 'bordo' ? '🚢 Bordo' : '🏗️ Dique'}
              </Badge>

              {selectedPoint.direction_mode === 'both' ? (
                <Tabs value={direction} onValueChange={v => setDirection(v as 'entry' | 'exit')}>
                  <TabsList>
                    <TabsTrigger value="entry" className="gap-1 data-[state=active]:bg-green-600 data-[state=active]:text-white">
                      <LogIn className="h-4 w-4" /> Entrada
                    </TabsTrigger>
                    <TabsTrigger value="exit" className="gap-1 data-[state=active]:bg-red-600 data-[state=active]:text-white">
                      <LogOut className="h-4 w-4" /> Saída
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : (
                <Badge className={selectedPoint.direction_mode === 'entry'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
                }>
                  {selectedPoint.direction_mode === 'entry' ? 'Apenas Entrada' : 'Apenas Saída'}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4">
          {!selectedPoint ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Selecione um ponto de controle para começar</p>
            </div>
          ) : (
            <>
              {/* QR Scanner button */}
              <Button
                variant="outline"
                className="w-full h-12 gap-2 text-base"
                onClick={() => setShowScanner(true)}
              >
                <QrCode className="h-5 w-5" />
                Escanear QR Code
              </Button>

              {/* Worker selected */}
              {selectedWorker ? (
                <div className="space-y-4">
                  <WorkerCard worker={selectedWorker} />
                  <AccessConfirmation
                    direction={direction}
                    onConfirm={handleConfirm}
                  />
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setSelectedWorker(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <WorkerSearch
                  workers={workers}
                  onSelect={setSelectedWorker}
                />
              )}

              <RecentAccessList logs={sessionLogs} />
            </>
          )}
        </div>

        {/* QR Scanner modal */}
        {showScanner && (
          <QRScanner
            onScan={handleQRScan}
            onClose={() => setShowScanner(false)}
          />
        )}
      </div>
    </AccessControlShell>
  );
}
