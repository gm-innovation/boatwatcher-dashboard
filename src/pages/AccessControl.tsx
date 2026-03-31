import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2, LogIn, LogOut, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  // Auto-load the active terminal
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

      return {
        ...data,
        client_name,
        client_logo,
        project_name,
      } as ActiveTerminal;
    },
  });

  const {
    isOnline, workers, pendingLogs, isSyncing,
    saveAccessLog, syncPendingLogs,
  } = useOfflineAccessControl();

  const [selectedWorker, setSelectedWorker] = useState<CachedWorker | null>(null);
  const [direction, setDirection] = useState<'entry' | 'exit'>('entry');
  const [showScanner, setShowScanner] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<PendingAccessLog[]>([]);
  const [workerCode, setWorkerCode] = useState('');

  // Set direction based on terminal config
  useEffect(() => {
    if (terminal) {
      if (terminal.direction_mode === 'entry') setDirection('entry');
      else if (terminal.direction_mode === 'exit') setDirection('exit');
    }
  }, [terminal]);

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

  const handleConfirm = async () => {
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
    setSelectedWorker(null);
    setWorkerCode('');

    toast({
      title: direction === 'entry' ? '✅ Entrada registrada' : '🔴 Saída registrada',
      description: `${selectedWorker.name} - ${terminal.name}`,
    });
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
        {/* Header with branding */}
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {terminal.client_logo && (
                <img
                  src={terminal.client_logo}
                  alt={terminal.client_name || 'Logo'}
                  className="h-10 w-auto max-w-[120px] object-contain"
                />
              )}
              <div>
                <h1 className="text-lg font-bold">{terminal.project_name || terminal.name}</h1>
                {terminal.location_description && (
                  <p className="text-sm text-muted-foreground">{terminal.location_description}</p>
                )}
              </div>
            </div>
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

          {/* Location badge + direction */}
          <div className="flex items-center justify-between mt-3">
            <Badge variant="outline" className="text-sm">
              {terminal.access_location === 'bordo' ? '🚢 Bordo' : '🏗️ Dique'}
            </Badge>

            {terminal.direction_mode === 'both' ? (
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
              <Badge className={terminal.direction_mode === 'entry'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
              }>
                {terminal.direction_mode === 'entry' ? 'Apenas Entrada' : 'Apenas Saída'}
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4">
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
                onClick={() => { setSelectedWorker(null); setWorkerCode(''); }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <>
              {/* Code display */}
              <div className="text-center space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Código do Trabalhador</label>
                <div className="bg-muted rounded-lg p-4 min-h-[56px] flex items-center justify-center">
                  <span className="text-3xl font-mono font-bold tracking-widest">
                    {workerCode || <span className="text-muted-foreground/50">---</span>}
                  </span>
                </div>
              </div>

              {/* Numeric keypad */}
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
