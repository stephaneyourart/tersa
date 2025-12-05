/**
 * Système de logging centralisé en FICHIERS JSON
 * 
 * FORMAT: JSON Lines (JSONL) - un objet JSON par ligne
 * - Extension: .jsonl pour affichage joli dans les éditeurs
 * - Un fichier par jour
 * - Auto-nettoyage après 3 jours
 * - Heure française (Europe/Paris)
 */

import fs from 'fs';
import path from 'path';

// Dossier des logs (à la racine du projet)
const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_AGE_DAYS = 3;

// Timezone français
const TIMEZONE = 'Europe/Paris';

/**
 * Formater une date en heure française (Europe/Paris)
 * Format: YYYY-MM-DDTHH:mm:ss.sss (sans le Z car ce n'est plus UTC)
 */
function formatDateFR(date: Date): string {
  const formatter = new Intl.DateTimeFormat('fr-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}`;
}

/**
 * Obtenir la date du jour en format YYYY-MM-DD (heure française)
 */
function getTodayDateFR(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('fr-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

// Types
export type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DEBUG' | 'API';
export type LogCategory = 'IMAGE' | 'VIDEO' | 'LLM' | 'API' | 'SYSTEM' | 'GENERATION';

// Interface pour une entrée de log JSON complète
interface JsonLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  event: string;
  nodeId?: string;
  model?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}

// S'assurer que le dossier logs existe
function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

// Obtenir le nom du fichier log du jour (format JSON indenté)
function getTodayLogFile(): string {
  const today = getTodayDateFR();
  return path.join(LOGS_DIR, `${today}.json`);
}

// Nettoyer les anciens logs (> 3 jours)
function cleanOldLogs(): void {
  try {
    ensureLogsDir();
    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.endsWith('.json') && !file.endsWith('.jsonl') && !file.endsWith('.log')) continue;
      
      const filePath = path.join(LOGS_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`[FileLogger] Supprimé: ${file} (> ${MAX_AGE_DAYS} jours)`);
      }
    }
  } catch (error) {
    console.error('[FileLogger] Erreur nettoyage:', error);
  }
}

// Écrire une entrée JSON dans le fichier log
function writeJsonLog(entry: JsonLogEntry): void {
  try {
    ensureLogsDir();
    const logFile = getTodayLogFile();
    
    // JSON INDENTÉ pour lisibilité dans Cursor/VS Code
    // Séparateur "---" entre chaque entrée pour faciliter la lecture
    const jsonPretty = JSON.stringify(entry, null, 2);
    const separator = '\n' + '─'.repeat(80) + '\n';
    
    fs.appendFileSync(logFile, jsonPretty + separator, 'utf-8');
    
    // Console: format court pour le terminal
    const time = entry.timestamp.slice(11, 23);
    const icon = entry.level === 'ERROR' ? '❌' : entry.level === 'SUCCESS' ? '✅' : entry.level === 'WARN' ? '⚠️' : '📝';
    const consoleMsg = `${time} ${icon} [${entry.category}] ${entry.event}`;
    
    if (entry.level === 'ERROR') {
      console.error(consoleMsg);
    } else if (entry.level === 'WARN') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }
  } catch (error) {
    console.error('[FileLogger] Erreur écriture:', error);
  }
}

// Logger principal - écrit du JSON
export function fileLog(
  level: LogLevel,
  category: LogCategory,
  event: string,
  options?: {
    nodeId?: string;
    model?: string;
    duration?: number;
    details?: Record<string, unknown>;
  }
): void {
  const entry: JsonLogEntry = {
    timestamp: formatDateFR(new Date()),
    level,
    category,
    event,
  };
  
  if (options?.nodeId) entry.nodeId = options.nodeId;
  if (options?.model) entry.model = options.model;
  if (options?.duration !== undefined) entry.durationMs = options.duration;
  if (options?.details && Object.keys(options.details).length > 0) {
    entry.data = options.details;
  }
  
  writeJsonLog(entry);
}

