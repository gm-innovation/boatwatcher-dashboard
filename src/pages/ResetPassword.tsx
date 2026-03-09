import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Also check hash for type=recovery
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({ title: "Erro ao redefinir senha", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Senha redefinida com sucesso!", description: "Você será redirecionado." });
      setTimeout(() => navigate("/"), 1500);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md p-6 mx-4">
          <div className="text-center space-y-4">
            <KeyRound className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Link Inválido</h2>
            <p className="text-sm text-muted-foreground">
              Este link de recuperação é inválido ou expirou. Solicite um novo link na tela de login.
            </p>
            <Button onClick={() => navigate("/login")} className="w-full">Voltar ao Login</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dock Check</h1>
          <p className="text-muted-foreground">Redefinir sua senha</p>
        </div>

        <Card className="w-full p-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            <KeyRound className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">Nova Senha</h2>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Redefinir Senha
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
