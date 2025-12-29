import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ValidSession {
  accessToken: string;
  userId: string;
  expiresAt: number;
}

/**
 * Validates the current session by checking with the server (getUser).
 * If the JWT is invalid or expired, forces logout and redirects to /login.
 * 
 * @returns ValidSession if session is valid, null if not (and handles cleanup)
 */
export const ensureValidSession = async (): Promise<ValidSession | null> => {
  try {
    // First, get the local session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.warn('[ensureValidSession] No local session found');
      return null; // No session, but don't force logout (user might not be logged in)
    }

    // Validate the session with the server using getUser
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('[ensureValidSession] Server rejected JWT:', userError?.message);
      
      // JWT is invalid on the server - force logout
      await forceLogout('Sua sessão expirou. Por favor, faça login novamente.');
      return null;
    }

    // Session is valid!
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

/**
 * Forces logout, clears storage, shows toast, and redirects to login.
 */
export const forceLogout = async (message?: string): Promise<void> => {
  try {
    // Sign out from Supabase
    await supabase.auth.signOut();
  } catch (e) {
    console.error('[forceLogout] Error during signOut:', e);
  }

  // Clear any remaining auth tokens from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  // Show toast
  if (message) {
    toast({
      title: 'Sessão Expirada',
      description: message,
      variant: 'destructive',
    });
  }

  // Redirect to login
  window.location.href = '/login';
};

/**
 * Gets session info for diagnostics without forcing logout.
 */
export const getSessionDiagnostics = async (): Promise<{
  hasLocalSession: boolean;
  serverValidation: 'ok' | 'error' | 'no_session';
  userEmail: string | null;
  expiresAt: Date | null;
  errorMessage: string | null;
}> => {
  try {
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