// ============================================================
// IMPORT DES SOURCES DE VÉRITÉ DES MODÈLES
// ============================================================

import {
  T2I_MODELS,
  I2I_MODELS,
  VIDEO_MODELS,
  LLM_MODELS,
  type ImageModel,
  type VideoModel,
  type LLMModel,
  type LLMProvider,
} from './models-registry';

// ============================================================
// MAPPING DES NOMS "SIMPLIFIÉS" VERS LES VRAIS IDS
// Source de vérité: models-registry.ts
// ============================================================

const T2I_MODEL_ALIASES: Record<string, string> = {
  // Noms simplifiés → vrais IDs WaveSpeed
  'nano-banana-pro-ultra-wavespeed': 'wavespeed/google/nano-banana-pro/text-to-image-ultra',
  'nano-banana-pro-wavespeed': 'wavespeed/google/nano-banana-pro/text-to-image',
  'nano-banana-wavespeed': 'wavespeed/google/nano-banana/text-to-image',
  'flux-schnell-wavespeed': 'wavespeed/google/nano-banana/text-to-image', // fallback
};

const I2I_MODEL_ALIASES: Record<string, string> = {
  // Noms simplifiés → vrais IDs WaveSpeed
  'nano-banana-pro-edit-ultra-wavespeed': 'wavespeed/google/nano-banana-pro/edit-ultra',
  'nano-banana-pro-edit-wavespeed': 'wavespeed/google/nano-banana-pro/edit',
  'nano-banana-edit-wavespeed': 'wavespeed/google/nano-banana/edit',
};

const VIDEO_MODEL_ALIASES: Record<string, string> = {
  // Noms simplifiés → vrais IDs WaveSpeed/Kling
  'kling-v2.6-pro': 'kwaivgi/kling-v2.6-pro/image-to-video',
  'kling-v2.6-pro-first-last': 'kwaivgi/kling-v2.5-turbo-pro/image-to-video', // v2.5 supporte first+last
  'kling-v2.5-turbo-pro': 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
  'kling-o1': 'kwaivgi/kling-v2.5-turbo-pro/image-to-video', // alias legacy
  'kling-o1-i2v': 'kwaivgi/kling-v2.5-turbo-pro/image-to-video', // alias legacy
};

// Résoudre un ID de modèle (supporte les alias)
function resolveModelId(modelId: string, aliases: Record<string, string>): string {
  return aliases[modelId] || modelId;
}

// Trouver un modèle T2I par son ID (supporte les alias)
function findT2IModel(modelId: string): ImageModel | undefined {
  const resolvedId = resolveModelId(modelId, T2I_MODEL_ALIASES);
  return T2I_MODELS.find(m => 
    m.id === resolvedId || 
    m.id === modelId ||
    m.id.includes(modelId) || 
    modelId.includes(m.id.split('/').pop() || '')
  );
}

// Trouver un modèle I2I par son ID (supporte les alias)
function findI2IModel(modelId: string): ImageModel | undefined {
  const resolvedId = resolveModelId(modelId, I2I_MODEL_ALIASES);
  return I2I_MODELS.find(m => 
    m.id === resolvedId || 
    m.id === modelId ||
    m.id.includes(modelId) || 
    modelId.includes(m.id.split('/').pop() || '')
  );
}

// Trouver un modèle vidéo par son ID (supporte les alias)
function findVideoModel(modelId: string): VideoModel | undefined {
  const resolvedId = resolveModelId(modelId, VIDEO_MODEL_ALIASES);
  return VIDEO_MODELS.find(m => 
    m.id === resolvedId || 
    m.id === modelId ||
    m.id.includes(modelId) || 
    modelId.includes(m.id.split('/').pop() || '')
  );
}

// Trouver un modèle LLM par son ID
function findLLMModel(provider: LLMProvider, modelId: string): LLMModel | undefined {
  return LLM_MODELS[provider]?.find(m => m.id === modelId);
}

