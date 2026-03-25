import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getElectronAPI, type UpdaterStatus } from "@/lib/dataProvider";
import { toast } from "sonner";
import { RefreshCw, Download, RotateCcw, CheckCircle2, AlertTriangle, Loader2, Save, Link } from "lucide-react";

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
  const [updateUrl, setUpdateUrl] = useState("");
  const [urlDirty, setUrlDirty] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);

  const api = getElectronAPI();

  useEffect(() => {
    if (!api) return;

    api.updater.getStatus().then((s) => {
      setStatus(s);
      setLoading(false);
    });

    // Load current update URL
    const currentUrl = api.getUpdateUrl?.();
    if (currentUrl) {
      setUpdateUrl(currentUrl);
    }

    api.onUpdaterStatusChange((s) => setStatus(s));
  }, []);

  const handleCheck = useCallback(async () => {
    if (!api) return;
    const result = await api.updater.checkForUpdates();
    if (result && !result.ok) {
      if (result.reason === "not_configured") {
        toast.error("URL de atualização não configurada", {
          description: "Informe a URL do repositório de atualizações abaixo e salve.",
        });
      } else if (result.reason === "not_packaged") {
        toast.warning("Modo desenvolvimento", {
          description: "O atualizador só funciona na versão empacotada (.exe).",
        });
      } else {
        toast.error("Erro ao verificar atualizações", {
          description: result.reason || "Erro desconhecido.",
        });
      }
    }
  }, [api]);

  const handleInstall = useCallback(async () => {
    if (!api) return;
    await api.updater.installDownloadedUpdate();
  }, [api]);

  const handleSaveUrl = useCallback(async () => {
    if (!api?.setUpdateUrl) return;
    setSavingUrl(true);
    try {
      await api.setUpdateUrl(updateUrl.trim());
      setUrlDirty(false);
      toast.success("URL de atualização salva");
      // Re-fetch status after setting URL
      const s = await api.updater.getStatus();
      setStatus(s);
      // Auto-check for updates after saving a valid URL
      if (updateUrl.trim()) {
        await handleCheck();
      }
    } catch (err) {
      toast.error("Erro ao salvar URL");
    } finally {
      setSavingUrl(false);
    }
  }, [api, updateUrl, handleCheck]);

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
        {/* URL configuration */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Link className="h-3.5 w-3.5" />
            URL de atualização
          </label>
          <div className="flex gap-2">
            <Input
              value={updateUrl}
              onChange={(e) => {
                setUpdateUrl(e.target.value);
                setUrlDirty(true);
              }}
              placeholder="https://github.com/owner/repo/releases/download/latest"
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveUrl}
              disabled={!urlDirty || savingUrl}
              className="gap-1 shrink-0"
            >
              {savingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            URL base do GitHub Releases onde os arquivos de atualização são publicados.
          </p>
        </div>

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
                  : "Atualizador não configurado. Informe a URL de atualização acima."}
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
