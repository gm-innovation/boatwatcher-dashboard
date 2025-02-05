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

  // Get logo based on current theme
  const companyLogo = localStorage.getItem('company_light');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("Tentando fazer login com:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Erro no login:", error);
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
        console.log("Login bem sucedido. User ID:", data.user.id);
        // Verificar o role do usuário
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        console.log("Resposta da consulta de role:", { roleData, roleError });

        if (roleError) {
          console.error("Erro ao buscar role:", roleError);
          toast({
            title: "Erro ao verificar permissões",
            description: roleError.message,
            variant: "destructive",
          });
          return;
        }

        if (!roleData) {
          console.log("Nenhuma role encontrada para o usuário");
          toast({
            title: "Erro de permissões",
            description: "Usuário sem role definida",
            variant: "destructive",
          });
          return;
        }

        console.log("Role encontrada:", roleData.role);
        toast({
          title: "Login realizado com sucesso",
          description: `Bem-vindo ${roleData.role === 'admin' ? 'administrador' : 'usuário'}!`,
        });

        navigate("/");
      }
    } catch (error: any) {
      console.error("Erro inesperado:", error);
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          {companyLogo ? (
            <img 
              src={companyLogo} 
              alt="Logo da Empresa" 
              className="h-20 w-auto object-contain mb-8" 
            />
          ) : (
            <div className="h-20 w-48 bg-muted rounded animate-pulse mb-8" />
          )}
        </div>
        
        <Card className="w-full p-6">
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
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Entrar
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;