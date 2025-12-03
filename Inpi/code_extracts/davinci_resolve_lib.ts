/**
 * DaVinci Resolve Integration Service
 * Service côté serveur pour communiquer avec DaVinci Resolve via le bridge Python
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

// Types pour l'intégration DaVinci Resolve
export type DVRStatus = {
  connected: boolean;
  error: string | null;
  project: string | null;
  mediaPoolFolder: string | null;
};

export type DVRImportResult = {
  success: boolean;
  error: string | null;
  project: string | null;
  folder: string | null;
  clipName?: string;
};

export type DVRMetadata = {
  scene?: string;
  comments?: string;
  description?: string;
};

export type DVRFolder = {
  name: string;
  path: string;
};

export type DVRFoldersResult = {
  success: boolean;
  error: string | null;
  folders: DVRFolder[];
};

export type DVRCreateFolderResult = {
  success: boolean;
  error: string | null;
  folderName?: string;
};

export type DVRFocusSearchResult = {
  success: boolean;
  error: string | null;
  project?: string;
  searchedClip?: string;
};

export type DVRClipInfo = {
  name: string;
  folder: string;
  exact_match: boolean;
  matched_base_name?: boolean;
};

export type DVRCheckClipResult = {
  success: boolean;
  error?: string | null;
  found: boolean;
  project?: string;
  clip_info?: DVRClipInfo;
  searched_folders?: string[];
  message?: string;
};

// Chemin vers le script Python bridge
const BRIDGE_SCRIPT_PATH = join(process.cwd(), 'scripts', 'davinci-resolve-bridge.py');

// Chemin Python à utiliser (peut être configuré via env)
const PYTHON_PATH = process.env.DAVINCI_PYTHON_PATH || 'python3';

/**
 * Exécute une commande sur le bridge Python
 */
async function executeBridgeCommand(command: string, args: string[] = []): Promise<string> {
  const escapedArgs = args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
  const fullCommand = `${PYTHON_PATH} "${BRIDGE_SCRIPT_PATH}" ${command} ${escapedArgs}`;
  
  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: 30000, // 30 secondes timeout
      maxBuffer: 1024 * 1024, // 1MB buffer
    });
    
    if (stderr && !stdout) {
      console.error('[DVR Bridge] stderr:', stderr);
    }
    
    return stdout.trim();
  } catch (error: unknown) {
    const execError = error as { message?: string; killed?: boolean; code?: string | number };
    
    if (execError.killed) {
      throw new Error('DaVinci Resolve bridge timeout');
    }
    
    // Vérifier si c'est une erreur de module non trouvé
    if (execError.message?.includes('ModuleNotFoundError') || 
        execError.message?.includes('DaVinciResolveScript')) {
      throw new Error('DaVinci Resolve scripting module not found. Make sure Resolve is installed.');
    }
    
    throw new Error(`Bridge execution failed: ${execError.message || 'Unknown error'}`);
  }
}

/**
 * Parse la réponse JSON du bridge
 */
function parseResponse<T>(response: string): T {
  try {
    return JSON.parse(response) as T;
  } catch {
    throw new Error(`Failed to parse bridge response: ${response}`);
  }
}

/**
 * Vérifie le statut de la connexion à DaVinci Resolve
 */
export async function getDVRStatus(): Promise<DVRStatus> {
  try {
    const response = await executeBridgeCommand('status');
    return parseResponse<DVRStatus>(response);
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      project: null,
      mediaPoolFolder: null,
    };
  }
}

/**
 * Importe un fichier média dans DaVinci Resolve
 * 
 * @param filePath - Chemin absolu du fichier à importer
 * @param targetFolder - Dossier cible dans le Media Pool (supporte les sous-dossiers avec "/")
 * @param clipName - Nom du clip dans DVR (optionnel)
 * @param metadata - Métadonnées à appliquer au clip (optionnel)
 */
export async function importToDVR(
  filePath: string,
  targetFolder?: string,
  clipName?: string,
  metadata?: DVRMetadata
): Promise<DVRImportResult> {
  try {
    const args = [filePath];
    args.push(targetFolder || '');
    args.push(clipName || '');
    
    // Ajouter les métadonnées en JSON
    if (metadata) {
      args.push(JSON.stringify(metadata));
    }
    
    const response = await executeBridgeCommand('import', args);
    return parseResponse<DVRImportResult>(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      project: null,
      folder: null,
    };
  }
}

/**
 * Liste les dossiers du Media Pool
 */
export async function listDVRFolders(): Promise<DVRFoldersResult> {
  try {
    const response = await executeBridgeCommand('list-folders');
    return parseResponse<DVRFoldersResult>(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      folders: [],
    };
  }
}

/**
 * Crée un nouveau dossier dans le Media Pool
 * 
 * @param folderName - Nom du dossier à créer
 * @param parentPath - Chemin du dossier parent (optionnel)
 */
export async function createDVRFolder(
  folderName: string,
  parentPath?: string
): Promise<DVRCreateFolderResult> {
  try {
    const args = [folderName];
    if (parentPath) {
      args.push(parentPath);
    }
    
    const response = await executeBridgeCommand('create-folder', args);
    return parseResponse<DVRCreateFolderResult>(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Met DaVinci Resolve au premier plan et recherche un clip par son nom
 * 
 * @param clipName - Nom du clip à rechercher
 * @param targetFolder - Dossier où naviguer avant la recherche (optionnel)
 * @param searchShortcut - Raccourci clavier pour la recherche (ex: "cmd+shift+f")
 */
export async function focusAndSearchDVR(
  clipName: string,
  targetFolder?: string,
  searchShortcut?: string
): Promise<DVRFocusSearchResult> {
  try {
    const args = [clipName];
    args.push(targetFolder || '');
    if (searchShortcut) {
      args.push(searchShortcut);
    }
    
    const response = await executeBridgeCommand('focus-search', args);
    return parseResponse<DVRFocusSearchResult>(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Vérifie si un clip existe dans DaVinci Resolve
 * 
 * @param clipName - Nom du clip à rechercher
 * @param targetFolder - Dossier où chercher (optionnel, cherche dans les deux dossiers TersaFork par défaut)
 * @param searchBothFolders - Si true, cherche aussi dans l'autre dossier TersaFork
 */
export async function checkClipInDVR(
  clipName: string,
  targetFolder?: string,
  searchBothFolders: boolean = true
): Promise<DVRCheckClipResult> {
  try {
    const args = [clipName];
    args.push(targetFolder || '');
    args.push(searchBothFolders ? 'true' : 'false');
    
    const response = await executeBridgeCommand('check-clip', args);
    return parseResponse<DVRCheckClipResult>(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      found: false,
    };
  }
}

/**
 * Vérifie si l'intégration DaVinci Resolve est activée
 */
export function isDVREnabled(): boolean {
  return process.env.DAVINCI_RESOLVE_ENABLED === 'true';
}

/**
 * Obtient le dossier cible par défaut pour les imports
 */
export function getDefaultDVRFolder(): string | undefined {
  return process.env.DAVINCI_DEFAULT_FOLDER;
}

