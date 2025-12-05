/**
 * Système de logging centralisé pour la génération de médias
 * 
 * OBJECTIFS :
 * - Logs structurés et horodatés
 * - Historique consultable
 * - Résumé de session
 * - Export facile pour debug
 */

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';
export type LogCategory = 'image' | 'video' | 'collection' | 'api' | 'system';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  nodeId?: string;
  nodeLabel?: string;
  message: string;
  details?: Record<string, unknown>;
  sessionId: string;
}

export interface GenerationSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  logs: LogEntry[];
  stats: {
    total: number;
    success: number;
    errors: number;
    warnings: number;
    byCategory: Record<LogCategory, { total: number; success: number; errors: number }>;
  };
}

// Session courante
let currentSession: GenerationSession | null = null;

// Historique des sessions (garde les 10 dernières)
const sessionHistory: GenerationSession[] = [];
const MAX_HISTORY = 10;

// Générer un ID de session unique
function generateSessionId(): string {
  const now = new Date();
  return `gen-${now.toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
}

// Initialiser une nouvelle session
export function startGenerationSession(): string {
  // Terminer la session précédente si elle existe
  if (currentSession) {
    endGenerationSession();
  }

  const sessionId = generateSessionId();
  currentSession = {
    id: sessionId,
    startTime: new Date(),
    logs: [],
    stats: {
      total: 0,
      success: 0,
      errors: 0,
      warnings: 0,
      byCategory: {
        image: { total: 0, success: 0, errors: 0 },
        video: { total: 0, success: 0, errors: 0 },
        collection: { total: 0, success: 0, errors: 0 },
        api: { total: 0, success: 0, errors: 0 },
        system: { total: 0, success: 0, errors: 0 },
      },
    },
  };

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 [GENERATION] Session démarrée: ${sessionId}`);
  console.log(`   Timestamp: ${currentSession.startTime.toISOString()}`);
  console.log(`${'='.repeat(80)}\n`);

  return sessionId;
}

