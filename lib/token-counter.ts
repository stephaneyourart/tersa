/**
 * Utilitaire pour compter les tokens selon le modèle Gemini
 * Utilise des estimations basées sur les standards de Google
 */

export interface TokenCountResult {
  tokens: number;
  characters: number;
  estimatedCost?: number;
}

/**
 * Compte les tokens pour du texte brut
 * Estimation: ~4 caractères = 1 token (standard Gemini)
 */
export function countTextTokens(text: string): TokenCountResult {
  const characters = text.length;
  const tokens = Math.ceil(characters / 4);
  
  return {
    tokens,
    characters,
  };
}

/**
 * Estime les tokens pour une image
 * Basé sur la résolution de l'image
 * Gemini: ~258 tokens par image standard
 */
export function countImageTokens(width: number, height: number): TokenCountResult {
  // Formule approximative de Gemini Pro Vision
  const pixels = width * height;
  const megapixels = pixels / 1000000;
  
  // Base: 258 tokens pour une image standard (~1MP)
  // Augmente avec la résolution
  const tokens = Math.ceil(258 * Math.sqrt(megapixels));
  
  return {
    tokens,
    characters: 0,
  };
}

/**
 * Estime les tokens pour une vidéo
 * Calcul: FPS * durée * tokens_par_frame
 * Gemini traite ~1 frame par seconde pour l'analyse
 */
export function countVideoTokens(durationSeconds: number, width: number, height: number): TokenCountResult {
  // Gemini analyse environ 1 frame par seconde
  const framesAnalyzed = Math.ceil(durationSeconds);
  const tokensPerFrame = countImageTokens(width, height).tokens;
  const tokens = framesAnalyzed * tokensPerFrame;
  
  return {
    tokens,
    characters: 0,
  };
}

/**
 * Estime les tokens pour un PDF
 * Basé sur le nombre de pages et la densité de texte
 */
export function countPDFTokens(pages: number, estimatedWordsPerPage: number = 300): TokenCountResult {
  // Moyenne: 300 mots par page, ~4.5 caractères par mot
  const characters = pages * estimatedWordsPerPage * 4.5;
  const tokens = Math.ceil(characters / 4);
  
  return {
    tokens,
    characters: Math.ceil(characters),
  };
}

/**
 * Estime les tokens pour un fichier audio
 * Basé sur la durée (si transcription)
 */
export function countAudioTokens(durationSeconds: number): TokenCountResult {
  // Estimation: 150 mots par minute de parole
  // 1 mot = ~4.5 caractères
  const minutes = durationSeconds / 60;
  const estimatedWords = minutes * 150;
  const characters = estimatedWords * 4.5;
  const tokens = Math.ceil(characters / 4);
  
  return {
    tokens,
    characters: Math.ceil(characters),
  };
}

/**
 * Calcule le coût estimé en fonction du modèle
 * Prix pour Gemini 3 (à adapter selon le modèle)
 */
export function calculateCost(tokens: number, model: string = 'gemini-3'): number {
  const pricePerMillionTokens: Record<string, number> = {
    'gemini-3': 0.075, // Input price USD
    'gemini-2-flash': 0.0375,
    'gpt-4o': 2.5,
    'gpt-4o-mini': 0.15,
    'claude-3.5-sonnet': 3.0,
  };
  
  const price = pricePerMillionTokens[model] || 0.075;
  return (tokens / 1000000) * price;
}

/**
 * Formate le nombre de tokens de manière lisible
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens} tokens`;
  } else if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K tokens`;
  } else {
    return `${(tokens / 1000000).toFixed(2)}M tokens`;
  }
}

/**
 * Formate le coût de manière lisible
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `< $0.01`;
  }
  return `$${cost.toFixed(2)}`;
}

