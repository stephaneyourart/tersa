'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to detect and interact with Electron environment
 * Returns isElectron: false when running in a regular browser
 * Returns isElectron: true with API access when running in Electron
 */
export function useElectron() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if we're running in Electron
    setIsElectron(
      typeof window !== 'undefined' && 
      'electronAPI' in window &&
      window.electronAPI !== undefined
    );
  }, []);

  return {
    isElectron,
    api: isElectron ? window.electronAPI : null,
  };
}

/**
 * Hook to get Electron app info
 */
export function useElectronAppInfo() {
  const { isElectron, api } = useElectron();
  const [appInfo, setAppInfo] = useState<{
    version: string;
    platform: string;
    isPackaged: boolean;
  } | null>(null);

  useEffect(() => {
    if (isElectron && api) {
      Promise.all([
        api.getVersion(),
        api.getPlatform(),
        api.isPackaged(),
      ]).then(([version, platform, isPackaged]) => {
        setAppInfo({ version, platform, isPackaged });
      });
    }
  }, [isElectron, api]);

  return appInfo;
}
