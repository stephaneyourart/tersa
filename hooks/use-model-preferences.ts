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
    // User requirement: "uniquement ceux qui sont 'ON' seront disponibles dans la liste"
    // Donc par défaut, un modèle est OFF s'il n'est pas explicitement activé
    // Seuls les modèles avec preferences[modelId] === true apparaissent
    if (!loaded) return false; // Pendant le chargement, ne rien montrer
    return preferences[modelId] === true; // Doit être explicitement true
  };

  return { preferences, toggleModel, isModelEnabled, loaded };
}

