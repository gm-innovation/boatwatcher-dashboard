import { format } from 'date-fns';
import { Clock, Settings, Moon, Sun, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { useTheme } from '@/components/theme-provider';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

interface ProjectData {
  project: {
    client: {
      logo_url: string | null;
    } | null;
  } | null;
}

export const Header = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientLogo, setClientLogo] = useState<string | null>(null);
  const { toast } = useToast();

  // Get company logo based on current theme
  const companyLogo = localStorage.getItem(`company_${theme}`);

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
          .single();
        
        setIsAdmin(roleData?.role === 'admin');

        // Fetch client logo from user's projects
        const { data: projectData } = await supabase
          .from('user_projects')
          .select(`
            project:projects (
              client:companies (
                logo_url
              )
            )
          `)
          .eq('user_id', session.user.id)
          .single();

        if (projectData?.project?.client?.logo_url) {
          setClientLogo(projectData.project.client.logo_url);
        }
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
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center space-x-2">
          {clientLogo ? (
            <img src={clientLogo} alt="Logo do Cliente" className="h-10 w-32 object-contain" />
          ) : (
            <div className="h-10 w-32 bg-muted rounded animate-pulse" />
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-2 text-foreground/80">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
              className="ml-4"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="ml-4"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {companyLogo ? (
            <img src={companyLogo} alt="Logo da Empresa" className="h-10 w-32 object-contain" />
          ) : (
            <div className="h-10 w-32 bg-muted rounded animate-pulse" />
          )}
        </div>
      </div>
    </header>
  );
};