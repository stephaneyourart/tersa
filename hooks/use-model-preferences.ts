'use client';

import { useState, useEffect } from 'react';

export function useModelPreferences() {
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wavespeed_model_preferences');
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load model preferences', e);
    }
    setLoaded(true);
  }, []);

  const toggleModel = (modelId: string, enabled: boolean) => {
    const newPrefs = { ...preferences, [modelId]: enabled };
    setPreferences(newPrefs);
    localStorage.setItem('wavespeed_model_preferences', JSON.stringify(newPrefs));
  };

  const isModelEnabled = (modelId: string) => {
    // If no preferences set (first load), default to true or false?
    // User requirement: "uniquement ceux qui sont 'ON' seront disponibles".
    // If nothing is stored, maybe all are ON by default?
    // Let's assume default is OFF if not explicitly ON in the "whitelist" logic, 
    // OR default is ON if key is missing.
    // Given the phrasing "toggle les modèles que je garde", it implies filtering.
    // Safest bet: If preference entry exists, use it. If not, default to TRUE (show all initially).
    if (!loaded) return true;
    return preferences[modelId] !== false; 
  };

  return { preferences, toggleModel, isModelEnabled, loaded };
}