// ============================================================
// INTERFACES POUR LES LOGS STRUCTURÉS
// ============================================================

interface ImageGenerationLog {
  type: 'T2I' | 'I2I';
  nodeId: string;
  model: {
    id: string;
    displayName: string;
    type: string;
    supportedAspectRatios: string[];
    supportedResolutions: string[];
    costPerImage: number;
    description: string;
  } | null;
  params: {
    aspectRatio?: string;
    resolution?: string;
    promptLength?: number;
    sourceImagesCount?: number;
    testMode?: boolean;
  };
}

interface VideoGenerationLog {
  nodeId: string;
  model: {
    id: string;
    displayName: string;
    supportsImageFirst: boolean;
    supportsImagesFirstLast: boolean;
    supportedDurations: number[];
    guidanceField: string;
    guidanceDefault: number;
    guidanceRange: [number, number];
    lastImageField: string | null;
    costPerSecond: number;
    description: string;
  } | null;
  params: {
    mode: 'first-only' | 'first+last';
    duration: number;
    hasFirstFrame: boolean;
    hasLastFrame: boolean;
    promptLength?: number;
  };
}

interface LLMGenerationLog {
  provider: LLMProvider;
  model: {
    id: string;
    displayName: string;
    supportsReasoning: boolean;
    description: string;
    costPer1MInput: number;
    costPer1MOutput: number;
  } | null;
  params: {
    reasoningLevel?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

// ============================================================
// HELPERS PAR CATÉGORIE - AVEC JSON COMPLET
// ============================================================

export const fLog = {
  // ============================================================
  // IMAGES T2I (Text-to-Image)
  // ============================================================
  t2iStart: (nodeId: string, modelId: string, params: { 
    aspectRatio?: string; 
    resolution?: string; 
    promptLength?: number;
    testMode?: boolean;
  }) => {
    const modelSpec = findT2IModel(modelId);
    const logData: ImageGenerationLog = {
      type: 'T2I',
      nodeId,
      model: modelSpec ? {
        id: modelSpec.id,
        displayName: modelSpec.displayName,
        type: modelSpec.type,
        supportedAspectRatios: modelSpec.supportedAspectRatios,
        supportedResolutions: modelSpec.supportedResolutions,
        costPerImage: modelSpec.costPerImage,
        description: modelSpec.description,
      } : null,
      params,
    };
    fileLog('INFO', 'IMAGE', `[T2I] Démarrage`, { nodeId, model: modelId, details: logData });
  },
  
  t2iSuccess: (nodeId: string, modelId: string, url: string, duration: number) => {
    const modelSpec = findT2IModel(modelId);
    fileLog('SUCCESS', 'IMAGE', `[T2I] Généré en ${duration}ms`, { 
      nodeId, 
      model: modelId, 
      duration,
      details: {
        url: url.slice(0, 100),
        modelSpec: modelSpec ? { id: modelSpec.id, cost: modelSpec.costPerImage } : null,
      }
    });
  },

  // ============================================================
  // IMAGES I2I (Image-to-Image / Edit)
  // ============================================================
  i2iStart: (nodeId: string, modelId: string, params: { 
    aspectRatio?: string; 
    resolution?: string; 
    promptLength?: number;
    sourceImagesCount?: number;
    testMode?: boolean;
  }) => {
    const modelSpec = findI2IModel(modelId);
    const logData: ImageGenerationLog = {
      type: 'I2I',
      nodeId,
      model: modelSpec ? {
        id: modelSpec.id,
        displayName: modelSpec.displayName,
        type: modelSpec.type,
        supportedAspectRatios: modelSpec.supportedAspectRatios,
        supportedResolutions: modelSpec.supportedResolutions,
        costPerImage: modelSpec.costPerImage,
        description: modelSpec.description,
      } : null,
      params,
    };
    fileLog('INFO', 'IMAGE', `[I2I] Démarrage (${params.sourceImagesCount || 1} source(s))`, { nodeId, model: modelId, details: logData });
  },
  
  i2iSuccess: (nodeId: string, modelId: string, url: string, duration: number) => {
    const modelSpec = findI2IModel(modelId);
    fileLog('SUCCESS', 'IMAGE', `[I2I] Généré en ${duration}ms`, { 
      nodeId, 
      model: modelId, 
      duration,
      details: {
        url: url.slice(0, 100),
        modelSpec: modelSpec ? { id: modelSpec.id, cost: modelSpec.costPerImage } : null,
      }
    });
  },

  // ============================================================
  // IMAGES - Rétrocompatibilité (détecte automatiquement T2I vs I2I)
  // ============================================================
  imageStart: (nodeId: string, modelId: string, prompt?: string) => {
    const isI2I = modelId.includes('edit');
    const modelSpec = isI2I ? findI2IModel(modelId) : findT2IModel(modelId);
    const logData: ImageGenerationLog = {
      type: isI2I ? 'I2I' : 'T2I',
      nodeId,
      model: modelSpec ? {
        id: modelSpec.id,
        displayName: modelSpec.displayName,
        type: modelSpec.type,
        supportedAspectRatios: modelSpec.supportedAspectRatios,
        supportedResolutions: modelSpec.supportedResolutions,
        costPerImage: modelSpec.costPerImage,
        description: modelSpec.description,
      } : null,
      params: { promptLength: prompt?.length },
    };
    fileLog('INFO', 'IMAGE', `Démarrage génération`, { nodeId, model: modelId, details: logData });
  },
  
  imageSuccess: (nodeId: string, modelId: string, url: string, duration: number) => {
    const isI2I = modelId.includes('edit');
    const modelSpec = isI2I ? findI2IModel(modelId) : findT2IModel(modelId);
    fileLog('SUCCESS', 'IMAGE', `Généré en ${duration}ms`, { 
      nodeId, 
      model: modelId, 
      duration,
      details: {
        type: isI2I ? 'I2I' : 'T2I',
        url: url.slice(0, 100),
        modelSpec: modelSpec ? { id: modelSpec.id, cost: modelSpec.costPerImage } : null,
      }
    });
  },
  
  imageError: (nodeId: string, modelId: string, error: string, details?: Record<string, unknown>) => {
    const isI2I = modelId.includes('edit');
    const modelSpec = isI2I ? findI2IModel(modelId) : findT2IModel(modelId);
    fileLog('ERROR', 'IMAGE', `Échec: ${error}`, { 
      nodeId, 
      model: modelId, 
      details: {
        ...details,
        type: isI2I ? 'I2I' : 'T2I',
        modelSpec: modelSpec ? { id: modelSpec.id } : null,
      }
    });
  },
  
  imagePolling: (nodeId: string, attempt: number, status: string) =>
    fileLog('DEBUG', 'IMAGE', `Polling #${attempt}: ${status}`, { nodeId }),

  // ============================================================
  // VIDEOS - AVEC JSON COMPLET DU MODÈLE
  // ============================================================
  videoStart: (nodeId: string, modelId: string, duration: number, mode: string) => {
    const modelSpec = findVideoModel(modelId);
    const logData: VideoGenerationLog = {
      nodeId,
      model: modelSpec ? {
        id: modelSpec.id,
        displayName: modelSpec.displayName,
        supportsImageFirst: modelSpec.supportsImageFirst,
        supportsImagesFirstLast: modelSpec.supportsImagesFirstLast,
        supportedDurations: modelSpec.supportedDurations,
        guidanceField: modelSpec.guidanceField,
        guidanceDefault: modelSpec.guidanceDefault,
        guidanceRange: modelSpec.guidanceRange,
        lastImageField: modelSpec.lastImageField,
        costPerSecond: modelSpec.costPerSecond,
        description: modelSpec.description,
      } : null,
      params: {
        mode: mode as 'first-only' | 'first+last',
        duration,
        hasFirstFrame: true,
        hasLastFrame: mode === 'first+last',
      },
    };
    fileLog('INFO', 'VIDEO', `Démarrage génération ${duration}s mode=${mode}`, { nodeId, model: modelId, details: logData });
  },
  
  videoSuccess: (nodeId: string, modelId: string, url: string, duration: number) => {
    const modelSpec = findVideoModel(modelId);
    fileLog('SUCCESS', 'VIDEO', `Généré en ${duration}ms`, { 
      nodeId, 
      model: modelId, 
      duration,
      details: {
        url: url.slice(0, 100),
        modelSpec: modelSpec ? { 
          id: modelSpec.id, 
          costPerSecond: modelSpec.costPerSecond,
          guidanceField: modelSpec.guidanceField,
        } : null,
      }
    });
  },
  
  videoError: (nodeId: string, modelId: string, error: string, details?: Record<string, unknown>) => {
    const modelSpec = findVideoModel(modelId);
    fileLog('ERROR', 'VIDEO', `Échec: ${error}`, { 
      nodeId, 
      model: modelId, 
      details: {
        ...details,
        modelSpec: modelSpec ? { 
          id: modelSpec.id,
          supportsImageFirst: modelSpec.supportsImageFirst,
          supportsImagesFirstLast: modelSpec.supportsImagesFirstLast,
          lastImageField: modelSpec.lastImageField,
        } : null,
      }
    });
  },
  
  videoPolling: (nodeId: string, attempt: number, status: string) =>
    fileLog('DEBUG', 'VIDEO', `Polling #${attempt}: ${status}`, { nodeId }),

  // ============================================================
  // LLM - AVEC JSON COMPLET DU MODÈLE
  // ============================================================
  llmStart: (provider: LLMProvider, modelId: string, params?: { reasoningLevel?: string; temperature?: number }) => {
    const modelSpec = findLLMModel(provider, modelId);
    const logData: LLMGenerationLog = {
      provider,
      model: modelSpec ? {
        id: modelSpec.id,
        displayName: modelSpec.displayName,
        supportsReasoning: modelSpec.supportsReasoning,
        description: modelSpec.description,
        costPer1MInput: modelSpec.costPer1MInput,
        costPer1MOutput: modelSpec.costPer1MOutput,
      } : null,
      params: params || {},
    };
    fileLog('INFO', 'LLM', `Démarrage ${provider}/${modelId}`, { model: modelId, details: logData });
  },
  
  llmSuccess: (provider: LLMProvider, modelId: string, tokens: number, duration: number) => {
    const modelSpec = findLLMModel(provider, modelId);
    fileLog('SUCCESS', 'LLM', `Réponse ${tokens} tokens en ${duration}ms`, { 
      model: modelId, 
      duration,
      details: {
        tokens,
        modelSpec: modelSpec ? { 
          id: modelSpec.id, 
          costPer1MInput: modelSpec.costPer1MInput,
          costPer1MOutput: modelSpec.costPer1MOutput,
        } : null,
      }
    });
  },
  
  llmError: (provider: LLMProvider, modelId: string, error: string) => {
    const modelSpec = findLLMModel(provider, modelId);
    fileLog('ERROR', 'LLM', `Échec: ${error}`, { 
      model: modelId,
      details: {
        provider,
        modelSpec: modelSpec ? { id: modelSpec.id } : null,
      }
    });
  },

  // ============================================================
  // API
  // ============================================================
  apiCall: (endpoint: string, method: string, params?: Record<string, unknown>) =>
    fileLog('API', 'API', `${method} ${endpoint}`, { details: params }),
  
  apiResponse: (endpoint: string, status: number, duration: number) =>
    fileLog('API', 'API', `Réponse ${status}`, { duration, details: { endpoint } }),
  
  apiError: (endpoint: string, status: number, error: string) =>
    fileLog('ERROR', 'API', `${endpoint} → ${status}: ${error}`, {}),

  // ============================================================
  // GÉNÉRATION (séquences)
  // ============================================================
  genStart: (sessionId: string, config: Record<string, unknown>) =>
    fileLog('INFO', 'GENERATION', `=== SESSION DÉMARRÉE: ${sessionId} ===`, { details: config }),
  
  genProgress: (completed: number, total: number, successes: number, errors: number) =>
    fileLog('INFO', 'GENERATION', `Progression: ${completed}/${total} (✓${successes} ✗${errors})`, {}),
  
  genEnd: (sessionId: string, duration: number, stats: Record<string, unknown>) =>
    fileLog('SUCCESS', 'GENERATION', `=== SESSION TERMINÉE: ${sessionId} (${duration}s) ===`, { duration, details: stats }),
  
  genError: (sessionId: string, error: string, details?: Record<string, unknown>) =>
    fileLog('ERROR', 'GENERATION', `Session ${sessionId}: ${error}`, { details }),

  // ============================================================
  // SYSTÈME
  // ============================================================
  system: (message: string, details?: Record<string, unknown>) =>
    fileLog('INFO', 'SYSTEM', message, { details }),
  
  warn: (message: string, details?: Record<string, unknown>) =>
    fileLog('WARN', 'SYSTEM', message, { details }),
  
  error: (message: string, details?: Record<string, unknown>) =>
    fileLog('ERROR', 'SYSTEM', message, { details }),
};

// ============================================================
// UTILITAIRES
// ============================================================

// Lire les logs d'aujourd'hui (retourne des objets JSON)
export function getTodayLogs(): JsonLogEntry[] {
  try {
    const logFile = getTodayLogFile();
    if (!fs.existsSync(logFile)) return [];
    
    // Séparer par le séparateur "─" puis parser chaque bloc JSON
    const content = fs.readFileSync(logFile, 'utf-8');
    const blocks = content.split(/─{80,}/).filter(Boolean);
    
    return blocks.map(block => {
      try { return JSON.parse(block.trim()); } 
      catch { return null; }
    }).filter(Boolean) as JsonLogEntry[];
  } catch {
    return [];
  }
}

// Lire les N dernières entrées
export function getRecentLogs(count: number = 100): JsonLogEntry[] {
  const logs = getTodayLogs();
  return logs.slice(-count);
}

// Lire les erreurs récentes
export function getRecentErrors(count: number = 50): JsonLogEntry[] {
  const logs = getTodayLogs();
  return logs.filter(l => l.level === 'ERROR').slice(-count);
}

// Lister les fichiers de logs disponibles
export function listLogFiles(): string[] {
  try {
    ensureLogsDir();
    return fs.readdirSync(LOGS_DIR)
      .filter(f => f.endsWith('.json') || f.endsWith('.jsonl') || f.endsWith('.log'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Lire un fichier de log spécifique (retourne des objets JSON)
export function readLogFile(filename: string): JsonLogEntry[] {
  try {
    const filePath = path.join(LOGS_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    
    // Séparer par le séparateur "─" puis parser chaque bloc JSON
    const content = fs.readFileSync(filePath, 'utf-8');
    const blocks = content.split(/─{80,}/).filter(Boolean);
    
    return blocks.map(block => {
      try { return JSON.parse(block.trim()); }
      catch { return null; }
    }).filter(Boolean) as JsonLogEntry[];
  } catch {
    return [];
  }
}

// Exporter le type pour utilisation externe
export type { JsonLogEntry };

// Nettoyer les vieux logs au démarrage
cleanOldLogs();

// Exporter pour debug
export const fileLoggerUtils = {
  getTodayLogs,
  getRecentLogs,
  getRecentErrors,
  listLogFiles,
  readLogFile,
  cleanOldLogs,
  LOGS_DIR,
};
