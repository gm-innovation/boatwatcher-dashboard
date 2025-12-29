import { format } from 'date-fns';
import { Clock, Settings, Moon, Sun, LogOut, LayoutDashboard, FileText, Users, Building2, Briefcase, ChevronDown, Cpu, FolderKanban, UserCog, ClipboardList, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { useTheme } from '@/components/theme-provider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { ProjectSelector } from '@/components/ProjectSelector';
import { Separator } from '@/components/ui/separator';
import { useProject } from '@/contexts/ProjectContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  const { toast } = useToast();
  const { selectedProject, selectedProjectId, setSelectedProjectId } = useProject();

  const clientLogo = theme === 'dark' 
    ? selectedProject?.client?.logo_url_dark 
    : selectedProject?.client?.logo_url_light;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const checkUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        setIsAdmin(roleData?.role === 'admin');
        setIsCompanyAdmin(roleData?.role === 'company_admin');
      }
    };

    checkUserRole();
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <header className="fixed top-0 left-0 right-0 w-full bg-background/95 backdrop-blur-sm border-b border-border animate-fade-in z-50">
      {/* Upper section - Logos */}
      <div className="w-full border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-2">
          {clientLogo ? (
            <img src={clientLogo} alt="Logo do Cliente" className="h-8 w-28 object-contain" />
          ) : (
            <div className="h-8 w-28 bg-muted rounded" />
          )}
          <div className="h-8 w-28 bg-muted rounded flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Sistema</span>
          </div>
        </div>
      </div>

      {/* Lower section - Navigation and Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          {/* Left - Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className={isActive('/') && location.pathname === '/' ? 'bg-accent' : ''}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/reports')}
              className={isActive('/reports') ? 'bg-accent' : ''}
            >
              <FileText className="h-4 w-4 mr-2" />
              Relatórios
            </Button>

            {/* Dropdown: Gestão de Pessoas */}
            {(isAdmin || isCompanyAdmin) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={isActive('/people') ? 'bg-accent' : ''}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Gestão de Pessoas
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover border border-border shadow-lg z-50">
                  <DropdownMenuItem onClick={() => navigate('/people/workers')}>
                    <Users className="h-4 w-4 mr-2" />
                    Trabalhadores
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/people/companies')}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Empresas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/people/job-functions')}>
                    <Briefcase className="h-4 w-4 mr-2" />
                    Cargos e Requisitos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Dropdown: Administração (Admin only) */}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={isActive('/admin') || isActive('/settings') ? 'bg-accent' : ''}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Administração
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover border border-border shadow-lg z-50">
                  <DropdownMenuItem onClick={() => navigate('/admin/devices')}>
                    <Cpu className="h-4 w-4 mr-2" />
                    Dispositivos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/admin/projects')}>
                    <FolderKanban className="h-4 w-4 mr-2" />
                    Projetos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                    <UserCog className="h-4 w-4 mr-2" />
                    Usuários
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/admin/audit')}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Auditoria
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Portal da Empresa (Company Admin only) */}
            {isCompanyAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/company-portal')}
                className={isActive('/company-portal') ? 'bg-accent' : ''}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Portal da Empresa
              </Button>
            )}
          </div>

          {/* Center - Project Selector */}
          <div className="flex items-center">
            <ProjectSelector
              selectedProjectId={selectedProjectId}
              onProjectSelect={setSelectedProjectId}
            />
          </div>

          {/* Right - Controls */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end mr-4 border-r border-border pr-4">
              <div className="flex items-center gap-2 text-foreground/80">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {format(currentTime, 'HH:mm:ss')}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(currentTime, 'dd/MM/yyyy')}
              </span>
            </div>

            <Toggle
              variant="outline"
              size="sm"
              pressed={theme === 'dark'}
              onPressedChange={(pressed) => setTheme(pressed ? 'dark' : 'light')}
            >
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Toggle>

            <Separator orientation="vertical" className="h-6" />

            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
