/**
 * Type definitions for the Electron API exposed to the renderer process
 */

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

interface ElectronAPI {
  // App Information
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  isPackaged: () => Promise<boolean>;

  // Native Dialogs
  selectFolder: () => Promise<string | null>;
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  saveFile: (defaultPath?: string) => Promise<string | null>;

  // Persistent Storage
  storeGet: <T>(key: string) => Promise<T | undefined>;
  storeSet: (key: string, value: unknown) => Promise<void>;
  storeDelete: (key: string) => Promise<void>;

  // License Management
  validateLicense: (code: string) => Promise<LicenseValidation>;
  getLicenseStatus: () => Promise<LicenseStatus>;

  // DaVinci Resolve Bridge
  davinciConnect: () => Promise<{ connected: boolean; version?: string }>;
  davinciImportMedia: (files: string[], binName?: string) => Promise<{ success: boolean; error?: string }>;
  davinciCreateBin: (name: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export type { ElectronAPI, LicenseValidation, LicenseStatus };
