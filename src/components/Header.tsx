import { format } from 'date-fns';
import { Clock, Moon, Sun, LogOut, LayoutDashboard, FileText, Users, Building2, Shield, Menu, RefreshCw, ToggleLeft, ToggleRight, Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react';
import { isElectron, getElectronAPI } from '@/lib/dataProvider';
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
  const { selectedProject, selectedProjectId, setSelectedProjectId, lastUpdate, autoRefresh, setAutoRefresh, handleRefresh } = useProject();
  const { role, signOut } = useAuthContext();

  const isAdmin = role === 'admin';
  const isCompanyAdmin = role === 'company_admin';
  const isDesktop = isElectron();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<{ syncing: boolean; lastSync: string | null; pendingCount: number }>({ syncing: false, lastSync: null, pendingCount: 0 });

  useEffect(() => {
    if (!isDesktop) return;
    const api = getElectronAPI();
    if (!api) return;
    api.onConnectivityChange((online) => setIsOnline(online));
    api.onSyncStatusChange((status) => {
      setIsOnline(status.online);
      setSyncStatus({ syncing: status.syncing, lastSync: status.lastSync, pendingCount: status.pendingCount });
    });
  }, [isDesktop]);

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

      {/* Navigation bar */}
      <div className="w-full border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1">
          <div className="flex items-center justify-between">
            {/* Mobile Menu */}
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
                      <Button variant={isActive('/') && location.pathname === '/' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => handleMobileNavigate('/')}>
                        <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                      </Button>
                      <Button variant={isActive('/reports') ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => handleMobileNavigate('/reports')}>
                        <FileText className="h-4 w-4 mr-2" /> Relatórios
                      </Button>
                      {isCompanyAdmin && (
                        <Button variant={isActive('/company-portal') ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => handleMobileNavigate('/company-portal')}>
                          <Building2 className="h-4 w-4 mr-2" /> Portal da Empresa
                        </Button>
                      )}
                      {(isAdmin || isCompanyAdmin) && (
                        <Button variant={isActive('/people') ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => handleMobileNavigate('/people')}>
                          <Users className="h-4 w-4 mr-2" /> Gestão de Pessoas
                        </Button>
                      )}
                      {isAdmin && (
                        <Button variant={isActive('/admin') ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => handleMobileNavigate('/admin')}>
                          <Shield className="h-4 w-4 mr-2" /> Administração
                        </Button>
                      )}
                    </nav>
                    <div className="p-4 border-t border-border space-y-3">
                      <ProjectSelector selectedProjectId={selectedProjectId} onProjectSelect={setSelectedProjectId} />
                      <div className="flex items-center justify-between">
                        <Toggle variant="outline" size="sm" pressed={theme === 'dark'} onPressedChange={(pressed) => setTheme(pressed ? 'dark' : 'light')}>
                          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                        </Toggle>
                        <Button variant="ghost" size="sm" onClick={signOut}>
                          <LogOut className="h-4 w-4 mr-2" /> Sair
                        </Button>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              <NavButton path="/" icon={LayoutDashboard} label="Dashboard" />
              <NavButton path="/reports" icon={FileText} label="Relatórios" />
              <NavButton path="/company-portal" icon={Building2} label="Portal da Empresa" condition={isCompanyAdmin} />
              <NavButton path="/people" icon={Users} label="Gestão de Pessoas" condition={isAdmin || isCompanyAdmin} />
              <NavButton path="/admin" icon={Shield} label="Administração" condition={isAdmin} />
            </div>

            {/* Right - Refresh + Controls */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-muted-foreground">
                Atualizado: {format(lastUpdate, 'HH:mm:ss')}
              </span>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="gap-1"
              >
                {autoRefresh ? (
                  <ToggleRight className="h-5 w-5 text-primary" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="hidden sm:inline">Auto</span>
              </Button>

              {isDesktop && (
                <div className="hidden lg:flex items-center gap-1 border-l border-border pl-2">
                  {isOnline ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Cloud className="h-4 w-4" /> Online
                      {syncStatus.syncing && <RefreshCw className="h-3 w-3 animate-spin" />}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-orange-500">
                      <CloudOff className="h-4 w-4" /> Offline
                      {syncStatus.pendingCount > 0 && (
                        <span className="bg-orange-500 text-white text-[10px] px-1 rounded-full">{syncStatus.pendingCount}</span>
                      )}
                    </span>
                  )}
                </div>
              )}
              <div className="hidden lg:flex items-center gap-1 border-l border-border pl-2">
                <Toggle variant="outline" size="sm" pressed={theme === 'dark'} onPressedChange={(pressed) => setTheme(pressed ? 'dark' : 'light')}>
                  {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </Toggle>
                <Button variant="ghost" size="icon" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Selector bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <ProjectSelector selectedProjectId={selectedProjectId} onProjectSelect={setSelectedProjectId} />
      </div>
    </header>
  );
};
