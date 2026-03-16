import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { useToast } from '@/components/ui/use-toast';
import { LOCAL_DESKTOP_SESSION, LOCAL_DESKTOP_USER } from '@/lib/authRuntime';
import { usesLocalAuth } from '@/lib/runtimeProfile';

export const useAuth = (requiredRole?: string) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

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
          title: 'Acesso Negado',
          description: 'Você não tem permissão para acessar esta página.',
          variant: 'destructive',
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

  useEffect(() => {
    if (usesLocalAuth()) {
      setUser(LOCAL_DESKTOP_USER);
      setSession(LOCAL_DESKTOP_SESSION);
      setRole('admin');
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setTimeout(() => {
          checkUserRole(nextSession.user.id);
        }, 0);
      } else {
        setRole(null);
        setLoading(false);

        if (event === 'SIGNED_OUT') {
          navigate('/login');
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!currentSession) {
        setLoading(false);
        navigate('/login');
        return;
      }

      checkUserRole(currentSession.user.id);
    });

    return () => subscription.unsubscribe();
  }, [navigate, requiredRole]);

  const signOut = async () => {
    if (usesLocalAuth()) {
      window.location.reload();
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: 'Erro ao sair',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return { user, session, loading, role, signOut };
};
