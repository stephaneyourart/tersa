/**
 * API Route: /api/analyze-media
 * Analyse un média avec GPT-4o mini pour extraire les métadonnées DVR
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// System prompt par défaut pour l'analyse (utilisé si pas de prompt personnalisé dans les settings du projet)
const DEFAULT_SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'analyse de contenu multimédia pour la post-production vidéo.

Ton rôle est d'analyser le contexte d'un élément (image, vidéo, audio) et d'en extraire des métadonnées structurées pour DaVinci Resolve.

À partir des informations fournies (prompt de génération OU nom de fichier pour les imports), tu dois identifier :
- Les personnages présents et leurs caractéristiques
- Le décor/lieu de la scène (environnement, ambiance, éclairage)
- Les actions en cours ou suggérées
- Les mouvements de caméra éventuels (plan large, gros plan, travelling, etc.)
- L'ambiance générale (dramatique, joyeuse, mystérieuse, etc.)

Tu dois répondre UNIQUEMENT au format JSON suivant, sans aucun texte avant ou après :
{
  "title": "Titre court et descriptif (max 50 caractères)",
  "decor": "Description du décor/lieu (max 30 caractères)", 
  "description": "Description complète de la scène incluant personnages, actions, ambiance"
}

Règles importantes :
- Le titre doit être concis mais évocateur, comme un nom de fichier
- Le décor doit être très court (30 chars max) : ex "Forêt enchantée", "Bureau moderne"
- La description peut être plus longue et détaillée
- Utilise un langage professionnel adapté à la post-production
- Si le prompt est en anglais, réponds en français
- Pour les fichiers importés sans prompt, déduis le contenu du nom de fichier
- Transforme les noms techniques en titres lisibles (ex: "IMG_2024_beach.jpg" -> "Plage 2024")`;

type AnalyzeRequest = {
  mediaType: 'image' | 'video' | 'audio';
  prompt?: string;           // Le prompt de génération (vide pour les imports)
  mediaUrl?: string;         // URL du média
  sourceImageUrls?: string[]; // URLs des images sources
  customSystemPrompt?: string; // System prompt personnalisé du projet
  isImported?: boolean;      // Indique si c'est un import (pas généré)
};

type AnalysisResult = {
  title: string;
  decor: string;
  description: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AnalyzeRequest;
    const { mediaType, prompt, mediaUrl, sourceImageUrls, customSystemPrompt, isImported } = body;

    // Vérifier qu'on a au moins un prompt ou une URL
    if (!prompt && !mediaUrl) {
      return NextResponse.json(
        { error: 'prompt ou mediaUrl requis' },
        { status: 400 }
      );
    }

    // Vérifier la clé API OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY non configurée' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Construire le message utilisateur selon le contexte
    let userMessage = '';
    const mediaTypeLabel = mediaType === 'image' ? 'image' : mediaType === 'video' ? 'vidéo' : 'audio';
    
    if (isImported || !prompt) {
      // Mode import : on analyse le nom du fichier
      const filename = mediaUrl ? decodeURIComponent(mediaUrl.split('/').pop() || '') : '';
      userMessage = `Analyse ce fichier ${mediaTypeLabel} importé depuis le disque.`;
      userMessage += `\n\nNom du fichier : "${filename}"`;
    } else {
      // Mode généré : on analyse le prompt
      userMessage = `Analyse ce contenu ${mediaTypeLabel} généré par IA.`;
      userMessage += `\n\nPrompt de génération utilisé :\n"${prompt}"`;
    }
    
    if (sourceImageUrls && sourceImageUrls.length > 0) {
      userMessage += `\n\nImages sources utilisées : ${sourceImageUrls.length} image(s)`;
    }

    // Utiliser le system prompt personnalisé du projet s'il existe, sinon le défaut
    const systemPrompt = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Utiliser GPT-4o mini pour l'analyse
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('Pas de réponse de GPT');
    }

    // Parser la réponse JSON
    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(responseText) as AnalysisResult;
    } catch {
      console.error('Erreur parsing JSON:', responseText);
      analysis = {
        title: 'Sans titre',
        decor: '',
        description: responseText,
      };
    }

    // Valider et tronquer si nécessaire
    const result: AnalysisResult = {
      title: (analysis.title || 'Sans titre').slice(0, 50),
      decor: (analysis.decor || '').slice(0, 30),
      description: analysis.description || '',
    };

    return NextResponse.json({
      success: true,
      analysis: result,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
      },
    });

  } catch (error) {
    console.error('[Analyze Media] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erreur serveur',
        success: false 
      },
      { status: 500 }
    );
  }
}
