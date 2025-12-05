/**
 * Système de logging centralisé en FICHIERS
 * 
 * - Écrit dans /logs/*.log
 * - Un fichier par jour
 * - Auto-nettoyage après 3 jours
 * - Format structuré et grep-able
 */

import fs from 'fs';
import path from 'path';

// Dossier des logs (à la racine du projet)
const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_AGE_DAYS = 3;

// Types
export type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DEBUG' | 'API';
export type LogCategory = 'IMAGE' | 'VIDEO' | 'LLM' | 'API' | 'SYSTEM' | 'GENERATION';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  nodeId?: string;
  model?: string;
  duration?: number;
  details?: Record<string, unknown>;
}

// S'assurer que le dossier logs existe
function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

// Obtenir le nom du fichier log du jour
function getTodayLogFile(): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOGS_DIR, `${today}.log`);
}

// Nettoyer les anciens logs (> 3 jours)
function cleanOldLogs(): void {
  try {
    ensureLogsDir();
    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      
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

// Formater une entrée de log
function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, category, message, nodeId, model, duration, details } = entry;
  
  let line = `${timestamp} [${level.padEnd(7)}] [${category.padEnd(10)}]`;
  
  if (nodeId) line += ` [node:${nodeId}]`;
  if (model) line += ` [model:${model}]`;
  if (duration !== undefined) line += ` [${duration}ms]`;
  
  line += ` ${message}`;
  
  if (details && Object.keys(details).length > 0) {
    line += ` | ${JSON.stringify(details)}`;
  }
  
  return line;
}

// Écrire dans le fichier log
function writeLog(entry: LogEntry): void {
  try {
    ensureLogsDir();
    const logFile = getTodayLogFile();
    const line = formatLogEntry(entry) + '\n';
    
    fs.appendFileSync(logFile, line, 'utf-8');
    
    // Aussi afficher en console pour le terminal
    const consoleMsg = `${entry.timestamp.slice(11, 23)} [${entry.level}] [${entry.category}] ${entry.message}`;
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

// Logger principal
export function fileLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  options?: {
    nodeId?: string;
    model?: string;
    duration?: number;
    details?: Record<string, unknown>;
  }
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...options,
  };
  
  writeLog(entry);
}

// ============================================================
// HELPERS PAR CATÉGORIE
// ============================================================

export const fLog = {
  // IMAGES
  imageStart: (nodeId: string, model: string, prompt?: string) =>
    fileLog('INFO', 'IMAGE', `Démarrage génération`, { nodeId, model, details: prompt ? { prompt: prompt.slice(0, 100) } : undefined }),
  
  imageSuccess: (nodeId: string, model: string, url: string, duration: number) =>
    fileLog('SUCCESS', 'IMAGE', `Généré: ${url.slice(0, 80)}...`, { nodeId, model, duration }),
  
  imageError: (nodeId: string, model: string, error: string, details?: Record<string, unknown>) =>
    fileLog('ERROR', 'IMAGE', `Échec: ${error}`, { nodeId, model, details }),
  
  imagePolling: (nodeId: string, attempt: number, status: string) =>
    fileLog('DEBUG', 'IMAGE', `Polling #${attempt}: ${status}`, { nodeId }),

  // VIDEOS
  videoStart: (nodeId: string, model: string, duration: number, mode: string) =>
    fileLog('INFO', 'VIDEO', `Démarrage génération ${duration}s mode=${mode}`, { nodeId, model }),
  
  videoSuccess: (nodeId: string, model: string, url: string, duration: number) =>
    fileLog('SUCCESS', 'VIDEO', `Généré: ${url.slice(0, 80)}...`, { nodeId, model, duration }),
  
  videoError: (nodeId: string, model: string, error: string, details?: Record<string, unknown>) =>
    fileLog('ERROR', 'VIDEO', `Échec: ${error}`, { nodeId, model, details }),
  
  videoPolling: (nodeId: string, attempt: number, status: string) =>
    fileLog('DEBUG', 'VIDEO', `Polling #${attempt}: ${status}`, { nodeId }),

  // LLM
  llmStart: (provider: string, model: string) =>
    fileLog('INFO', 'LLM', `Démarrage ${provider}/${model}`, { model }),
  
  llmSuccess: (provider: string, model: string, tokens: number, duration: number) =>
    fileLog('SUCCESS', 'LLM', `Réponse ${tokens} tokens`, { model, duration }),
  
  llmError: (provider: string, model: string, error: string) =>
    fileLog('ERROR', 'LLM', `Échec: ${error}`, { model }),

  // API
  apiCall: (endpoint: string, method: string, params?: Record<string, unknown>) =>
    fileLog('API', 'API', `${method} ${endpoint}`, { details: params }),
  
  apiResponse: (endpoint: string, status: number, duration: number) =>
    fileLog('API', 'API', `Réponse ${status}`, { duration, details: { endpoint } }),
  
  apiError: (endpoint: string, status: number, error: string) =>
    fileLog('ERROR', 'API', `${endpoint} → ${status}: ${error}`, {}),

  // GÉNÉRATION (séquences)
  genStart: (sessionId: string, config: Record<string, unknown>) =>
    fileLog('INFO', 'GENERATION', `=== SESSION DÉMARRÉE: ${sessionId} ===`, { details: config }),
  
  genProgress: (completed: number, total: number, successes: number, errors: number) =>
    fileLog('INFO', 'GENERATION', `Progression: ${completed}/${total} (✓${successes} ✗${errors})`, {}),
  
  genEnd: (sessionId: string, duration: number, stats: Record<string, unknown>) =>
    fileLog('SUCCESS', 'GENERATION', `=== SESSION TERMINÉE: ${sessionId} (${duration}s) ===`, { duration, details: stats }),
  
  genError: (sessionId: string, error: string, details?: Record<string, unknown>) =>
    fileLog('ERROR', 'GENERATION', `Session ${sessionId}: ${error}`, { details }),

  // SYSTÈME
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

// Lire les logs d'aujourd'hui
export function getTodayLogs(): string[] {
  try {
    const logFile = getTodayLogFile();
    if (!fs.existsSync(logFile)) return [];
    return fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// Lire les N dernières lignes
export function getRecentLogs(count: number = 100): string[] {
  const logs = getTodayLogs();
  return logs.slice(-count);
}

// Lire les erreurs récentes
export function getRecentErrors(count: number = 50): string[] {
  const logs = getTodayLogs();
  return logs.filter(l => l.includes('[ERROR')).slice(-count);
}

// Lister les fichiers de logs disponibles
export function listLogFiles(): string[] {
  try {
    ensureLogsDir();
    return fs.readdirSync(LOGS_DIR)
      .filter(f => f.endsWith('.log'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Lire un fichier de log spécifique
export function readLogFile(filename: string): string[] {
  try {
    const filePath = path.join(LOGS_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

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
