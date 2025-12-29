import { format } from 'date-fns';
import { Clock, Settings, Moon, Sun, LogOut, LayoutDashboard, FileText } from 'lucide-react';
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

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const { selectedProject, selectedProjectId, setSelectedProjectId } = useProject();

  const isIndexPage = location.pathname === '/';

  // Get logos from selected project
  const clientLogo = theme === 'dark' 
    ? selectedProject?.client?.logo_url_dark 
    : selectedProject?.client?.logo_url_light;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const checkAdminRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        setIsAdmin(roleData?.role === 'admin');
      }
    };

    checkAdminRole();
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

  return (
    <header className="fixed top-0 left-0 right-0 w-full bg-background/80 backdrop-blur-sm border-b border-border animate-fade-in z-50">
      {/* Upper section - Logos */}
      <div className="w-full border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-2">
          {/* Client Logo */}
          {clientLogo ? (
            <img src={clientLogo} alt="Logo do Cliente" className="h-8 w-28 object-contain" />
          ) : (
            <div className="h-8 w-28 bg-muted rounded" />
          )}

          {/* System Logo - placeholder */}
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
              className={location.pathname === '/' ? 'bg-accent' : ''}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/reports')}
              className={location.pathname === '/reports' ? 'bg-accent' : ''}
            >
              <FileText className="h-4 w-4 mr-2" />
              Relatórios
            </Button>
          </div>

          {/* Center - Project Selector */}
          <div className="flex items-center">
            {isIndexPage && (
              <ProjectSelector
                selectedProjectId={selectedProjectId}
                onProjectSelect={setSelectedProjectId}
              />
            )}
          </div>

          {/* Right - Controls */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end mr-4 border-r pr-4">
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
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Toggle>

            {isAdmin && (
              <>
                <Separator orientation="vertical" className="h-6" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/settings')}
                  className={location.pathname === '/settings' ? 'bg-accent' : ''}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            )}

            <Separator orientation="vertical" className="h-6" />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
