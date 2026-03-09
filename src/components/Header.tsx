import { format } from 'date-fns';
import { Clock, Moon, Sun, LogOut, LayoutDashboard, FileText, Users, Building2, Shield, Menu, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { useTheme } from '@/components/theme-provider';
import { ProjectSelector } from '@/components/ProjectSelector';
import { useProject } from '@/contexts/ProjectContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { selectedProject, selectedProjectId, setSelectedProjectId } = useProject();
  const { role, signOut } = useAuthContext();

  const isAdmin = role === 'admin';
  const isCompanyAdmin = role === 'company_admin';

  const clientLogo = theme === 'dark' 
    ? selectedProject?.client?.logo_url_dark 
    : selectedProject?.client?.logo_url_light;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleMobileNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const NavButton = ({ path, icon: Icon, label, condition = true }: { path: string; icon: any; label: string; condition?: boolean }) => {
    if (!condition) return null;
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(path)}
        className={`${isActive(path) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
      >
        <Icon className="h-4 w-4 mr-2" />
        {label}
      </Button>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 w-full bg-background/95 backdrop-blur-sm border-b border-border animate-fade-in z-50">
      {/* Upper section - Logos */}
      <div className="w-full border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-2">
          {clientLogo ? (
            <img src={clientLogo} alt="Logo do Cliente" className="h-8 w-28 object-contain" />
          ) : (
            <div className="h-8 w-28 bg-muted rounded flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Cliente</span>
            </div>
          )}
          <div className="h-8 w-28 bg-muted rounded flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Sistema</span>
          </div>
        </div>
      </div>

      {/* Lower section - Navigation and Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          {/* Left - Project Selector + Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Mobile Menu Trigger */}
            <div className="lg:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-border">
                      <h2 className="font-semibold text-lg">Menu</h2>
                    </div>
                    <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                      <Button
                        variant={isActive('/') && location.pathname === '/' ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => handleMobileNavigate('/')}
                      >
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Dashboard
                      </Button>
                      
                      <Button
                        variant={isActive('/reports') ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => handleMobileNavigate('/reports')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Relatórios
                      </Button>

                      {isCompanyAdmin && (
                        <Button
                          variant={isActive('/company-portal') ? 'secondary' : 'ghost'}
                          className="w-full justify-start"
                          onClick={() => handleMobileNavigate('/company-portal')}
                        >
                          <Building2 className="h-4 w-4 mr-2" />
                          Portal da Empresa
                        </Button>
                      )}

                      {(isAdmin || isCompanyAdmin) && (
                        <Button
                          variant={isActive('/people') ? 'secondary' : 'ghost'}
                          className="w-full justify-start"
                          onClick={() => handleMobileNavigate('/people')}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Gestão de Pessoas
                        </Button>
                      )}

                      {isAdmin && (
                        <Button
                          variant={isActive('/admin') ? 'secondary' : 'ghost'}
                          className="w-full justify-start"
                          onClick={() => handleMobileNavigate('/admin')}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Administração
                        </Button>
                      )}
                    </nav>

                    {/* Mobile Footer */}
                    <div className="p-4 border-t border-border space-y-3">
                      <ProjectSelector
                        selectedProjectId={selectedProjectId}
                        onProjectSelect={setSelectedProjectId}
                      />
                      <div className="flex items-center justify-between">
                        <Toggle
                          variant="outline"
                          size="sm"
                          pressed={theme === 'dark'}
                          onPressedChange={(pressed) => setTheme(pressed ? 'dark' : 'light')}
                        >
                          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                        </Toggle>
                        <Button variant="ghost" size="sm" onClick={signOut}>
                          <LogOut className="h-4 w-4 mr-2" />
                          Sair
                        </Button>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Project Selector */}
            <div className="hidden sm:block">
              <ProjectSelector
                selectedProjectId={selectedProjectId}
                onProjectSelect={setSelectedProjectId}
              />
            </div>
          </div>

          {/* Center - Navigation (desktop only) */}
          <div className="hidden lg:flex items-center gap-1">
            <NavButton path="/" icon={LayoutDashboard} label="Dashboard" />
            <NavButton path="/reports" icon={FileText} label="Relatórios" />
            <NavButton path="/company-portal" icon={Building2} label="Portal da Empresa" condition={isCompanyAdmin} />
            <NavButton path="/people" icon={Users} label="Gestão de Pessoas" condition={isAdmin || isCompanyAdmin} />
            <NavButton path="/admin" icon={Shield} label="Administração" condition={isAdmin} />
          </div>

          {/* Right - Controls */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end mr-2 border-r border-border pr-3">
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

            <div className="hidden lg:flex items-center gap-1">
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>

              <Toggle
                variant="outline"
                size="sm"
                pressed={theme === 'dark'}
                onPressedChange={(pressed) => setTheme(pressed ? 'dark' : 'light')}
              >
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Toggle>

              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
