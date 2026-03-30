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
import { supabase } from "@/integrations/supabase/client";
import { Project, AppRole } from "@/types/supabase";
import { Checkbox } from "@/components/ui/checkbox";
import { useProjects } from "@/hooks/useSupabase";
import { AdminProjectFilter } from "@/components/admin/AdminProjectFilter";

const UserManagement = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(false);
  const { data: projects = [] } = useProjects();
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const { toast } = useToast();

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
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Add user role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: authData.user.id, role }]);

        if (roleError) throw roleError;

        // Link user to selected projects
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

        // Clear form
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
      // Check if admin user already exists
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

      // Create initial admin user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: "admin@admin.com",
        password: "admin123",
        options: {
          emailRedirectTo: window.location.origin,
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Add admin role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: authData.user.id, role: 'admin' as AppRole }]);

        if (roleError) throw roleError;

        // Auto login with admin user
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
          <Label>Projetos</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-2">Nenhum projeto cadastrado</p>
            ) : (
              projects.map(project => (
                <div key={project.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`project-${project.id}`}
                    checked={selectedProjects.includes(project.id)}
                    onCheckedChange={() => handleToggleProject(project.id)}
                  />
                  <Label htmlFor={`project-${project.id}`} className="cursor-pointer">
                    {project.name || 'Projeto sem nome'}
                  </Label>
                </div>
              ))
            )}
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
