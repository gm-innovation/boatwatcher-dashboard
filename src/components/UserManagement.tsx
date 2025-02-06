
import { useState, useEffect } from "react";
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
import { supabase } from "@/lib/supabase";
import { Project } from "@/types/supabase";
import { Checkbox } from "@/components/ui/checkbox";

const UserManagement = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const { toast } = useToast();

  // Buscar projetos disponíveis
  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('vessel_name');
      
      if (error) {
        console.error('Erro ao buscar projetos:', error);
        return;
      }

      setProjects(data || []);
    };

    fetchProjects();
  }, []);

  const handleToggleProject = (projectId: string) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Adicionar role do usuário
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: authData.user.id, role }]);

        if (roleError) throw roleError;

        // Vincular usuário aos projetos selecionados
        if (selectedProjects.length > 0) {
          const projectAssignments = selectedProjects.map(projectId => ({
            user_id: authData.user.id,
            project_id: projectId
          }));

          const { error: projectError } = await supabase
            .from('user_projects')
            .insert(projectAssignments);

          if (projectError) throw projectError;
        }

        toast({
          title: "Usuário criado com sucesso",
          description: `O usuário ${email} foi criado com a role ${role} e vinculado a ${selectedProjects.length} projeto(s).`,
        });

        // Limpar formulário
        setEmail("");
        setPassword("");
        setRole("user");
        setSelectedProjects([]);
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
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o nível de acesso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Usuário</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Projetos</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4">
            {projects.map(project => (
              <div key={project.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`project-${project.id}`}
                  checked={selectedProjects.includes(project.id)}
                  onCheckedChange={() => handleToggleProject(project.id)}
                />
                <Label htmlFor={`project-${project.id}`} className="cursor-pointer">
                  {project.vessel_name || 'Projeto sem nome'}
                </Label>
              </div>
            ))}
          </div>
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
