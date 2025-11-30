/**
 * API Route: /api/analyze-media
 * Analyse un média avec GPT-4.1 mini pour extraire les métadonnées DVR
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// System prompt par défaut pour l'analyse
const DEFAULT_SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'analyse de contenu multimédia pour la post-production vidéo.

Ton rôle est d'analyser le contexte de génération d'un élément (image, vidéo, audio) et d'en extraire des métadonnées structurées pour DaVinci Resolve.

À partir du prompt de génération et des informations fournies, tu dois identifier :
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
- Si le prompt est en anglais, réponds en français`;

type AnalyzeRequest = {
  mediaType: 'image' | 'video' | 'audio';
  prompt?: string;           // Le prompt de génération
  mediaUrl?: string;         // URL du média (pour analyse visuelle future)
  sourceImageUrls?: string[]; // URLs des images sources
  customSystemPrompt?: string; // System prompt personnalisé du projet
};

type AnalysisResult = {
  title: string;
  decor: string;
  description: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AnalyzeRequest;
    const { mediaType, prompt, mediaUrl, sourceImageUrls, customSystemPrompt } = body;

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

    // Construire le message utilisateur
    let userMessage = `Analyse ce contenu ${mediaType === 'image' ? 'image' : mediaType === 'video' ? 'vidéo' : 'audio'}.`;
    
    if (prompt) {
      userMessage += `\n\nPrompt de génération utilisé :\n"${prompt}"`;
    }
    
    if (sourceImageUrls && sourceImageUrls.length > 0) {
      userMessage += `\n\nImages sources utilisées : ${sourceImageUrls.length} image(s)`;
    }

    // Utiliser GPT-4.1 mini pour l'analyse
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: customSystemPrompt || DEFAULT_SYSTEM_PROMPT,
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
      // Si le parsing échoue, essayer d'extraire les données
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

