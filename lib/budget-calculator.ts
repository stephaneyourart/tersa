/**
 * CALCULATEUR DE BUDGET
 * 
 * Estime le coût total d'une génération de projet
 * basé sur la configuration choisie.
 */

import type { GenerationConfig } from './generation-config';
import { 
  getLLMModel, 
  getT2IModel, 
  getI2IModel, 
  getVideoModel,
  type LLMProvider 
} from './models-registry';

// ============================================================
// TYPES
// ============================================================

export interface BudgetBreakdown {
  /** Coût LLM */
  llm: {
    model: string;
    estimatedTokens: number;
    cost: number;
  };
  /** Coût images T2I */
  t2i: {
    model: string;
    count: number;
    costPerImage: number;
    total: number;
  };
  /** Coût images I2I */
  i2i: {
    model: string;
    count: number;
    costPerImage: number;
    total: number;
  };
  /** Coût vidéos */
  video: {
    model: string;
    count: number;
    duration: number;
    costPerSecond: number;
    total: number;
  };
  /** Total général */
  total: number;
  /** Devise */
  currency: 'USD' | 'EUR';
}

// ============================================================
// CONSTANTES
// ============================================================

/** Estimation du nombre de tokens pour l'analyse d'un brief */
const ESTIMATED_INPUT_TOKENS = 5000;
const ESTIMATED_OUTPUT_TOKENS = 10000;

/** Nombre moyen d'images par type d'entité */
const IMAGES_PER_CHARACTER = 4; // primary + 3 variantes
const IMAGES_PER_DECOR = 4;     // primary + 3 variantes

/** Estimation du nombre de personnages et décors */
const ESTIMATED_CHARACTERS = 3;
const ESTIMATED_DECORS = 3;

// ============================================================
// CALCUL DU BUDGET
// ============================================================

/**
 * Calcule le budget estimé pour une configuration donnée
 */
export function calculateBudget(config: GenerationConfig): BudgetBreakdown {
  const { llm, t2i, i2i, video, quantities } = config;
  
  // ----- LLM -----
  const llmModel = getLLMModel(llm.provider as LLMProvider, llm.model);
  const llmCost = llmModel 
    ? (ESTIMATED_INPUT_TOKENS / 1_000_000) * llmModel.costPer1MInput +
      (ESTIMATED_OUTPUT_TOKENS / 1_000_000) * llmModel.costPer1MOutput
    : 0.10; // Fallback

  // ----- T2I (images primaires personnages + décors) -----
  const t2iModel = getT2IModel(t2i.model);
  const t2iCount = (ESTIMATED_CHARACTERS + ESTIMATED_DECORS) * 1; // 1 primaire chacun
  const t2iCostPerImage = t2iModel?.costPerImage ?? 0.02;
  const t2iTotal = t2iCount * t2iCostPerImage;

  // ----- I2I (variantes + first/last frames) -----
  const i2iModel = getI2IModel(i2i.model);
  const i2iCostPerImage = i2iModel?.costPerImage ?? 0.025;
  
  // Variantes personnages/décors (3 par entité)
  const variantesCount = (ESTIMATED_CHARACTERS + ESTIMATED_DECORS) * 3;
  
  // First/last frames pour les plans
  const framesPerPlan = video.mode === 'images-first-last' ? 2 : 1;
  const framesCount = quantities.plansCount * quantities.imageSetsPerPlan * framesPerPlan;
  
  const i2iCount = variantesCount + framesCount;
  const i2iTotal = i2iCount * i2iCostPerImage;

  // ----- Vidéo -----
  const videoModel = getVideoModel(video.model);
  const videoCostPerSecond = videoModel?.costPerSecond ?? 0.05;
  
  const videoCount = quantities.plansCount * 
                     quantities.imageSetsPerPlan * 
                     quantities.videosPerImageSet;
  const videoTotal = videoCount * video.duration * videoCostPerSecond;

  // ----- Total -----
  const total = llmCost + t2iTotal + i2iTotal + videoTotal;

  return {
    llm: {
      model: llm.model,
      estimatedTokens: ESTIMATED_INPUT_TOKENS + ESTIMATED_OUTPUT_TOKENS,
      cost: llmCost,
    },
    t2i: {
      model: t2i.model,
      count: t2iCount,
      costPerImage: t2iCostPerImage,
      total: t2iTotal,
    },
    i2i: {
      model: i2i.model,
      count: i2iCount,
      costPerImage: i2iCostPerImage,
      total: i2iTotal,
    },
    video: {
      model: video.model,
      count: videoCount,
      duration: video.duration,
      costPerSecond: videoCostPerSecond,
      total: videoTotal,
    },
    total,
    currency: 'USD',
  };
}

