import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Camera, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';

import { useOfflineAccessControl, type CachedWorker, type PendingAccessLog } from '@/hooks/useOfflineAccessControl';

import { WorkerCard } from '@/components/access-control/WorkerCard';
import { AccessConfirmation } from '@/components/access-control/AccessConfirmation';
import { AccessControlShell } from '@/components/access-control/AccessControlShell';
import { QRScanner } from '@/components/access-control/QRScanner';
import { NumericKeypad } from '@/components/access-control/NumericKeypad';
import { useResolvedUrl } from '@/hooks/useResolvedUrl';

const TERMINAL_CACHE_KEY = 'ac_active_terminal';

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

function deriveAccessStatus(worker: CachedWorker, projectId?: string | null): {
  borderStatus: 'granted' | 'blocked' | 'pending';
  authorized: boolean;
  reason?: string;
} {
  if (worker.status === 'blocked' || worker.status === 'inactive') {
    return {
      borderStatus: 'blocked',
      authorized: false,
      reason: worker.rejection_reason || 'Trabalhador bloqueado',
    };
  }
  if (worker.status === 'pending_review') {
    return {
      borderStatus: 'pending',
      authorized: false,
      reason: 'Trabalhador em análise',
    };
  }
  if (projectId && (!worker.allowed_project_ids || !worker.allowed_project_ids.includes(projectId))) {
    return {
      borderStatus: 'blocked',
      authorized: false,
      reason: 'Não autorizado para este projeto',
    };
  }
  return { borderStatus: 'granted', authorized: true };
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

  // Bug 1 fix: cache terminal in IndexedDB, fallback when offline
  const { data: terminal, isLoading: loadingTerminal } = useQuery({
    queryKey: ['active_terminal'],
    queryFn: async () => {
      if (navigator.onLine) {
        try {
          const { data, error } = await (supabase as any)
            .from('manual_access_points')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          if (!data) {
            // No active terminal remotely — still check cache
            const cached = await get<ActiveTerminal>(TERMINAL_CACHE_KEY);
            return cached || null;
          }

          let client_name: string | undefined;
          let client_logo: string | undefined;
          let project_name: string | undefined;
          let effectiveClientId = data.client_id;

          if (data.project_id) {
            const { data: project } = await supabase
              .from('projects')
              .select('name, client_id')
              .eq('id', data.project_id)
              .maybeSingle();
            if (project) {
              project_name = project.name;
              if (!effectiveClientId && project.client_id) {
                effectiveClientId = project.client_id;
              }
            }
          }

          if (effectiveClientId) {
            const { data: company } = await supabase
              .from('companies')
              .select('name, logo_url_light')
              .eq('id', effectiveClientId)
              .maybeSingle();
            if (company) {
              client_name = company.name;
              client_logo = company.logo_url_light || undefined;
            }
          }

          const result = { ...data, client_name, client_logo, project_name } as ActiveTerminal;
          // Persist to IndexedDB for offline use
          await set(TERMINAL_CACHE_KEY, result);
          return result;
        } catch (err) {
          console.error('[AC] Failed to load terminal from remote, using cache', err);
          const cached = await get<ActiveTerminal>(TERMINAL_CACHE_KEY);
          return cached || null;
        }
      } else {
        // Offline — use cached terminal
        const cached = await get<ActiveTerminal>(TERMINAL_CACHE_KEY);
        return cached || null;
      }
    },
  });

  const {
    isOnline, workers, pendingLogs, isSyncing, loadingWorkers,
    saveAccessLog, syncPendingLogs,
  } = useOfflineAccessControl(terminal?.project_id);

  const resolvedLogo = useResolvedUrl(terminal?.client_logo ?? null);

  const [selectedWorker, setSelectedWorker] = useState<CachedWorker | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [workerCode, setWorkerCode] = useState('');

  const handleDigit = useCallback((digit: string) => {
    setWorkerCode(prev => prev.length < 10 ? prev + digit : prev);
  }, []);

  const handleClear = useCallback(() => {
    setWorkerCode('');
  }, []);

  const handleNewAccess = () => {
    setSelectedWorker(null);
    setWorkerCode('');
  };

  // Bug 5 fix: block verify while loading
  const handleVerify = useCallback(() => {
    if (!workerCode.trim() || loadingWorkers) return;
    const numCode = parseInt(workerCode, 10);
    const worker = workers.find(w =>
      String(w.code) === workerCode || w.code === numCode
    );
    if (worker) {
      setSelectedWorker(worker);
    } else {
      toast({
        title: 'Trabalhador não encontrado',
        description: `Código ${workerCode} não localizado`,
        variant: 'destructive',
      });
    }
  }, [workerCode, workers, toast, loadingWorkers]);

  const handleQRScan = useCallback((code: string) => {
    setShowScanner(false);
    if (loadingWorkers) {
      toast({ title: 'Aguarde', description: 'Sincronizando trabalhadores...', variant: 'default' });
      return;
    }
    const numCode = parseInt(code, 10);
    const worker = workers.find(w =>
      String(w.code) === code || w.code === numCode
    );
    if (worker) {
      setSelectedWorker(worker);
    } else {
      toast({
        title: 'Trabalhador não encontrado',
        description: `Código ${code} não localizado`,
        variant: 'destructive',
      });
    }
  }, [workers, toast, loadingWorkers]);

  const handleConfirm = async (direction: 'entry' | 'exit') => {
    if (!selectedWorker || !terminal) return;

    const { authorized } = deriveAccessStatus(selectedWorker, terminal.project_id);

    const log: PendingAccessLog = {
      id: uuidv4(),
      worker_id: selectedWorker.id,
      worker_name: selectedWorker.name,
      worker_document: selectedWorker.document_number,
      device_name: `Manual - ${terminal.name}`,
      access_status: authorized ? 'granted' : 'denied',
      direction,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    await saveAccessLog(log);
    playBeep();

    const { dismiss } = toast({
      title: authorized
        ? (direction === 'entry' ? '✅ Entrada registrada' : '🔴 Saída registrada')
        : '⛔ Acesso negado',
      description: authorized
        ? `${selectedWorker.name} - ${terminal.name}`
        : `${selectedWorker.name} — ${deriveAccessStatus(selectedWorker, terminal.project_id).reason}`,
      variant: authorized ? 'default' : 'destructive',
    });

    setTimeout(() => {
      dismiss();
      handleNewAccess();
    }, 1200);
  };

  const selectedStatus = selectedWorker
    ? deriveAccessStatus(selectedWorker, terminal?.project_id)
    : null;

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
        <div className="p-6 border-b bg-card text-center space-y-1">
          {resolvedLogo && (
            <img
              src={resolvedLogo}
              alt={terminal.client_name || 'Logo'}
              className="h-14 w-auto mx-auto object-contain"
            />
          )}
          <h1 className="text-xl font-bold">{terminal.project_name || terminal.name}</h1>
          <p className="text-sm text-muted-foreground">
            {terminal.name}
            {terminal.location_description && ` · ${terminal.location_description}`}
          </p>
          {loadingWorkers && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sincronizando...</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4">
          {selectedWorker && selectedStatus ? (
            <div className="space-y-4">
              <WorkerCard
                worker={selectedWorker}
                borderStatus={selectedStatus.borderStatus}
                blockReason={selectedStatus.reason}
              />

              {selectedStatus.authorized && (
                <AccessConfirmation onConfirm={handleConfirm} />
              )}

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleNewAccess}
              >
                <X className="h-4 w-4" />
                Cancelar
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
                  disabled={loadingWorkers}
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
                disabled={loadingWorkers}
              />
            </>
          )}
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
