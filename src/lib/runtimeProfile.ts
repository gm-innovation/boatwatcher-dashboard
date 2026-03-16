import { isElectron } from '@/lib/dataProvider';

export type RuntimeTarget = 'web' | 'desktop';
export type AuthMode = 'cloud' | 'local-bypass';
export type DataMode = 'cloud' | 'local-server';

export interface RuntimeProfile {
  target: RuntimeTarget;
  isWeb: boolean;
  isDesktop: boolean;
  authMode: AuthMode;
  dataMode: DataMode;
  storageMode: DataMode;
}

export const getRuntimeProfile = (): RuntimeProfile => {
  const isDesktop = isElectron();

  return {
    target: isDesktop ? 'desktop' : 'web',
    isWeb: !isDesktop,
    isDesktop,
    authMode: isDesktop ? 'local-bypass' : 'cloud',
    dataMode: isDesktop ? 'local-server' : 'cloud',
    storageMode: isDesktop ? 'local-server' : 'cloud',
  };
};

export const usesLocalAuth = () => getRuntimeProfile().authMode === 'local-bypass';
export const usesLocalServer = () => getRuntimeProfile().dataMode === 'local-server';
