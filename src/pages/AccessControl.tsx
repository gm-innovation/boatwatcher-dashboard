import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, RotateCcw, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

import { useOfflineAccessControl, type CachedWorker, type PendingAccessLog } from '@/hooks/useOfflineAccessControl';
import { OfflineIndicator } from '@/components/access-control/OfflineIndicator';
import { WorkerCard } from '@/components/access-control/WorkerCard';
import { AccessConfirmation } from '@/components/access-control/AccessConfirmation';
import { RecentAccessList } from '@/components/access-control/RecentAccessList';
import { AccessControlShell } from '@/components/access-control/AccessControlShell';
import { QRScanner } from '@/components/access-control/QRScanner';
import { NumericKeypad } from '@/components/access-control/NumericKeypad';
import { useResolvedUrl } from '@/hooks/useResolvedUrl';

function playBeep() {
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch { /* ignore audio errors */ }
}

interface ActiveTerminal {
  id: string;
  name: string;
  access_location: string;
  direction_mode: string;
  is_active: boolean;
  location_description: string | null;
  client_id: string | null;
  project_id: string | null;
  client_name?: string;
  client_logo?: string;
  project_name?: string;
}

export default function AccessControl() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: terminal, isLoading: loadingTerminal } = useQuery({
    queryKey: ['active_terminal'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('manual_access_points')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      let client_name: string | undefined;
      let client_logo: string | undefined;
      let project_name: string | undefined;

      if (data.client_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name, logo_url_light')
          .eq('id', data.client_id)
          .maybeSingle();
        if (company) {
          client_name = company.name;
          client_logo = company.logo_url_light || undefined;
        }
      }

      if (data.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', data.project_id)
          .maybeSingle();
        if (project) {
          project_name = project.name;
        }
      }

      return { ...data, client_name, client_logo, project_name } as ActiveTerminal;
    },
  });

  const {
    isOnline, workers, pendingLogs, isSyncing,
    saveAccessLog, syncPendingLogs,
  } = useOfflineAccessControl();

  const resolvedLogo = useResolvedUrl(terminal?.client_logo ?? null);

  const [selectedWorker, setSelectedWorker] = useState<CachedWorker | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<PendingAccessLog[]>([]);
  const [workerCode, setWorkerCode] = useState('');
  const [accessGranted, setAccessGranted] = useState(false);

  const handleDigit = useCallback((digit: string) => {
    setWorkerCode(prev => prev.length < 10 ? prev + digit : prev);
  }, []);

  const handleClear = useCallback(() => {
    setWorkerCode('');
  }, []);

  const handleVerify = useCallback(() => {
    if (!workerCode.trim()) return;
    const numCode = parseInt(workerCode, 10);
    const worker = workers.find(w =>
      String(w.code) === workerCode || w.code === numCode
    );
    if (worker) {
      setSelectedWorker(worker);
    } else {
      toast({ title: 'Trabalhador não encontrado', description: `Código: ${workerCode}`, variant: 'destructive' });
    }
  }, [workerCode, workers, toast]);

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

  const handleConfirm = async (direction: 'entry' | 'exit') => {
    if (!selectedWorker || !terminal) return;

    const log: PendingAccessLog = {
      id: uuidv4(),
      worker_id: selectedWorker.id,
      worker_name: selectedWorker.name,
      worker_document: selectedWorker.document_number,
      device_name: `Manual - ${terminal.name}`,
      access_status: 'granted',
      direction,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    await saveAccessLog(log);
    setSessionLogs(prev => [...prev, log]);
    setAccessGranted(true);

    toast({
      title: direction === 'entry' ? '✅ Entrada registrada' : '🔴 Saída registrada',
      description: `${selectedWorker.name} - ${terminal.name}`,
    });
  };

  const handleNewAccess = () => {
    setSelectedWorker(null);
    setWorkerCode('');
    setAccessGranted(false);
  };

  if (loadingTerminal) {
    return (
      <AccessControlShell isOnline={isOnline}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Carregando terminal...</p>
        </div>
      </AccessControlShell>
    );
  }

  if (!terminal) {
    return (
      <AccessControlShell isOnline={isOnline}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhum terminal configurado</h2>
          <p className="text-muted-foreground max-w-sm">
            Configure e ative um terminal na área administrativa para utilizar o controle de acesso.
          </p>
          <Button onClick={() => navigate('/access-control/config')}>
            Ir para Configurações
          </Button>
        </div>
      </AccessControlShell>
    );
  }

  return (
    <AccessControlShell isOnline={isOnline}>
      <div className="flex flex-col max-w-lg mx-auto min-h-[calc(100vh-3rem)]">
        {/* Branded header */}
        <div className="p-6 border-b bg-card text-center space-y-2">
          {terminal.client_logo && (
            <img
              src={terminal.client_logo}
              alt={terminal.client_name || 'Logo'}
              className="h-14 w-auto mx-auto object-contain"
            />
          )}
          <h1 className="text-xl font-bold">{terminal.project_name || terminal.name}</h1>
          <p className="text-sm text-muted-foreground">
            {terminal.name}
            {terminal.location_description && ` · ${terminal.location_description}`}
          </p>

          <OfflineIndicator
            isOnline={isOnline}
            pendingCount={pendingLogs.length}
            isSyncing={isSyncing}
            onSync={syncPendingLogs}
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4">
          {selectedWorker ? (
            <div className="space-y-4">
              {accessGranted && (
                <div className="flex items-center gap-2 bg-green-600 text-white rounded-lg p-3 justify-center font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  Acesso Liberado
                </div>
              )}

              <WorkerCard worker={selectedWorker} />

              {!accessGranted && (
                <AccessConfirmation onConfirm={handleConfirm} />
              )}

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleNewAccess}
              >
                <RotateCcw className="h-4 w-4" />
                Novo Acesso
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Código do Trabalhador</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-primary"
                  onClick={() => setShowScanner(true)}
                >
                  <Camera className="h-4 w-4" />
                  Usar Câmera
                </Button>
              </div>

              <div className="bg-muted rounded-lg p-4 min-h-[72px] flex items-center justify-center">
                <span className="text-4xl font-mono font-bold tracking-widest">
                  {workerCode || <span className="text-muted-foreground/40">---</span>}
                </span>
              </div>

              <NumericKeypad
                onDigit={handleDigit}
                onClear={handleClear}
                onConfirm={handleVerify}
                onCamera={() => setShowScanner(true)}
              />
            </>
          )}

          <RecentAccessList logs={sessionLogs} />
        </div>

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
