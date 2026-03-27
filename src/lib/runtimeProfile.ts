import { isElectron as isElectronAPI } from '@/lib/dataProvider';

/** Detect desktop even if preload hasn't injected electronAPI yet (file:// protocol). */
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const isElectron = (): boolean => isElectronAPI() || isFileProtocol;
import { getLocalServerAvailabilitySnapshot, refreshLocalServerAvailability } from '@/lib/localServerProvider';

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
  localServerAvailable: boolean;
  fallbackActive: boolean;
}

export const getRuntimeProfile = (): RuntimeProfile => {
  const isDesktop = isElectron();
  const localServerAvailable = isDesktop && getLocalServerAvailabilitySnapshot();
  const dataMode: DataMode = localServerAvailable ? 'local-server' : 'cloud';

  return {
    target: isDesktop ? 'desktop' : 'web',
    isWeb: !isDesktop,
    isDesktop,
    authMode: 'cloud',
    dataMode,
    storageMode: dataMode,
    localServerAvailable,
    fallbackActive: isDesktop && !localServerAvailable,
  };
};

export const shouldUseLocalServer = async () => {
  if (!isElectron()) return false;
  return refreshLocalServerAvailability();
};

export const usesLocalAuth = () => getRuntimeProfile().authMode === 'local-bypass';
export const usesLocalServer = () => getRuntimeProfile().dataMode === 'local-server';
