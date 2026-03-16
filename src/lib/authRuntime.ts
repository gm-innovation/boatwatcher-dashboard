import type { Session, User } from '@supabase/supabase-js';

export const LOCAL_DESKTOP_USER: User = {
  id: 'local-admin-000',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'admin@local',
  app_metadata: {},
  user_metadata: { name: 'Admin Local' },
  created_at: new Date().toISOString(),
} as unknown as User;

export const LOCAL_DESKTOP_SESSION: Session = {
  access_token: 'local-token',
  refresh_token: 'local-refresh',
  expires_in: 999999,
  token_type: 'bearer',
  user: LOCAL_DESKTOP_USER,
} as unknown as Session;
