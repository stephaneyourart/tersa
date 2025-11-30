'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type CleanupModeContextType = {
  isCleanupMode: boolean;
  selectedForCleanup: Set<string>;
  startCleanupMode: () => void;
  exitCleanupMode: () => void;
  toggleNodeSelection: (nodeId: string, isDvrTransferred: boolean) => void;
  clearSelection: () => void;
  getSelectedCount: () => number;
};

const CleanupModeContext = createContext<CleanupModeContextType | null>(null);

export function CleanupModeProvider({ children }: { children: ReactNode }) {
  const [isCleanupMode, setIsCleanupMode] = useState(false);
  const [selectedForCleanup, setSelectedForCleanup] = useState<Set<string>>(new Set());

  const startCleanupMode = useCallback(() => {
    setIsCleanupMode(true);
    setSelectedForCleanup(new Set());
  }, []);

  const exitCleanupMode = useCallback(() => {
    setIsCleanupMode(false);
    setSelectedForCleanup(new Set());
  }, []);

  const toggleNodeSelection = useCallback((nodeId: string, isDvrTransferred: boolean) => {
    // Ne pas permettre la sélection des nœuds déjà envoyés vers DVR
    if (isDvrTransferred) {
      return;
    }

    setSelectedForCleanup(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedForCleanup(new Set());
  }, []);

  const getSelectedCount = useCallback(() => {
    return selectedForCleanup.size;
  }, [selectedForCleanup]);

  return (
    <CleanupModeContext.Provider
      value={{
        isCleanupMode,
        selectedForCleanup,
        startCleanupMode,
        exitCleanupMode,
        toggleNodeSelection,
        clearSelection,
        getSelectedCount,
      }}
    >
      {children}
    </CleanupModeContext.Provider>
  );
}

export function useCleanupMode() {
  const context = useContext(CleanupModeContext);
  
  // Retourner des valeurs par défaut si pas de provider (mode non-local)
  if (!context) {
    return {
      isCleanupMode: false,
      selectedForCleanup: new Set<string>(),
      startCleanupMode: () => {},
      exitCleanupMode: () => {},
      toggleNodeSelection: () => {},
      clearSelection: () => {},
      getSelectedCount: () => 0,
    };
  }
  
  return context;
}