/**
 * Formate un montant en devise
 */
export function formatCurrency(amount: number, currency: 'USD' | 'EUR' = 'USD'): string {
  const symbol = currency === 'EUR' ? '€' : '$';
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Formate le breakdown complet pour affichage
 */
export function formatBudgetBreakdown(breakdown: BudgetBreakdown): string[] {
  const { llm, t2i, i2i, video, total, currency } = breakdown;
  const fmt = (n: number) => formatCurrency(n, currency);
  
  return [
    `LLM (${llm.model}): ~${llm.estimatedTokens.toLocaleString()} tokens → ${fmt(llm.cost)}`,
    `T2I (${t2i.count} images × ${fmt(t2i.costPerImage)}): ${fmt(t2i.total)}`,
    `I2I (${i2i.count} images × ${fmt(i2i.costPerImage)}): ${fmt(i2i.total)}`,
    `Vidéo (${video.count} × ${video.duration}s × ${fmt(video.costPerSecond)}/s): ${fmt(video.total)}`,
    `────────────────────`,
    `TOTAL ESTIMÉ: ${fmt(total)}`,
  ];
}

/**
 * Calcule le budget détaillé avec les paramètres réels d'un projet
 */
export function calculateDetailedBudget(params: {
  charactersCount: number;
  decorsCount: number;
  plansCount: number;
  config: GenerationConfig;
}): BudgetBreakdown {
  const { charactersCount, decorsCount, plansCount, config } = params;
  const { llm, t2i, i2i, video, quantities } = config;
  
  // ----- LLM -----
  const llmModel = getLLMModel(llm.provider as LLMProvider, llm.model);
  const llmCost = llmModel 
    ? (ESTIMATED_INPUT_TOKENS / 1_000_000) * llmModel.costPer1MInput +
      (ESTIMATED_OUTPUT_TOKENS / 1_000_000) * llmModel.costPer1MOutput
    : 0.10;

  // ----- T2I -----
  const t2iModel = getT2IModel(t2i.model);
  const t2iCount = charactersCount + decorsCount;
  const t2iCostPerImage = t2iModel?.costPerImage ?? 0.02;
  const t2iTotal = t2iCount * t2iCostPerImage;

  // ----- I2I -----
  const i2iModel = getI2IModel(i2i.model);
  const i2iCostPerImage = i2iModel?.costPerImage ?? 0.025;
  
  const variantesCount = (charactersCount + decorsCount) * 3;
  const framesPerPlan = video.mode === 'images-first-last' ? 2 : 1;
  const framesCount = plansCount * quantities.imageSetsPerPlan * framesPerPlan;
  
  const i2iCount = variantesCount + framesCount;
  const i2iTotal = i2iCount * i2iCostPerImage;

  // ----- Vidéo -----
  const videoModel = getVideoModel(video.model);
  const videoCostPerSecond = videoModel?.costPerSecond ?? 0.05;
  
  const videoCount = plansCount * 
                     quantities.imageSetsPerPlan * 
                     quantities.videosPerImageSet;
  const videoTotal = videoCount * video.duration * videoCostPerSecond;

  // ----- Total -----
  const total = llmCost + t2iTotal + i2iTotal + videoTotal;

  return {
    llm: {
      model: llm.model,
      estimatedTokens: ESTIMATED_INPUT_TOKENS + ESTIMATED_OUTPUT_TOKENS,
      cost: llmCost,
    },
    t2i: {
      model: t2i.model,
      count: t2iCount,
      costPerImage: t2iCostPerImage,
      total: t2iTotal,
    },
    i2i: {
      model: i2i.model,
      count: i2iCount,
      costPerImage: i2iCostPerImage,
      total: i2iTotal,
    },
    video: {
      model: video.model,
      count: videoCount,
      duration: video.duration,
      costPerSecond: videoCostPerSecond,
      total: videoTotal,
    },
    total,
    currency: 'USD',
  };
}
