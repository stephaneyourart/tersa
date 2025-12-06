'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PerformanceModeState {
  // Mode performance global (désactive toutes les lectures vidéo)
  isPerformanceMode: boolean;
  
  // Toggle le mode performance
  togglePerformanceMode: () => void;
  setPerformanceMode: (enabled: boolean) => void;
  
  // Statistiques pour l'indicateur
  videoCount: number;
  setVideoCount: (count: number) => void;
}

export const usePerformanceModeStore = create<PerformanceModeState>()(
  persist(
    (set) => ({
      isPerformanceMode: false,
      videoCount: 0,
      
      togglePerformanceMode: () => set((state) => ({ 
        isPerformanceMode: !state.isPerformanceMode 
      })),
      
      setPerformanceMode: (enabled) => set({ isPerformanceMode: enabled }),
      
      setVideoCount: (count) => set({ videoCount: count }),
    }),
    {
      name: 'tersa-performance-mode',
    }
  )
);

// Hook pratique pour accéder au mode
export function usePerformanceMode() {
  const isPerformanceMode = usePerformanceModeStore((s) => s.isPerformanceMode);
  const togglePerformanceMode = usePerformanceModeStore((s) => s.togglePerformanceMode);
  const videoCount = usePerformanceModeStore((s) => s.videoCount);
  
  return {
    isPerformanceMode,
    togglePerformanceMode,
    videoCount,
    // Suggérer le mode performance si beaucoup de vidéos
    shouldSuggestPerformanceMode: videoCount > 10,
  };
}
