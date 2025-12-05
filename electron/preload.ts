import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron API exposed to the renderer process (React/Next.js)
 * Access via window.electronAPI in your React components
 */
const electronAPI = {
  // ============================================
  // App Information
  // ============================================
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
  isPackaged: (): Promise<boolean> => ipcRenderer.invoke('app:isPackaged'),

  // ============================================
  // Native Dialogs
  // ============================================
  selectFolder: (): Promise<string | null> => 
    ipcRenderer.invoke('dialog:selectFolder'),
  
  selectFile: (filters?: { name: string; extensions: string[] }[]): Promise<string | null> => 
    ipcRenderer.invoke('dialog:selectFile', filters),
  
  saveFile: (defaultPath?: string): Promise<string | null> => 
    ipcRenderer.invoke('dialog:saveFile', defaultPath),

  // ============================================
  // Persistent Storage
  // ============================================
  storeGet: <T>(key: string): Promise<T | undefined> => 
    ipcRenderer.invoke('store:get', key),
  
  storeSet: (key: string, value: unknown): Promise<void> => 
    ipcRenderer.invoke('store:set', key, value),
  
  storeDelete: (key: string): Promise<void> => 
    ipcRenderer.invoke('store:delete', key),

  // ============================================
  // License Management (to be implemented)
  // ============================================
  validateLicense: (code: string): Promise<LicenseValidation> => 
    ipcRenderer.invoke('license:validate', code),
  
  getLicenseStatus: (): Promise<LicenseStatus> => 
    ipcRenderer.invoke('license:status'),

  // ============================================
  // DaVinci Resolve Bridge (to be implemented)
  // ============================================
  davinciConnect: (): Promise<{ connected: boolean; version?: string }> => 
    ipcRenderer.invoke('davinci:connect'),
  
  davinciImportMedia: (files: string[], binName?: string): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('davinci:importMedia', files, binName),
  
  davinciCreateBin: (name: string): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('davinci:createBin', name),
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// ============================================
// Type Definitions
// ============================================

interface LicenseValidation {
  valid: boolean;
  error?: string;
  license?: {
    code: string;
    expiresAt: string;
    generationsRemaining: number;
    features: string[];
  };
}

interface LicenseStatus {
  status: 'VALID' | 'EXPIRED' | 'NO_LICENSE' | 'OFFLINE_GRACE';
  code?: string;
  expiresAt?: string;
  generationsRemaining?: number;
  features?: string[];
  needsActivation: boolean;
  offlineUntil?: string;
}

// Export types for use in the main process
export type { LicenseValidation, LicenseStatus };
