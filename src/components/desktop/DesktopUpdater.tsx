import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getElectronAPI, type UpdaterStatus } from "@/lib/dataProvider";
import { RefreshCw, Download, RotateCcw, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

const defaultStatus: UpdaterStatus = {
  configured: false,
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  version: null,
  progress: 0,
  error: null,
};

export const DesktopUpdater = () => {
  const [status, setStatus] = useState<UpdaterStatus>(defaultStatus);
  const [loading, setLoading] = useState(true);

  const api = getElectronAPI();

  useEffect(() => {
    if (!api) return;

    api.updater.getStatus().then((s) => {
      setStatus(s);
      setLoading(false);
    });

    api.onUpdaterStatusChange((s) => setStatus(s));
  }, []);

  const handleCheck = useCallback(async () => {
    if (!api) return;
    await api.updater.checkForUpdates();
  }, [api]);

  const handleInstall = useCallback(async () => {
    if (!api) return;
    await api.updater.installDownloadedUpdate();
  }, [api]);

  if (!api) return null;

  const isIdle = !status.checking && !status.downloading && !status.downloaded && !status.error;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Atualização do Desktop</CardTitle>
            <CardDescription>
              Gerencie as atualizações do aplicativo Desktop
            </CardDescription>
          </div>
          {status.version && (
            <Badge variant="outline" className="text-xs">
              {status.downloaded ? `Nova: ${status.version}` : `Atual`}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando status...
          </div>
        ) : (
          <>
            {/* Status display */}
            {status.checking && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando atualizações...
              </div>
            )}

            {status.downloading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4 text-primary" />
                  Baixando atualização{status.version ? ` ${status.version}` : ""}...
                </div>
                <Progress value={status.progress} className="h-2" />
                <span className="text-xs text-muted-foreground">{Math.round(status.progress)}%</span>
              </div>
            )}

            {status.downloaded && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    Versão <strong>{status.version}</strong> pronta para instalar.
                  </span>
                  <Button size="sm" onClick={handleInstall} className="ml-4 gap-1">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Instalar e reiniciar
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {status.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{status.error}</AlertDescription>
              </Alert>
            )}

            {isIdle && !loading && (
              <p className="text-sm text-muted-foreground">
                {status.configured
                  ? "Nenhuma atualização pendente."
                  : "Atualizador não configurado. Verifique a URL de atualização nas configurações."}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheck}
                disabled={status.checking || status.downloading}
                className="gap-1"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${status.checking ? "animate-spin" : ""}`} />
                Verificar atualizações
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