// Terminer la session courante
export function endGenerationSession(): GenerationSession | null {
  if (!currentSession) return null;

  currentSession.endTime = new Date();
  const duration = (currentSession.endTime.getTime() - currentSession.startTime.getTime()) / 1000;

  // Afficher le résumé
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ [GENERATION] Session terminée: ${currentSession.id}`);
  console.log(`   Durée: ${duration.toFixed(1)}s`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`   📊 RÉSUMÉ:`);
  console.log(`      Total: ${currentSession.stats.total} générations`);
  console.log(`      ✅ Succès: ${currentSession.stats.success}`);
  console.log(`      ❌ Erreurs: ${currentSession.stats.errors}`);
  console.log(`      ⚠️ Warnings: ${currentSession.stats.warnings}`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`   📁 Par catégorie:`);
  for (const [cat, stats] of Object.entries(currentSession.stats.byCategory)) {
    if (stats.total > 0) {
      console.log(`      ${cat.toUpperCase()}: ${stats.success}/${stats.total} succès, ${stats.errors} erreurs`);
    }
  }
  console.log(`${'='.repeat(80)}\n`);

  // Sauvegarder dans l'historique
  sessionHistory.unshift(currentSession);
  if (sessionHistory.length > MAX_HISTORY) {
    sessionHistory.pop();
  }

  const session = currentSession;
  currentSession = null;
  return session;
}

// Logger principal
export function genLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  options?: {
    nodeId?: string;
    nodeLabel?: string;
    details?: Record<string, unknown>;
  }
): void {
  // S'assurer qu'on a une session
  if (!currentSession) {
    startGenerationSession();
  }

  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    category,
    nodeId: options?.nodeId,
    nodeLabel: options?.nodeLabel,
    message,
    details: options?.details,
    sessionId: currentSession!.id,
  };

  // Ajouter au log
  currentSession!.logs.push(entry);

  // Mettre à jour les stats
  currentSession!.stats.total++;
  currentSession!.stats.byCategory[category].total++;

  if (level === 'success') {
    currentSession!.stats.success++;
    currentSession!.stats.byCategory[category].success++;
  } else if (level === 'error') {
    currentSession!.stats.errors++;
    currentSession!.stats.byCategory[category].errors++;
  } else if (level === 'warn') {
    currentSession!.stats.warnings++;
  }

  // Formater pour la console
  const time = entry.timestamp.toISOString().slice(11, 23);
  const prefix = getPrefix(level);
  const catTag = `[${category.toUpperCase()}]`.padEnd(12);
  const nodeTag = options?.nodeLabel ? `[${options.nodeLabel}]` : '';

  const logMessage = `${time} ${prefix} ${catTag} ${nodeTag} ${message}`;

  // Logger selon le niveau
  switch (level) {
    case 'error':
      console.error(logMessage);
      if (options?.details) {
        console.error('         Details:', options.details);
      }
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'debug':
      console.debug(logMessage);
      break;
    default:
      console.log(logMessage);
  }

  // Si erreur, afficher les détails
  if (level === 'error' && options?.details) {
    console.error('         └─ Details:', JSON.stringify(options.details, null, 2));
  }
}

// Helpers pour raccourcir les appels
export const logImage = {
  start: (nodeLabel: string, nodeId: string, details?: Record<string, unknown>) =>
    genLog('info', 'image', `🎨 Début génération`, { nodeLabel, nodeId, details }),
  success: (nodeLabel: string, nodeId: string, url: string, model: string) =>
    genLog('success', 'image', `✅ Généré avec ${model} → ${url.slice(0, 50)}...`, { nodeLabel, nodeId }),
  error: (nodeLabel: string, nodeId: string, error: string, details?: Record<string, unknown>) =>
    genLog('error', 'image', `❌ Échec: ${error}`, { nodeLabel, nodeId, details }),
  api: (nodeLabel: string, endpoint: string, model: string, params: Record<string, unknown>) =>
    genLog('debug', 'image', `📡 API ${endpoint} | model=${model}`, { nodeLabel, details: params }),
};

export const logVideo = {
  start: (nodeLabel: string, nodeId: string, details?: Record<string, unknown>) =>
    genLog('info', 'video', `🎬 Début génération`, { nodeLabel, nodeId, details }),
  success: (nodeLabel: string, nodeId: string, url: string, model: string) =>
    genLog('success', 'video', `✅ Généré avec ${model} → ${url.slice(0, 50)}...`, { nodeLabel, nodeId }),
  error: (nodeLabel: string, nodeId: string, error: string, details?: Record<string, unknown>) =>
    genLog('error', 'video', `❌ Échec: ${error}`, { nodeLabel, nodeId, details }),
  frames: (nodeLabel: string, firstFrame: string | undefined, lastFrame: string | undefined, mode: string) =>
    genLog('info', 'video', `📐 Mode: ${mode} | first=${firstFrame ? '✓' : '✗'} last=${lastFrame ? '✓' : '✗'}`, { 
      nodeLabel, 
      details: { 
        mode, 
        firstFrame: firstFrame?.slice(0, 50), 
        lastFrame: lastFrame?.slice(0, 50) 
      } 
    }),
  api: (nodeLabel: string, model: string, params: Record<string, unknown>) =>
    genLog('debug', 'video', `📡 API | model=${model}`, { nodeLabel, details: params }),
};

export const logSystem = {
  info: (message: string, details?: Record<string, unknown>) =>
    genLog('info', 'system', message, { details }),
  warn: (message: string, details?: Record<string, unknown>) =>
    genLog('warn', 'system', `⚠️ ${message}`, { details }),
  error: (message: string, details?: Record<string, unknown>) =>
    genLog('error', 'system', message, { details }),
  progress: (completed: number, total: number, successes: number, errors: number) =>
    genLog('info', 'system', `📊 Progression: ${completed}/${total} (${successes} ✓, ${errors} ✗)`, {
      details: { completed, total, successes, errors },
    }),
};

// Obtenir le préfixe d'affichage selon le niveau
function getPrefix(level: LogLevel): string {
  switch (level) {
    case 'success': return '✅';
    case 'error': return '❌';
    case 'warn': return '⚠️';
    case 'debug': return '🔍';
    default: return 'ℹ️';
  }
}

// Obtenir la session courante
export function getCurrentSession(): GenerationSession | null {
  return currentSession;
}

// Obtenir l'historique des sessions
export function getSessionHistory(): GenerationSession[] {
  return sessionHistory;
}

// Exporter les logs de la session courante en JSON
export function exportSessionLogs(): string {
  if (!currentSession) return '{}';
  return JSON.stringify(currentSession, null, 2);
}

// Afficher les dernières erreurs
export function showRecentErrors(count: number = 10): void {
  if (!currentSession) {
    console.log('Aucune session active');
    return;
  }

  const errors = currentSession.logs.filter(l => l.level === 'error').slice(-count);
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🔴 ${errors.length} dernières erreurs:`);
  console.log(`${'─'.repeat(60)}`);
  
  for (const err of errors) {
    const time = err.timestamp.toISOString().slice(11, 23);
    console.log(`${time} [${err.category}] ${err.nodeLabel || ''}: ${err.message}`);
    if (err.details) {
      console.log(`         └─`, err.details);
    }
  }
  console.log(`${'─'.repeat(60)}\n`);
}

// Exposer globalement pour debug dans la console du navigateur
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).generationLogs = {
    getCurrentSession,
    getSessionHistory,
    exportSessionLogs,
    showRecentErrors,
    endSession: endGenerationSession,
  };
}
