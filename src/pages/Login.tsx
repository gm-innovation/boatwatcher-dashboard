import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Shield, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usesLocalAuth } from "@/lib/runtimeProfile";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkInitialState = async () => {
      if (usesLocalAuth()) {
        setCheckingSetup(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
        return;
      }

      const { data: needsSetupData, error } = await supabase.rpc('needs_initial_setup');

      if (error) {
        console.error('Error checking setup status:', error);
        setNeedsSetup(false);
      } else {
        setNeedsSetup(needsSetupData === true);
      }

      setCheckingSetup(false);
    };

    checkInitialState();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (usesLocalAuth()) {
      setLoading(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        toast({
          title: 'Conta conectada com sucesso',
          description: 'Os recursos sincronizados do desktop foram habilitados.',
        });
        navigate('/admin');
      } catch (error: any) {
        toast({
          title: 'Erro ao conectar conta',
          description: error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Erro ao fazer login",
          description: error.message === "Invalid login credentials"
            ? "Email ou senha incorretos"
            : error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (roleError) {
          toast({
            title: "Erro ao verificar permissões",
            description: roleError.message,
            variant: "destructive",
          });
          return;
        }

        if (!roleData) {
          toast({
            title: "Erro de permissões",
            description: "Usuário sem role definida. Contate o administrador.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }

        toast({
          title: "Login realizado com sucesso",
          description: `Bem-vindo ${roleData.role === 'admin' ? 'administrador' : 'usuário'}!`,
        });

        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create the admin user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) {
        toast({
          title: "Erro ao criar conta",
          description: signUpError.message,
          variant: "destructive",
        });
        return;
      }

      if (!signUpData.user) {
        toast({
          title: "Erro",
          description: "Não foi possível criar o usuário.",
          variant: "destructive",
        });
        return;
      }

      // Assign admin role using the secure function
      const { data: adminCreated, error: roleError } = await supabase.rpc('create_initial_admin', {
        _user_id: signUpData.user.id,
      });

      if (roleError) {
        toast({
          title: "Erro ao atribuir permissões",
          description: roleError.message,
          variant: "destructive",
        });
        // Sign out the user since role assignment failed
        await supabase.auth.signOut();
        return;
      }

      if (!adminCreated) {
        toast({
          title: "Erro",
          description: "Um administrador já existe no sistema.",
          variant: "destructive",
        });
        setNeedsSetup(false);
        return;
      }

      toast({
        title: "Administrador criado com sucesso!",
        description: "Você será redirecionado para o sistema.",
      });

      // Navigate to home
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="flex flex-col items-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dock Check</h1>
          <p className="text-muted-foreground">
            {needsSetup ? "Configure o administrador inicial" : "Faça login para continuar"}
          </p>
        </div>
        
        <Card className="w-full p-6">
          {needsSetup ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-6">
                <Shield className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold">Configuração Inicial</h2>
              </div>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Crie a conta do administrador principal do sistema. Esta etapa só pode ser realizada uma vez.
              </p>
              <form onSubmit={handleSetupAdmin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email do Administrador</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@empresa.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
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
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
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
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Criar Administrador
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-center mb-6">Login</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Entrar
                </Button>
                <div className="text-center space-y-2">
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={async () => {
                      if (!email) {
                        toast({ title: 'Informe seu email', description: 'Digite seu email acima para receber o link de recuperação.', variant: 'destructive' });
                        return;
                      }
                      setLoading(true);
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      setLoading(false);
                      if (error) {
                        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
                      } else {
                        toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
                      }
                    }}
                  >
                    Esqueceu a senha?
                  </button>
                  <p className="text-sm text-muted-foreground">
                    É trabalhador?{' '}
                    <a href="/cadastro" className="text-primary hover:underline">
                      Fazer cadastro
                    </a>
                  </p>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Login;
