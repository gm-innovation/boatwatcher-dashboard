import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isElectron } from '@/lib/dataProvider';
import type { User, Session } from '@supabase/supabase-js';
import { useToast } from '@/components/ui/use-toast';

// Fake user for Electron offline mode
const ELECTRON_USER: User = {
  id: 'local-admin-000',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'admin@local',
  app_metadata: {},
  user_metadata: { name: 'Admin Local' },
  created_at: new Date().toISOString(),
} as unknown as User;

const ELECTRON_SESSION: Session = {
  access_token: 'local-token',
  refresh_token: 'local-refresh',
  expires_in: 999999,
  token_type: 'bearer',
  user: ELECTRON_USER,
} as unknown as Session;

export const useAuth = (requiredRole?: string) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Electron offline bypass — auto-login as local admin
    if (isElectron()) {
      setUser(ELECTRON_USER);
      setSession(ELECTRON_SESSION);
      setRole('admin');
      setLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role check to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            checkUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
          if (event === 'SIGNED_OUT') {
            navigate('/login');
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        setLoading(false);
        navigate('/login');
        return;
      }

      checkUserRole(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUserRole = async (userId: string) => {
    try {
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        setLoading(false);
        return;
      }

      const userRole = roleData?.role || null;
      setRole(userRole);

      if (requiredRole && userRole !== requiredRole) {
        toast({
          title: "Acesso Negado",
          description: "Você não tem permissão para acessar esta página.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error('Error checking user role:', error);
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (isElectron()) {
      // In Electron, just reload
      window.location.reload();
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return { user, session, loading, role, signOut };
};
