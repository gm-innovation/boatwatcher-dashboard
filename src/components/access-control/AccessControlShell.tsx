import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScanLine, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AccessControlShellProps {
  children: React.ReactNode;
  isOnline?: boolean;
}

export function AccessControlShell({ children, isOnline = true }: AccessControlShellProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Sessão encerrada' });
    navigate('/access-control/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Compact header */}
      <header className="border-b bg-card px-4 py-2 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Controle de Acesso</span>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
