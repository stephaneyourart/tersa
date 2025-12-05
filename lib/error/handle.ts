import { toast } from 'sonner';
import { parseError } from './parse';

// Durée d'affichage des toasts d'erreur : 1 minute
const ERROR_TOAST_DURATION = 60_000;

export const handleError = (title: string, error: unknown) => {
  const description = parseError(error);

  // Les toasts d'erreur expirent après 1 minute
  toast.error(title, { 
    description,
    duration: ERROR_TOAST_DURATION,
    closeButton: true,
  });
};

/**
 * Affiche une erreur complète avec tous les détails
 * Utilisé pour les erreurs de génération qui peuvent contenir beaucoup de contexte
 */
export const handleGenerationError = (
  nodeLabel: string, 
  error: unknown, 
  context?: { nodeId?: string; model?: string; prompt?: string }
) => {
  const errorMessage = parseError(error);
  
  // Construire un message détaillé
  let fullMessage = errorMessage;
  
  if (context?.model) {
    fullMessage = `[${context.model}] ${fullMessage}`;
  }
  
  // Log complet dans la console pour debug
  console.error(`[Generation Error] ${nodeLabel}:`, {
    error: errorMessage,
    ...context,
  });

  toast.error(`❌ Erreur: ${nodeLabel}`, { 
    description: fullMessage,
    duration: ERROR_TOAST_DURATION,
    closeButton: true,
  });
};
