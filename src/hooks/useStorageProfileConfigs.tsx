/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { profileConfigsType } from '../types/localStorageProfileConfigsType';
import { useAuth } from './useAuth';

const keyFor = (uid: string) => `profile-configs-${uid}`;

export const useStorageProfileConfigs = () => {
  const { uid } = useAuth();

  // null = ainda não carregado
  const [profileConfigs, setProfileConfigs] = React.useState<profileConfigsType | null>(null);

  React.useEffect(() => {
    if (!uid) return;

    if (typeof window === 'undefined') return;

    const raw = localStorage.getItem(keyFor(uid));
    if (raw) {
      try {
        setProfileConfigs(JSON.parse(raw) as profileConfigsType);
      } catch {
        const defaults: profileConfigsType = { expandedSidebar: true, userId: uid };
        localStorage.setItem(keyFor(uid), JSON.stringify(defaults));
        setProfileConfigs(defaults);
      }
    } else {
      const defaults: profileConfigsType = { expandedSidebar: true, userId: uid };
      localStorage.setItem(keyFor(uid), JSON.stringify(defaults));
      setProfileConfigs(defaults);
    }
  }, [uid]);

  const save = React.useCallback((next: profileConfigsType) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(keyFor(next.userId), JSON.stringify(next));
    }
    setProfileConfigs(next);
  }, []);

  const changeSidebar = React.useCallback((newState: boolean) => {
    setProfileConfigs(prev => {
      if (!prev) return prev;
      const next = { ...prev, expandedSidebar: newState };
      if (typeof window !== 'undefined') {
        localStorage.setItem(keyFor(prev.userId), JSON.stringify(next));
      }
      return next;
    });
  }, []);

  return {
    profileConfigs,
    changeSidebar,
    ready: profileConfigs !== null,
  };
};
