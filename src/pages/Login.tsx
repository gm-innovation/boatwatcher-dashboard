
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Tentar fazer login
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
        // Verificar o role do usuário
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .single();

        toast({
          title: "Login realizado com sucesso",
          description: `Bem-vindo ${roleData?.role === 'admin' ? 'administrador' : 'usuário'}!`,
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

  const createInitialAdmin = async () => {
    setLoading(true);

    try {
      // Verificar se já existe um usuário admin
      const { data: existingAdmin } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin')
        .single();

      if (existingAdmin) {
        toast({
          title: "Administrador já existe",
          description: "Já existe um usuário administrador no sistema.",
          variant: "destructive",
        });
        return;
      }

      // Criar usuário admin inicial
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: "admin@admin.com",
        password: "admin123",
        options: {
          emailRedirectTo: window.location.origin,
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Adicionar role admin
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: authData.user.id, role: 'admin' }]);

        if (roleError) throw roleError;

        // Fazer login automaticamente com o usuário admin
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: "admin@admin.com",
          password: "admin123"
        });

        if (loginError) throw loginError;

        toast({
          title: "Usuário admin criado com sucesso",
          description: "Email: admin@admin.com, Senha: admin123. Você será logado automaticamente.",
        });

        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário admin",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold text-center mb-6">Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Entrar
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Primeiro acesso? Crie um usuário administrador:
          </p>
          <Button
            onClick={createInitialAdmin}
            variant="outline"
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar Usuário Admin Inicial
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Login;
