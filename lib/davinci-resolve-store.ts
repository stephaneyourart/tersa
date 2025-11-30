/**
 * Store Zustand pour l'intégration DaVinci Resolve
 * Gère l'état de la connexion et les opérations côté client
 */

import { create } from 'zustand';
import { toast } from 'sonner';

// Types
export type DVRStatus = {
  connected: boolean;
  error: string | null;
  project: string | null;
  mediaPoolFolder: string | null;
};

export type DVRFolder = {
  name: string;
  path: string;
};

export type DVRImportResult = {
  success: boolean;
  error: string | null;
  project: string | null;
  folder: string | null;
  clipName?: string;
};

export type DVRConfig = {
  enabled: boolean;
  defaultFolder?: string;
};

// État du store
type DVRState = {
  // État
  status: DVRStatus | null;
  config: DVRConfig | null;
  folders: DVRFolder[];
  isLoading: boolean;
  lastCheck: Date | null;
  
  // Actions
  checkStatus: () => Promise<DVRStatus>;
  fetchConfig: () => Promise<DVRConfig | null>;
  fetchFolders: () => Promise<DVRFolder[]>;
  importMedia: (filePath: string, targetFolder?: string) => Promise<DVRImportResult>;
  createFolder: (folderName: string, parentPath?: string) => Promise<boolean>;
  
  // Utilitaires
  isEnabled: () => boolean;
  isConnected: () => boolean;
  getProjectName: () => string | null;
};

export const useDaVinciResolveStore = create<DVRState>((set, get) => ({
  // État initial
  status: null,
  config: null,
  folders: [],
  isLoading: false,
  lastCheck: null,

  // Vérifier le statut de connexion à DaVinci Resolve
  checkStatus: async () => {
    set({ isLoading: true });
    
    try {
      const response = await fetch('/api/davinci-resolve?action=status');
      const status = await response.json() as DVRStatus;
      
      set({ 
        status, 
        lastCheck: new Date(),
        isLoading: false 
      });
      
      return status;
    } catch (error) {
      const errorStatus: DVRStatus = {
        connected: false,
        error: error instanceof Error ? error.message : 'Network error',
        project: null,
        mediaPoolFolder: null,
      };
      
      set({ 
        status: errorStatus, 
        lastCheck: new Date(),
        isLoading: false 
      });
      
      return errorStatus;
    }
  },

  // Récupérer la configuration DVR
  fetchConfig: async () => {
    try {
      const response = await fetch('/api/davinci-resolve?action=config');
      
      if (!response.ok) {
        // L'intégration n'est pas activée
        set({ config: { enabled: false } });
        return null;
      }
      
      const config = await response.json() as DVRConfig;
      set({ config });
      return config;
    } catch {
      set({ config: { enabled: false } });
      return null;
    }
  },

  // Récupérer la liste des dossiers du Media Pool
  fetchFolders: async () => {
    try {
      const response = await fetch('/api/davinci-resolve?action=folders');
      const result = await response.json();
      
      if (result.success && result.folders) {
        set({ folders: result.folders });
        return result.folders;
      }
      
      return [];
    } catch {
      return [];
    }
  },

  // Importer un média dans DaVinci Resolve
  importMedia: async (filePath: string, targetFolder?: string) => {
    const { status, config } = get();
    
    // Vérifier si l'intégration est activée
    if (!config?.enabled) {
      return {
        success: false,
        error: 'DaVinci Resolve integration is not enabled',
        project: null,
        folder: null,
      };
    }
    
    // Vérifier la connexion
    if (!status?.connected) {
      toast.error('Échec de l\'envoi vers DaVinci Resolve', {
        description: status?.error || 'Pas de projet actif dans DaVinci Resolve',
      });
      
      return {
        success: false,
        error: status?.error || 'Not connected to DaVinci Resolve',
        project: null,
        folder: null,
      };
    }
    
    try {
      const response = await fetch('/api/davinci-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          filePath,
          targetFolder: targetFolder || config.defaultFolder,
        }),
      });
      
      const result = await response.json() as DVRImportResult;
      
      if (result.success) {
        toast.success('Envoyé vers DaVinci Resolve', {
          description: `Projet: ${result.project} • Dossier: ${result.folder}`,
        });
      } else {
        toast.error('Échec de l\'envoi vers DaVinci Resolve', {
          description: result.error || 'Erreur inconnue',
        });
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      
      toast.error('Échec de l\'envoi vers DaVinci Resolve', {
        description: errorMessage,
      });
      
      return {
        success: false,
        error: errorMessage,
        project: null,
        folder: null,
      };
    }
  },

  // Créer un dossier dans le Media Pool
  createFolder: async (folderName: string, parentPath?: string) => {
    try {
      const response = await fetch('/api/davinci-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-folder',
          folderName,
          parentPath,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Rafraîchir la liste des dossiers
        await get().fetchFolders();
        toast.success(`Dossier "${folderName}" créé dans DaVinci Resolve`);
        return true;
      }
      
      toast.error('Échec de la création du dossier', {
        description: result.error,
      });
      return false;
    } catch (error) {
      toast.error('Échec de la création du dossier', {
        description: error instanceof Error ? error.message : 'Network error',
      });
      return false;
    }
  },

  // Utilitaires
  isEnabled: () => {
    const { config } = get();
    return config?.enabled ?? false;
  },
  
  isConnected: () => {
    const { status } = get();
    return status?.connected ?? false;
  },
  
  getProjectName: () => {
    const { status } = get();
    return status?.project ?? null;
  },
}));

/**
 * Hook pour initialiser l'intégration DaVinci Resolve
 * À appeler au démarrage de l'application
 */
export async function initializeDVRIntegration(): Promise<void> {
  const store = useDaVinciResolveStore.getState();
  
  // Charger la configuration
  const config = await store.fetchConfig();
  
  // Si activé, vérifier le statut
  if (config?.enabled) {
    await store.checkStatus();
  }
}

/**
 * Fonction utilitaire pour envoyer un fichier vers DVR
 * Vérifie automatiquement la connexion et affiche les toasts appropriés
 */
export async function pushToDaVinciResolve(
  filePath: string,
  targetFolder?: string
): Promise<DVRImportResult> {
  const store = useDaVinciResolveStore.getState();
  
  // Vérifier la configuration si pas encore chargée
  if (!store.config) {
    await store.fetchConfig();
  }
  
  // Vérifier le statut si pas encore vérifié ou vieux de plus de 30 secondes
  const now = new Date();
  const lastCheck = store.lastCheck;
  const shouldRecheck = !lastCheck || (now.getTime() - lastCheck.getTime() > 30000);
  
  if (shouldRecheck) {
    await store.checkStatus();
  }
  
  // Importer le média
  return store.importMedia(filePath, targetFolder);
}

