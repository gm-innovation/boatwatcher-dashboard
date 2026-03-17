import { useEffect, useState } from 'react';
import { isElectron } from '@/lib/dataProvider';
import { refreshLocalServerAvailability, subscribeToLocalServerAvailability } from '@/lib/localServerProvider';
import { getRuntimeProfile, type RuntimeProfile } from '@/lib/runtimeProfile';

export const useRuntimeProfile = () => {
  const [profile, setProfile] = useState<RuntimeProfile>(() => getRuntimeProfile());

  useEffect(() => {
    if (!isElectron()) {
      setProfile(getRuntimeProfile());
      return;
    }

    let mounted = true;

    const syncProfile = async (force = false) => {
      await refreshLocalServerAvailability(force ? { force: true } : undefined);
      if (mounted) {
        setProfile(getRuntimeProfile());
      }
    };

    void syncProfile();

    const unsubscribe = subscribeToLocalServerAvailability(() => {
      if (mounted) {
        setProfile(getRuntimeProfile());
      }
    });

    const intervalId = window.setInterval(() => {
      void syncProfile(true);
    }, 15000);

    return () => {
      mounted = false;
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, []);

  return profile;
};
