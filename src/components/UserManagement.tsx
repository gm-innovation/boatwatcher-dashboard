import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/types/supabase";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClients } from "@/hooks/useSupabase";
import { ChevronDown } from "lucide-react";

const UserManagement = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(false);
  const { data: clients = [] } = useClients();
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const { toast } = useToast();

  const handleToggleClient = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: authData.user.id, role }]);

        if (roleError) throw roleError;

        if (selectedClients.length > 0) {
          const assignments = selectedClients.map(companyId => ({
            user_id: authData.user!.id,
            company_id: companyId,
          }));

          const { error: companyError } = await supabase
            .from('user_companies')
            .insert(assignments);

          if (companyError) throw companyError;
        }

        toast({
          title: "Usuário criado com sucesso",
          description: `O usuário ${email} foi criado com a role ${role} e vinculado a ${selectedClients.length} cliente(s).`,
        });

        setEmail("");
        setPassword("");
        setRole("user");
        setSelectedClients([]);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário",
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
      const { data: existingAdmin } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin')
        .maybeSingle();

      if (existingAdmin) {
        toast({
          title: "Administrador já existe",
          description: "Já existe um usuário administrador no sistema.",
          variant: "destructive",
        });
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: "admin@admin.com",
        password: "admin123",
        options: { emailRedirectTo: window.location.origin },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: authData.user.id, role: 'admin' as AppRole }]);

        if (roleError) throw roleError;

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: "admin@admin.com",
          password: "admin123",
        });

        if (loginError) throw loginError;

        toast({
          title: "Usuário admin criado com sucesso",
          description: "Email: admin@admin.com, Senha: admin123. Você será logado automaticamente.",
        });
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Gerenciamento de Usuários</h2>
        <p className="text-sm text-muted-foreground">
          Crie e gerencie os usuários que terão acesso ao sistema.
        </p>
      </div>

      <Button
        onClick={createInitialAdmin}
        variant="outline"
        disabled={loading}
        className="mb-4"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Criar Usuário Admin Inicial
      </Button>

      <form onSubmit={handleCreateUser} className="space-y-4">
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

        <div className="space-y-2">
          <Label htmlFor="role">Nível de Acesso</Label>
          <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o nível de acesso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Usuário</SelectItem>
              <SelectItem value="moderator">Moderador</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Clientes</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {selectedClients.length === 0
                  ? "Selecione os clientes"
                  : `${selectedClients.length} cliente(s) selecionado(s)`}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
              {clients.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum cliente encontrado</p>
              ) : (
                clients.map(client => (
                  <DropdownMenuCheckboxItem
                    key={client.id}
                    checked={selectedClients.includes(client.id)}
                    onCheckedChange={() => handleToggleClient(client.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {client.name || 'Cliente sem nome'}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Criar Usuário
        </Button>
      </form>
    </div>
  );
};

export default UserManagement;
