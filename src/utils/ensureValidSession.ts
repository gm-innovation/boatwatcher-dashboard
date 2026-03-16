import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { LOCAL_DESKTOP_SESSION, LOCAL_DESKTOP_USER } from '@/lib/authRuntime';
import { usesLocalAuth } from '@/lib/runtimeProfile';

export interface ValidSession {
  accessToken: string;
  userId: string;
  expiresAt: number;
}

export const ensureValidSession = async (): Promise<ValidSession | null> => {
  try {
    if (usesLocalAuth()) {
      return {
        accessToken: LOCAL_DESKTOP_SESSION.access_token,
        userId: LOCAL_DESKTOP_USER.id,
        expiresAt: 0,
      };
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.warn('[ensureValidSession] No local session found');
      return null;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[ensureValidSession] Server rejected JWT:', userError?.message);
      await forceLogout('Sua sessão expirou. Por favor, faça login novamente.');
      return null;
    }

    return {
      accessToken: session.access_token,
      userId: user.id,
      expiresAt: session.expires_at || 0,
    };
  } catch (error) {
    console.error('[ensureValidSession] Unexpected error:', error);
    return null;
  }
};

export const forceLogout = async (message?: string): Promise<void> => {
  if (usesLocalAuth()) {
    window.location.href = '/';
    return;
  }

  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error('[forceLogout] Error during signOut:', e);
  }

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  if (message) {
    toast({
      title: 'Sessão Expirada',
      description: message,
      variant: 'destructive',
    });
  }

  window.location.href = '/login';
};

export const getSessionDiagnostics = async (): Promise<{
  hasLocalSession: boolean;
  serverValidation: 'ok' | 'error' | 'no_session';
  userEmail: string | null;
  expiresAt: Date | null;
  errorMessage: string | null;
}> => {
  try {
    if (usesLocalAuth()) {
      return {
        hasLocalSession: true,
        serverValidation: 'ok',
        userEmail: LOCAL_DESKTOP_USER.email || null,
        expiresAt: null,
        errorMessage: null,
      };
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return {
        hasLocalSession: false,
        serverValidation: 'no_session',
        userEmail: null,
        expiresAt: null,
        errorMessage: null,
      };
    }

    const { data: { user }, error } = await supabase.auth.getUser();

    return {
      hasLocalSession: true,
      serverValidation: error ? 'error' : 'ok',
      userEmail: user?.email || session.user?.email || null,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      errorMessage: error?.message || null,
    };
  } catch (error: any) {
    return {
      hasLocalSession: false,
      serverValidation: 'error',
      userEmail: null,
      expiresAt: null,
      errorMessage: error?.message || 'Erro desconhecido',
    };
  }
};
