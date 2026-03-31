import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ScanLine, Loader2 } from 'lucide-react';

export default function AccessControlLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast({ title: 'Erro', description: 'Usuário não encontrado', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Check role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      const userRole = roleData?.role;
      if (userRole !== 'admin' && userRole !== 'operator') {
        await supabase.auth.signOut();
        toast({
          title: 'Acesso Negado',
          description: 'Apenas operadores e administradores podem acessar o controle de acesso.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      navigate('/access-control');
    } catch {
      toast({ title: 'Erro', description: 'Erro inesperado ao fazer login', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <ScanLine className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Controle de Acesso</CardTitle>
          <p className="text-sm text-muted-foreground">
            Faça login para registrar entradas e saídas
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@empresa.com"
                required
                autoComplete="email"
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
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
